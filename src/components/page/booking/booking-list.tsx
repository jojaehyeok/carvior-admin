'use client';

import DefaultTable from "@/components/shared/ui/default-table";
import DefaultTableBtn from "@/components/shared/ui/default-table-btn";
import { ISO8601DateTime } from "@/types/common";
import { Button, Checkbox, Input, InputNumber, Modal, Select, Spin, Tag, message } from "antd";
import { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { Eye, FileText, MessageSquare, PenSquare, RefreshCw, UserPlus } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import React, { useCallback, useEffect, useMemo, useState } from "react";

const CAVIOR_BASE = (process.env.NEXT_PUBLIC_API_ENDPOINT || 'https://carvior.store/api/v1').replace('/api/v1', '');
const INTERNAL_KEY = process.env.NEXT_PUBLIC_STORE_ITEMS_INTERNAL_KEY ?? '';
const INTERNAL_HEADERS = { 'x-internal-key': INTERNAL_KEY };

// 저장은 숫자만으로 하고, 화면에 보여줄 때만 하이픈을 넣어준다(01050384348 → 010-5038-4348)
function formatPhone(raw?: string | null): string {
  if (!raw) return '';
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) {
    return digits.startsWith('02')
      ? `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`
      : `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw;
}

// 리포트 수정은 진단 완료 후 4시간까지만 — 그 이후엔 이미 발주사가 리포트를 보고
// 판단을 내렸을 수 있어서 조용히 내용이 바뀌는 걸 막기 위함
const REPORT_EDIT_WINDOW_MS = 4 * 60 * 60 * 1000;
const isReportEditExpired = (record: { firstCompletedAt?: string | null }) => {
  if (!record.firstCompletedAt) return false; // completedAt 정보가 없는 구버전 데이터는 막지 않음
  return Date.now() - new Date(record.firstCompletedAt).getTime() > REPORT_EDIT_WINDOW_MS;
};

// 진단일시(방문예정, "YYYY-MM-DD HH:mm")부터 진단완료일시까지 실제로 몇 시간 걸렸는지 계산
function formatDuration(preferredDateTime?: string | null, completedAt?: string | null): string | null {
  if (!preferredDateTime || !completedAt) return null;
  const start = dayjs(preferredDateTime, "YYYY-MM-DD HH:mm");
  const end = dayjs(completedAt);
  if (!start.isValid() || !end.isValid()) return null;
  const diffMin = end.diff(start, "minute");
  if (diffMin < 0) return null; // 완료시각이 방문예정시각보다 이르면 비교 의미 없음(표시 생략)
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

// --- 인터페이스 정의 ---
interface IDriver {
  id: number;
  accountId: string;
  name: string;
  status: string;
  phone?: string;
}

interface IBooking {
  id: number;
  carNumber: string;
  carModel?: string | null;
  carOwner: string;
  dealerName: string;
  contact: string;
  address: string;
  preferredDateTime: string;
  source?: string;
  status: 'PENDING' | 'ASSIGNED' | 'COMPLETED' | 'CANCELLED';
  carHash?: string | null;
  firstCompletedAt?: string | null;
  adminMemo?: string;
  assignedDriverId?: string | null;
  assignedDriverName?: string | null;
  cancelledByDriverAt?: string | null; // 진단사 취소로 재대기된 시각
  // 오더 기록 필드
  contractWriter?: string;
  vehicleTransferred?: boolean;
  contractConfirmed?: boolean; // 계약 상태 확인 여부(계약완료 확인/미확인)
  purchasePrice?: number | null;
  isOldDealerPurchase?: boolean;
  oldDealerFee?: number | null; // 구전 금액 (만원)
  customerContact?: string | null; // 계약팀이 직접 확인·기록하는 차주(고객) 연락처
  createdAt: ISO8601DateTime;
}

interface BookingListProps {
  /** SUPER_ADMIN이면 null, COMPANY_ADMIN이면 발주사 ID (예: 'anyone-motors') */
  companyFilter?: string | null;
}

const BookingList = ({ companyFilter }: BookingListProps) => {
  const { data: session } = useSession();
  const router = useRouter();
  const [data, setData] = useState<IBooking[]>([]);
  const [drivers, setDrivers] = useState<IDriver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // bookingId → storeItemId (스마트옥션 매물로 이미 등록됐는지 확인용)
  const [storeItemMap, setStoreItemMap] = useState<Record<number, string>>({});

  // --- 진단사/매니저 수정 요청 모달 ---
  const [requestTarget, setRequestTarget] = useState<IBooking | null>(null);
  const [requestCategory, setRequestCategory] = useState<string | undefined>(undefined);
  const [requestMessage, setRequestMessage] = useState("");
  const [requestRecipientId, setRequestRecipientId] = useState<number | undefined>(undefined);
  const [requesting, setRequesting] = useState(false);

  // --- 상세/수정 모달 상태 ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<IBooking | null>(null);
  const [tempMemo, setTempMemo] = useState("");
  const [tempStatus, setTempStatus] = useState<IBooking['status']>('PENDING');
  // 간편신청(B2B)에서 "미정"으로 접수된 차량번호/차주 성함을 나중에 알게 되면 채워넣는 용도
  const [tempCarNumber, setTempCarNumber] = useState("");
  const [tempCarOwner, setTempCarOwner] = useState("");
  const [tempCarModel, setTempCarModel] = useState("");
  // 배정 전에 접수 정보(딜러이름/딜러번호/주소)가 잘못 들어온 경우 바로잡기 위한 용도
  const [tempDealerName, setTempDealerName] = useState("");
  const [tempContact, setTempContact] = useState("");
  const [tempAddress, setTempAddress] = useState("");
  const [selectedDriver, setSelectedDriver] = useState<{ id: string, name: string } | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // 오더 기록 필드 상태
  const [tempContractWriter, setTempContractWriter] = useState("");
  const [tempVehicleTransferred, setTempVehicleTransferred] = useState(false);
  const [tempContractConfirmed, setTempContractConfirmed] = useState(false);
  const [tempPurchasePrice, setTempPurchasePrice] = useState<number | null>(null);
  const [tempOldDealerFee, setTempOldDealerFee] = useState<number | null>(null);
  const [tempCustomerContact, setTempCustomerContact] = useState("");

  const API_BASE = process.env.NEXT_PUBLIC_API_ENDPOINT || 'http://localhost:4000/api/v1';

  // 세션에서 company 결정 (props 우선, 없으면 세션 기반)
  const effectiveCompany = companyFilter !== undefined ? companyFilter : (session?.user?.company ?? null);

  // 1. 신청 목록 가져오기 (발주사 필터 적용)
  const fetchBookings = useCallback(async () => {
    setIsLoading(true);
    try {
      const url = new URL(`${API_BASE}/external/request/list`);
      if (effectiveCompany) {
        url.searchParams.set('source', effectiveCompany);
      } else {
        // 전체(슈퍼관리자) 목록은 자체 신청(self-) 건도 기존처럼 같이 보여야 함 —
        // /list 기본값은 자체 신청을 제외하도록 바뀌어서 명시적으로 포함 요청
        url.searchParams.set('includeSelf', 'true');
      }
      const response = await fetch(url.toString());
      if (!response.ok) throw new Error();
      const result = await response.json();
      setData(result);
    } catch (err) {
      message.error("신청 목록 로드 실패");
    } finally {
      setIsLoading(false);
    }
  }, [API_BASE, effectiveCompany]);

  // 2. 진단사 목록 가져오기
  const fetchDrivers = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/drivers`);
      const result = await response.json();
      setDrivers(Array.isArray(result) ? result : []);
    } catch (err) {
      console.error("진단사 로드 실패", err);
    }
  }, [API_BASE]);

  // 3. 스마트옥션 매물 등록 여부 확인용 (bookingId → storeItemId)
  const fetchStoreItemMap = useCallback(async () => {
    try {
      const res = await fetch(`${CAVIOR_BASE}/api/admin/store-items`, { headers: INTERNAL_HEADERS });
      const items = res.ok ? await res.json() : [];
      const map: Record<number, string> = {};
      (Array.isArray(items) ? items : []).forEach((item: { bookingId?: number; id: string }) => {
        if (item.bookingId) map[item.bookingId] = item.id;
      });
      setStoreItemMap(map);
    } catch {
      // 매물 등록 상태 확인 실패해도 예약 목록 자체는 정상 표시
    }
  }, []);

  useEffect(() => {
    fetchBookings();
    fetchDrivers();
    // 스마트옥션 매물 컬럼은 슈퍼 관리자 뷰에서만 보이므로, 발주사 스코프 뷰에서는
    // 매물 조회 자체를 스킵 — 불필요한 API 호출과 store-items 데이터 노출을 줄임
    if (!effectiveCompany) fetchStoreItemMap();
  }, [fetchBookings, fetchDrivers, fetchStoreItemMap, effectiveCompany]);

  // --- 자동차등록증 원본 확인 (대시보드 로그인 계정만 — 공개 리포트 페이지엔 개인정보 보호를 위해 안 올림) ---
  const [loadingRegId, setLoadingRegId] = useState<number | null>(null);
  const handleViewRegistration = async (record: IBooking) => {
    setLoadingRegId(record.id);
    try {
      const res = await fetch(`${API_BASE}/external/inspection/report/${record.id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const url = data?.images?.registration?.[0];
      if (!url) {
        message.warning('등록증 사진이 없습니다.');
        return;
      }
      window.open(url, '_blank');
    } catch {
      message.error('등록증 조회 실패');
    } finally {
      setLoadingRegId(null);
    }
  };

  // --- 진단사/매니저 수정 요청 (SMS) ---
  const openRequestModal = (record: IBooking) => {
    setRequestTarget(record);
    setRequestCategory(undefined);
    setRequestMessage("");
    // 기본값: 원래 배정된 진단사. 필요하면 매니저 등 다른 대상으로 바꿀 수 있음
    const assigned = drivers.find(d => d.accountId === record.assignedDriverId);
    setRequestRecipientId(assigned?.id);
  };

  const handleSendRequest = async () => {
    if (!requestTarget) return;
    if (!requestRecipientId) { message.warning('받는 사람(진단사/매니저)을 선택해주세요.'); return; }
    setRequesting(true);
    try {
      const res = await fetch(`${API_BASE}/external/inspection/${requestTarget.id}/request-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...INTERNAL_HEADERS },
        body: JSON.stringify({ message: requestMessage, category: requestCategory, recipientDriverId: requestRecipientId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || '요청 실패');
      message.success(`${data.driverName ?? '담당자'}에게 수정 요청 SMS를 보냈습니다.`);
      setRequestTarget(null);
    } catch (e: any) {
      message.error(e.message || '수정 요청 중 오류가 발생했습니다.');
    } finally {
      setRequesting(false);
    }
  };

  // --- 모달 열기 ---
  const openModal = (record: IBooking) => {
    setEditingBooking(record);
    setTempMemo(record.adminMemo || "");
    setTempStatus(record.status);
    setTempCarNumber(record.carNumber || "");
    setTempCarOwner(record.carOwner || "");
    setTempCarModel(record.carModel || "");
    setTempDealerName(record.dealerName || "");
    setTempContact(record.contact || "");
    setTempAddress(record.address || "");
    setSelectedDriver(record.assignedDriverId ? { id: record.assignedDriverId, name: record.assignedDriverName || "" } : null);
    setTempContractWriter(record.contractWriter || "");
    setTempVehicleTransferred(record.vehicleTransferred ?? false);
    setTempContractConfirmed(record.contractConfirmed ?? false);
    setTempPurchasePrice(record.purchasePrice ?? null);
    setTempOldDealerFee(record.oldDealerFee ?? null);
    setTempCustomerContact(record.customerContact || "");
    setIsModalOpen(true);
  };

  // --- 💾 저장 로직 ---
  const handleUpdate = async () => {
    if (!editingBooking) return;
    setIsUpdating(true);
    try {
      // 상태 + 메모 + 오더 기록 통합 저장
      // 배정 초기화: selectedDriver가 null이고 기존에 배정돼 있었으면 PENDING 복원
      const wasAssigned = !!editingBooking.assignedDriverId;
      const isUnassigning = wasAssigned && !selectedDriver;

      await fetch(`${API_BASE}/external/request/${editingBooking.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: isUnassigning ? 'PENDING' : tempStatus,
          adminMemo: tempMemo,
          carNumber: tempCarNumber.trim() || '미정',
          carModel: tempCarModel.trim() || null,
          carOwner: tempCarOwner.trim() || '미정',
          dealerName: tempDealerName.trim(),
          contact: tempContact.trim(),
          address: tempAddress.trim(),
          contractWriter: tempContractWriter,
          vehicleTransferred: tempVehicleTransferred,
          contractConfirmed: tempContractConfirmed,
          purchasePrice: tempPurchasePrice,
          oldDealerFee: tempOldDealerFee,
          customerContact: tempCustomerContact.trim() || null,
          ...(isUnassigning ? { assignedDriverId: null, assignedDriverName: null } : {}),
        })
      });

      if (selectedDriver && selectedDriver.id !== editingBooking.assignedDriverId) {
        await fetch(`${API_BASE}/external/request/${editingBooking.id}/assign`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: selectedDriver.id, name: selectedDriver.name })
        });
      }

      message.success("성공적으로 변경되었습니다.");
      setIsModalOpen(false);
      fetchBookings();
    } catch (e) {
      message.error("저장 중 오류 발생");
    } finally {
      setIsUpdating(false);
    }
  };

  const statusConfig: any = {
    PENDING: { color: "orange", label: "대기중" },
    ASSIGNED: { color: "blue", label: "배정완료" },
    COMPLETED: { color: "green", label: "진단완료" },
    CANCELLED: { color: "red", label: "취소" },
  };

  // BookingSearch가 URL 쿼리로 넘긴 조건을 읽어 클라이언트 필터링
  const filteredData = useMemo(() => {
    const { searchType, searchText, status, adminMemo, searchDateType, dateStart, dateEnd } = router.query;

    return data.filter((item) => {
      // 검색어 필터
      if (searchText && searchType) {
        const text = String(searchText).toLowerCase();
        const field = item[searchType as keyof IBooking];
        if (!String(field ?? '').toLowerCase().includes(text)) return false;
      }

      // 상태 필터 (체크박스 복수 선택)
      if (status) {
        const statuses = Array.isArray(status) ? status : [status];
        if (!statuses.includes(item.status)) return false;
      }

      // 관리자 메모 필터
      if (adminMemo) {
        if (!item.adminMemo?.toLowerCase().includes(String(adminMemo).toLowerCase())) return false;
      }

      // 날짜 필터
      if (dateStart || dateEnd) {
        const dateField = searchDateType === 'preferredDate' ? item.preferredDateTime : item.createdAt;
        const itemDate = dayjs(dateField).format('YYYY-MM-DD');
        if (dateStart && itemDate < String(dateStart)) return false;
        if (dateEnd && itemDate > String(dateEnd)) return false;
      }

      return true;
    });
  }, [data, router.query]);

  // 스마트옥션 매물 등록/수정은 슈퍼 관리자 전용 기능 — 발주사 계정에서 보는
  // 회사 스코프 목록(companyFilter가 있는 경우)에서는 컬럼 자체를 숨긴다.
  const isSuperAdminView = !effectiveCompany;

  const columns: ColumnsType<IBooking> = [
    {
      title: "관리",
      key: "action",
      width: 80,
      align: "center",
      render: (_, record) => (
        <Button size="small" icon={<Eye size={14} />} onClick={() => openModal(record)}>
          상세
        </Button>
      ),
    },
    {
      title: "차량번호",
      dataIndex: "carNumber",
      align: "center",
      render: (value: string) => <span className="font-bold text-blue-600">{value}</span>,
    },
    {
      title: "차량명",
      dataIndex: "carModel",
      align: "center",
      render: (value?: string | null) => value || <span className="text-gray-300">-</span>,
    },
    {
      title: "딜러이름",
      dataIndex: "dealerName",
      align: "center",
      render: (value?: string) => value || <span className="text-gray-300">-</span>,
    },
    {
      title: "딜러번호",
      dataIndex: "contact",
      align: "center",
      render: (value?: string) => formatPhone(value) || <span className="text-gray-300">-</span>,
    },
    {
      title: "차주이름",
      dataIndex: "carOwner",
      align: "center",
      render: (value?: string) => value || <span className="text-gray-300">-</span>,
    },
    {
      title: "고객번호",
      dataIndex: "customerContact",
      align: "center",
      render: (value?: string | null) => formatPhone(value) || <span className="text-gray-300">-</span>,
    },
    {
      title: "출처",
      dataIndex: "source",
      align: "center",
      render: (value: string) => value ? <Tag>{value}</Tag> : <span className="text-gray-300">-</span>,
    },
    {
      title: "배정 진단사",
      dataIndex: "assignedDriverName",
      align: "center",
      render: (value: string, record: IBooking) => (
        <div className="flex flex-col items-center gap-1">
          {value
            ? <Tag icon={<UserPlus size={12} />} color="blue">{value}</Tag>
            : <span className="text-gray-300">미배정</span>
          }
          {record.cancelledByDriverAt && (
            <Tag color="volcano" className="text-xs">🔄 재대기중</Tag>
          )}
        </div>
      ),
    },
    {
      title: "계약서 작성자",
      dataIndex: "contractWriter",
      align: "center",
      render: (value: string) => value || <span className="text-gray-300">-</span>,
    },
    {
      title: "차량 이전",
      dataIndex: "vehicleTransferred",
      align: "center",
      render: (value: boolean) => value ? <Tag color="green">완료</Tag> : <Tag color="default">미완료</Tag>,
    },
    {
      title: "계약상태",
      dataIndex: "contractConfirmed",
      align: "center",
      render: (value: boolean) => value ? <Tag color="blue">확인</Tag> : <Tag color="default">미확인</Tag>,
    },
    {
      title: "매입가",
      dataIndex: "purchasePrice",
      align: "center",
      render: (value: number | null) => value != null ? <span className="font-bold">{value.toLocaleString()}만원</span> : <span className="text-gray-300">-</span>,
    },
    {
      title: "구전",
      dataIndex: "oldDealerFee",
      align: "center",
      render: (value: number | null) => value != null ? <span className="font-bold text-purple-600">{value.toLocaleString()}만원</span> : <span className="text-gray-300">-</span>,
    },
    {
      title: "상태",
      dataIndex: "status",
      align: "center",
      render: (status: string) => {
        const config = statusConfig[status] || { color: "default", label: status };
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: "접수일",
      dataIndex: "createdAt",
      align: "center",
      render: (value: ISO8601DateTime) => dayjs(value).format("YYYY-MM-DD"),
    },
    {
      title: "진단일시",
      dataIndex: "preferredDateTime",
      align: "center",
      // 소스마다 구분자가 다를 수 있어("YYYY-MM-DD HH:mm" vs "YYYY-MM-DDTHH:mm") 비교 전에 통일
      sorter: (a, b) => (a.preferredDateTime || '').replace('T', ' ').localeCompare((b.preferredDateTime || '').replace('T', ' ')),
      defaultSortOrder: "ascend",
      render: (value: string | null) => value ? <span className="text-red-500 font-bold">{value}</span> : <span className="text-gray-300">-</span>,
    },
    {
      title: "진단 리포트",
      key: "report",
      width: 200,
      align: "center",
      render: (_, record) => (
        <div className="flex items-center justify-center gap-1.5">
          <Button
            size="small"
            type="primary"
            ghost
            disabled={record.status !== 'COMPLETED' || !record.carHash}
            icon={<Eye size={14} />}
            onClick={() => window.open(`/report/${record.carHash}`, '_blank')}
          >
            리포트 보기
          </Button>
          <Button
            size="small"
            disabled={record.status !== 'COMPLETED' || isReportEditExpired(record)}
            icon={<PenSquare size={14} />}
            onClick={() => router.push(`/report/edit?bookingId=${record.id}`)}
          >
            {isReportEditExpired(record) ? '수정마감' : '리포트 수정'}
          </Button>
        </div>
      ),
    },
    {
      title: "등록증",
      key: "registration",
      width: 110,
      align: "center",
      render: (_, record) => (
        <Button
          size="small"
          disabled={record.status !== 'COMPLETED'}
          loading={loadingRegId === record.id}
          icon={<FileText size={14} />}
          onClick={() => handleViewRegistration(record)}
        >
          등록증 보기
        </Button>
      ),
    },
    ...(isSuperAdminView ? [{
      title: "스마트옥션 매물",
      key: "storeItem",
      width: 130,
      align: "center" as const,
      render: (_: unknown, record: IBooking) => {
        const storeItemId = storeItemMap[record.id];
        return (
          <Button
            size="small"
            type={storeItemId ? "default" : "primary"}
            style={storeItemId ? undefined : { background: "#7c3aed", borderColor: "#7c3aed" }}
            disabled={record.status !== 'COMPLETED'}
            icon={<PenSquare size={14} />}
            onClick={() => router.push(
              storeItemId ? `/store/register?storeItemId=${storeItemId}` : `/store/register?bookingId=${record.id}`
            )}
          >
            {storeItemId ? "매물 수정" : "매물 등록"}
          </Button>
        );
      },
    }] : []),
    {
      title: "수정 요청",
      key: "requestUpdate",
      width: 120,
      align: "center",
      render: (_, record) => (
        <Button
          size="small"
          danger
          disabled={record.status !== 'COMPLETED'}
          icon={<MessageSquare size={14} />}
          onClick={() => openRequestModal(record)}
        >
          수정 요청
        </Button>
      ),
    },
  ];

  return (
    <div className="p-4 bg-white rounded-lg shadow-sm">
      <DefaultTableBtn className="justify-between mb-4">
        <span className="text-gray-500">전체 {filteredData.length}건</span>
        <Button type="primary" icon={<RefreshCw size={14} />} onClick={fetchBookings} loading={isLoading}>새로고침</Button>
      </DefaultTableBtn>

      <div className="overflow-x-auto">
        <DefaultTable<IBooking>
          columns={columns}
          dataSource={filteredData}
          loading={isLoading}
          rowKey="id"
          rowClassName={(record) =>
            record.vehicleTransferred && record.contractConfirmed
              ? "bg-blue-50"
              : record.vehicleTransferred
                ? "bg-green-50"
                : ""
          }
        />
      </div>

      <Modal
        title={`진단 관리 - ${editingBooking?.carNumber}`}
        open={isModalOpen}
        onOk={handleUpdate}
        onCancel={() => setIsModalOpen(false)}
        confirmLoading={isUpdating}
        okText="변경사항 저장"
        cancelText="취소"
        width={560}
      >
        <div className="space-y-4 py-4">
          {/* 기본 정보 */}
          <div className="p-3 bg-gray-50 rounded-lg text-sm space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">딜러이름</label>
                <Input
                  value={tempDealerName}
                  onChange={e => setTempDealerName(e.target.value)}
                  placeholder="딜러이름"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">딜러번호</label>
                <Input
                  value={tempContact}
                  onChange={e => setTempContact(e.target.value)}
                  placeholder="딜러번호"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">주소</label>
              <Input
                value={tempAddress}
                onChange={e => setTempAddress(e.target.value)}
                placeholder="주소"
              />
            </div>
            <p className="text-gray-500">진단시작시간: {editingBooking?.preferredDateTime || "-"}</p>
            <p className="text-gray-500">
              진단완료일시: {editingBooking?.firstCompletedAt ? dayjs(editingBooking.firstCompletedAt).format("YYYY-MM-DD HH:mm") : "-"}
              {(() => {
                const duration = formatDuration(editingBooking?.preferredDateTime, editingBooking?.firstCompletedAt);
                return duration ? <span className="text-gray-400"> (소요시간: {duration})</span> : null;
              })()}
            </p>
            {editingBooking?.source && (
              <p className="text-gray-400">출처: <Tag>{editingBooking.source}</Tag></p>
            )}
          </div>

          {/* 차량번호 / 차주 성함 — 간편신청에서 "미정"으로 들어온 건 여기서 채워넣기 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">차량번호</label>
              <Input
                value={tempCarNumber}
                onChange={e => setTempCarNumber(e.target.value)}
                placeholder="차량번호"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">차주 성함</label>
              <Input
                value={tempCarOwner}
                onChange={e => setTempCarOwner(e.target.value)}
                placeholder="차주 성함"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">차량명</label>
            <Input
              value={tempCarModel}
              onChange={e => setTempCarModel(e.target.value)}
              placeholder="예: 그랜저 IG"
            />
          </div>

          {/* 상태 변경 */}
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">상태 변경</label>
            <Select
              className="w-full"
              value={tempStatus}
              onChange={setTempStatus}
              options={Object.keys(statusConfig).map(key => ({ value: key, label: statusConfig[key].label }))}
            />
          </div>

          {/* 진단사 배정 */}
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">진단사 배정</label>
            <div className="flex gap-2">
              <Select
                className="flex-1"
                placeholder="진단사 선택"
                value={selectedDriver?.id}
                onChange={(val, opt: any) => setSelectedDriver({ id: String(val), name: opt.label })}
                options={drivers.map(d => ({ value: d.id, label: d.name }))}
                allowClear
                onClear={() => setSelectedDriver(null)}
              />
              {selectedDriver && (
                <Button
                  danger
                  onClick={() => {
                    setSelectedDriver(null);
                    setTempStatus('PENDING');
                  }}
                >
                  배정 초기화
                </Button>
              )}
            </div>
            {editingBooking?.cancelledByDriverAt && (
              <p className="text-xs text-orange-500 mt-1">
                🔄 진단사 취소로 재대기 중 ({dayjs(editingBooking.cancelledByDriverAt).format('MM/DD HH:mm')})
              </p>
            )}
          </div>

          {/* 오더 기록 구분선 */}
          <div className="border-t pt-4">
            <p className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">오더 기록</p>

            {/* 계약서 작성자 */}
            <div className="mb-3">
              <label className="block text-xs font-bold text-gray-400 mb-1">계약서 작성자</label>
              <Input
                value={tempContractWriter}
                onChange={e => setTempContractWriter(e.target.value)}
                placeholder="작성자 성함"
              />
            </div>

            {/* 고객번호 — 접수 시 받은 contact(신청자 번호)와 별개로, 계약 진행 중 확인한 실제 차주 연락처 */}
            <div className="mb-3">
              <label className="block text-xs font-bold text-gray-400 mb-1">고객번호 (차주 연락처)</label>
              <Input
                value={tempCustomerContact}
                onChange={e => setTempCustomerContact(e.target.value)}
                placeholder="01012345678"
              />
            </div>

            {/* 매입가 */}
            <div className="mb-3">
              <label className="block text-xs font-bold text-gray-400 mb-1">매입가 (만원)</label>
              <InputNumber
                className="w-full"
                value={tempPurchasePrice}
                onChange={val => setTempPurchasePrice(val)}
                placeholder="예: 1500"
                min={0}
                formatter={val => val ? `${Number(val).toLocaleString()}` : ''}
              />
            </div>

            {/* 구전 금액 */}
            <div className="mb-3">
              <label className="block text-xs font-bold text-gray-400 mb-1">구전 (만원)</label>
              <InputNumber
                className="w-full"
                value={tempOldDealerFee}
                onChange={val => setTempOldDealerFee(val)}
                placeholder="예: 50"
                min={0}
                formatter={val => val ? `${Number(val).toLocaleString()}` : ''}
              />
            </div>

            <Checkbox
              checked={tempVehicleTransferred}
              onChange={e => setTempVehicleTransferred(e.target.checked)}
            >
              차량 이전 완료
            </Checkbox>

            <Checkbox
              className="ml-4"
              checked={tempContractConfirmed}
              onChange={e => setTempContractConfirmed(e.target.checked)}
            >
              계약 확인 완료
            </Checkbox>
          </div>

          {/* 관리자 메모 */}
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">관리자 메모</label>
            <Input.TextArea value={tempMemo} onChange={e => setTempMemo(e.target.value)} rows={3} placeholder="진단사에게 전달할 내용을 입력하세요." />
          </div>
        </div>
      </Modal>

      {/* 진단사/매니저 수정 요청 모달 */}
      <Modal
        title={`수정 요청 — ${requestTarget?.carNumber}`}
        open={!!requestTarget}
        onOk={handleSendRequest}
        onCancel={() => setRequestTarget(null)}
        confirmLoading={requesting}
        okText="SMS 보내기"
        okButtonProps={{ danger: true }}
        cancelText="취소"
      >
        <div className="py-2 space-y-3">
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">받는 사람</label>
            <Select
              className="w-full"
              placeholder="진단사 또는 진단매니저 선택"
              value={requestRecipientId}
              onChange={setRequestRecipientId}
              options={drivers.map(d => ({
                value: d.id,
                label: String(d.id) === requestTarget?.assignedDriverId ? `${d.name} (배정 진단사)` : d.name,
              }))}
              showSearch
              optionFilterProp="label"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">사진 카테고리 (선택)</label>
            <Select
              className="w-full"
              allowClear
              placeholder="어느 부분인지 선택"
              value={requestCategory}
              onChange={setRequestCategory}
              options={[
                { value: '외관', label: '외관' },
                { value: '실내', label: '실내' },
                { value: '엔진룸', label: '엔진룸' },
                { value: '휠', label: '휠' },
                { value: '하부', label: '하부' },
                { value: '계기판', label: '계기판' },
                { value: '손상', label: '손상' },
                { value: '기타', label: '기타' },
              ]}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">전달할 내용 (선택)</label>
            <Input.TextArea
              value={requestMessage}
              onChange={e => setRequestMessage(e.target.value)}
              rows={3}
              placeholder="예: 2번째 사진이 흐릿해서 재촬영이 필요해요. (비워두면 기본 안내문구로 발송)"
            />
          </div>
          <p className="text-[11px] text-gray-400">
            링크 없이 짧은 안내 SMS만 발송돼요 — 받는 사람이 앱에서 직접 &ldquo;진단 내역 보기 → 수정하기&rdquo;로 들어가서 확인해야 해요.
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default React.memo(BookingList);
