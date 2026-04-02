'use client';

import DefaultTable from "@/components/shared/ui/default-table";
import DefaultTableBtn from "@/components/shared/ui/default-table-btn";
import { ISO8601DateTime } from "@/types/common";
import { Button, Checkbox, Input, InputNumber, Modal, Select, Tag, message } from "antd";
import { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { Eye, RefreshCw, UserPlus } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import React, { useCallback, useEffect, useMemo, useState } from "react";

// --- 인터페이스 정의 ---
interface IDriver {
  accountId: string;
  name: string;
  status: string;
}

interface IBooking {
  id: number;
  carNumber: string;
  carOwner: string;
  dealerName: string;
  contact: string;
  address: string;
  preferredDateTime: string;
  source?: string;
  status: 'PENDING' | 'ASSIGNED' | 'COMPLETED' | 'CANCELLED';
  adminMemo?: string;
  assignedDriverId?: string;
  assignedDriverName?: string;
  // 오더 기록 필드
  contractWriter?: string;       // 계약서 작성자
  vehicleTransferred?: boolean;  // 차량 이전 여부
  purchasePrice?: number | null; // 매입가 (만원)
  isOldDealerPurchase?: boolean; // 구전 매입 여부
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

  // --- 상세/수정 모달 상태 ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<IBooking | null>(null);
  const [tempMemo, setTempMemo] = useState("");
  const [tempStatus, setTempStatus] = useState<IBooking['status']>('PENDING');
  const [selectedDriver, setSelectedDriver] = useState<{ id: string, name: string } | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // 오더 기록 필드 상태
  const [tempContractWriter, setTempContractWriter] = useState("");
  const [tempVehicleTransferred, setTempVehicleTransferred] = useState(false);
  const [tempPurchasePrice, setTempPurchasePrice] = useState<number | null>(null);
  const [tempIsOldDealerPurchase, setTempIsOldDealerPurchase] = useState(false);

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

  useEffect(() => {
    fetchBookings();
    fetchDrivers();
  }, [fetchBookings, fetchDrivers]);

  // --- 모달 열기 ---
  const openModal = (record: IBooking) => {
    setEditingBooking(record);
    setTempMemo(record.adminMemo || "");
    setTempStatus(record.status);
    setSelectedDriver(record.assignedDriverId ? { id: record.assignedDriverId, name: record.assignedDriverName || "" } : null);
    setTempContractWriter(record.contractWriter || "");
    setTempVehicleTransferred(record.vehicleTransferred ?? false);
    setTempPurchasePrice(record.purchasePrice ?? null);
    setTempIsOldDealerPurchase(record.isOldDealerPurchase ?? false);
    setIsModalOpen(true);
  };

  // --- 💾 저장 로직 ---
  const handleUpdate = async () => {
    if (!editingBooking) return;
    setIsUpdating(true);
    try {
      // 상태 + 메모 + 오더 기록 통합 저장
      await fetch(`${API_BASE}/external/request/${editingBooking.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: tempStatus,
          adminMemo: tempMemo,
          contractWriter: tempContractWriter,
          vehicleTransferred: tempVehicleTransferred,
          purchasePrice: tempPurchasePrice,
          isOldDealerPurchase: tempIsOldDealerPurchase,
        })
      });

      if (selectedDriver) {
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
    const { searchType, searchText, status, adminMemo } = router.query;

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

      return true;
    });
  }, [data, router.query]);

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
      render: (value: string) => <span className="font-bold text-blue-600">{value}</span>,
    },
    {
      title: "출처",
      dataIndex: "source",
      render: (value: string) => value ? <Tag>{value}</Tag> : <span className="text-gray-300">-</span>,
    },
    {
      title: "배정 진단사",
      dataIndex: "assignedDriverName",
      render: (value: string) => value ? <Tag icon={<UserPlus size={12} />} color="blue">{value}</Tag> : <span className="text-gray-300">미배정</span>,
    },
    {
      title: "계약서 작성자",
      dataIndex: "contractWriter",
      render: (value: string) => value || <span className="text-gray-300">-</span>,
    },
    {
      title: "차량 이전",
      dataIndex: "vehicleTransferred",
      align: "center",
      render: (value: boolean) => value ? <Tag color="green">완료</Tag> : <Tag color="default">미완료</Tag>,
    },
    {
      title: "매입가",
      dataIndex: "purchasePrice",
      align: "right",
      render: (value: number | null) => value != null ? <span className="font-bold">{value.toLocaleString()}만원</span> : <span className="text-gray-300">-</span>,
    },
    {
      title: "구전",
      dataIndex: "isOldDealerPurchase",
      align: "center",
      render: (value: boolean) => value ? <Tag color="purple">구전</Tag> : <span className="text-gray-300">-</span>,
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
      render: (value: ISO8601DateTime) => dayjs(value).format("YYYY-MM-DD"),
    },
    {
      title: "진단 리포트",
      key: "report",
      width: 120,
      align: "center",
      render: (_, record) => (
        <Button
          size="small"
          type="primary"
          ghost
          disabled={record.status !== 'COMPLETED'}
          icon={<Eye size={14} />}
          onClick={() => window.open(`/report/${record.id}`, '_blank')}
        >
          리포트 보기
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

      <DefaultTable<IBooking>
        columns={columns}
        dataSource={filteredData}
        loading={isLoading}
        rowKey="id"
      />

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
          <div className="p-3 bg-gray-50 rounded-lg text-sm">
            <p className="mb-1 font-medium">딜러: {editingBooking?.dealerName} ({editingBooking?.contact})</p>
            <p className="text-gray-500">주소: {editingBooking?.address}</p>
            {editingBooking?.source && (
              <p className="text-gray-400 mt-1">출처: <Tag>{editingBooking.source}</Tag></p>
            )}
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
            <Select
              className="w-full"
              placeholder="진단사 선택"
              value={selectedDriver?.id}
              onChange={(val, opt: any) => setSelectedDriver({ id: val, name: opt.label })}
              options={drivers.map(d => ({ value: d.accountId, label: d.name }))}
            />
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

            {/* 체크박스 그룹 */}
            <div className="flex gap-6">
              <Checkbox
                checked={tempVehicleTransferred}
                onChange={e => setTempVehicleTransferred(e.target.checked)}
              >
                차량 이전 완료
              </Checkbox>
              <Checkbox
                checked={tempIsOldDealerPurchase}
                onChange={e => setTempIsOldDealerPurchase(e.target.checked)}
              >
                구전 매입
              </Checkbox>
            </div>
          </div>

          {/* 관리자 메모 */}
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">관리자 메모</label>
            <Input.TextArea value={tempMemo} onChange={e => setTempMemo(e.target.value)} rows={3} placeholder="진단사에게 전달할 내용을 입력하세요." />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default React.memo(BookingList);
