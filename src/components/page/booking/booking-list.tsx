'use client';

import DefaultTable from "@/components/shared/ui/default-table";
import DefaultTableBtn from "@/components/shared/ui/default-table-btn";
import { ISO8601DateTime } from "@/types/common";
import { Alert, Button, Checkbox, Image, Input, InputNumber, Modal, Popconfirm, Popover, Select, Spin, Switch, Tag, message } from "antd";
import { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { Copy, Eye, FileText, MessageSquare, PenSquare, RefreshCw, UserPlus } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  tier?: 'general' | 'certified' | 'agent';
  canHandleOutsourced?: boolean;
}

// 등급별 기본 진단비(원) — 진단사 정산(앱 정산내역)의 기준 금액
const BASE_FEE_BY_TIER: Record<string, number> = { general: 50000, certified: 60000, agent: 65000 };

interface IBooking {
  id: number;
  carNumber: string;
  carModel?: string | null;
  carSpecManufacturer?: string | null;
  carSpecModel?: string | null;
  carSpecBadge?: string | null;
  estPriceLow?: number | null;
  estPriceHigh?: number | null;
  estPriceDepLow?: number | null;
  estPriceDepHigh?: number | null;
  estPriceDepPct?: number | null;
  carOwner: string;
  dealerName: string;
  dealerContact?: string | null;
  listingUrl?: string | null;
  contact: string;
  address: string;
  preferredDateTime: string;
  source?: string;
  status: 'PENDING' | 'ASSIGNED' | 'COMPLETED' | 'CANCELLED';
  carHash?: string | null;
  firstCompletedAt?: string | null;
  adminMemo?: string;
  additionalMemo?: string | null; // 접수폼(간편신청/당근 등)에서 딜러가 직접 입력한 요청사항 원본
  assignedDriverId?: string | null;
  assignedDriverName?: string | null;
  cancelledByDriverAt?: string | null; // 진단사 취소로 재대기된 시각
  driverSeenAt?: string | null; // 배정된 진단사가 앱에서 이 건 상세를 처음 연 시각(자동배정 놓침 확인용)
  reviewRequestedAt?: string | null; // 리뷰 요청 SMS 발송 시각(건당 1회만 발송 가능)
  assignedAt?: string | null; // 현재 배정이 이뤄진 시각
  assignSource?: 'auto' | 'manual' | 'agent' | 'self' | null; // 현재 배정 경로
  assignedByAgentId?: string | null; // 이 건을 다른 평가사에게 지정 배정한 에이전트 id
  agentBonus?: number | null; // 에이전트 관리수당(원)
  agentBonusMemo?: string | null;
  companyBillingAmount?: number | null; // 발주사 청구액(VAT포함, 원) 직접입력 — 오지/수입차 등 예외건용
  transferredRegistrationUrl?: string | null; // 발주사가 직접 업로드하는 명의이전된 등록증 사진
  registrationSentToDealerAt?: string | null; // 딜러에게 등록증 SMS를 보낸 시각(건당 1회 제한)
  registrationSentToCustomerAt?: string | null; // 고객에게 등록증 SMS를 보낸 시각(건당 1회 제한)
  // 오더 기록 필드
  contractWriter?: string;
  vehicleTransferred?: boolean;
  contractConfirmed?: boolean; // 계약 상태 확인 여부(계약완료 확인/미확인)
  purchasePrice?: number | null; // 계약금+잔금 합계로 자동 계산됨
  contractDeposit?: number | null; // 계약금 (만원)
  contractBalance?: number | null; // 잔금 (만원)
  purchasePriceSeen?: boolean; // false면 새로 적힌 값(목록에서 빨간색), 클릭해서 확인하면 true
  contractDepositSeen?: boolean; // 계약금 전용 확인 여부 — purchasePriceSeen과 별개
  isOldDealerPurchase?: boolean;
  oldDealerFee?: number | null; // 구전 금액 (만원)
  oldDealerFeeSeen?: boolean;
  customerContact?: string | null; // 계약팀이 직접 확인·기록하는 차주(고객) 연락처
  // 진단사 정산(오지/준오지/긴급 추가금, 기타 비용, 클레임 차감) — 슈퍼관리자 전용
  remoteBonus?: number | null;
  extraFee?: number | null;
  extraFeeMemo?: string | null;
  claimDeduction?: number | null;
  isUrgent?: boolean; // 관리자가 "긴급·당일배정"으로 전체 브로드캐스트한 건
  // /inspection(검차 신청 결제) 계좌이체 건 전용 — 입금 확인 전까지 자동배정/브로드캐스트 보류됨
  paymentMethod?: string | null;
  depositConfirmed?: boolean;
  // 접수 시점에 1회 계산되는 거리 진단(참고용 표시 전용, 배정 로직과 무관) — 관리자가
  // 오지/준오지 가격협상 여부, 긴급브로드캐스트 필요 여부를 판단하는 데 참고하는 뱃지
  nearestDriverKm?: number | null;
  remoteTier?: 'semi_remote' | 'remote' | null;
  urgentCandidate?: boolean;
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
  const [reportOnly, setReportOnly] = useState(false);
  const [purchasePriceOnly, setPurchasePriceOnly] = useState(false);
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
  const [broadcasting, setBroadcasting] = useState(false);
  const [confirmingDeposit, setConfirmingDeposit] = useState(false);
  const [retryingAutoAssign, setRetryingAutoAssign] = useState(false);

  // 오더 기록 필드 상태
  const [tempContractWriter, setTempContractWriter] = useState("");
  const [tempVehicleTransferred, setTempVehicleTransferred] = useState(false);
  const [tempContractConfirmed, setTempContractConfirmed] = useState(false);
  const [tempContractDeposit, setTempContractDeposit] = useState<number | null>(null);
  const [tempContractBalance, setTempContractBalance] = useState<number | null>(null);
  const [tempOldDealerFee, setTempOldDealerFee] = useState<number | null>(null);
  const [tempCustomerContact, setTempCustomerContact] = useState("");
  // 진단 시작시간(방문예정) 수정 — 재배정/자동배정 로직에 영향을 주는 값이라 슈퍼관리자만 변경 가능
  const [tempPreferredDateTime, setTempPreferredDateTime] = useState("");

  // --- 진단일시 테이블 인라인 편집(모달 안 열고 셀에서 바로 수정) ---
  const [inlineEditingId, setInlineEditingId] = useState<number | null>(null);
  const [inlineDateTimeValue, setInlineDateTimeValue] = useState("");
  const [savingInlineDateTime, setSavingInlineDateTime] = useState(false);

  // 진단사 정산(오지/준오지/긴급 추가금, 기타 비용, 클레임 차감) — 슈퍼관리자 전용
  const [tempRemoteBonus, setTempRemoteBonus] = useState<number | null>(null);
  const [tempExtraFee, setTempExtraFee] = useState<number | null>(null);
  const [tempExtraFeeMemo, setTempExtraFeeMemo] = useState("");
  const [tempClaimDeduction, setTempClaimDeduction] = useState<number | null>(null);
  const [tempAgentBonus, setTempAgentBonus] = useState<number | null>(null);
  const [tempAgentBonusMemo, setTempAgentBonusMemo] = useState("");
  // 발주사 청구액(VAT포함, 원) 직접입력 — 오지/수입차 등 단가표에 고정값이 없는 예외건용.
  // 기본/준오지/긴급은 정산서(settlement.tsx)에서 고정 단가로 자동계산되므로 평소엔 비워둔다.
  const [tempCompanyBillingAmount, setTempCompanyBillingAmount] = useState<number | null>(null);

  // 주소 수정 — 접수 페이지(/inspection 등)와 동일하게 카카오 키워드검색으로.
  // 평소엔 접혀있다가(현재 주소만 텍스트로 표시) "변경" 눌렀을 때만 검색창이 펼쳐지게 해서
  // 모달이 불필요하게 커지지 않도록 함.
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<{ name: string; address: string }[]>([]);
  const [showPlaceResults, setShowPlaceResults] = useState(false);
  const [searchingPlace, setSearchingPlace] = useState(false);

  const searchPlace = async () => {
    if (!placeQuery.trim()) return;
    setSearchingPlace(true);
    try {
      const res = await fetch(
        `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(placeQuery)}`,
        { headers: { Authorization: 'KakaoAK 5d73c6482159874735a29becf6849e11' } },
      );
      const data = await res.json();
      const docs = (data?.documents ?? []).slice(0, 8).map((d: any) => ({
        name: d.place_name as string,
        address: (d.road_address_name || d.address_name) as string,
      }));
      setPlaceResults(docs);
      setShowPlaceResults(true);
    } catch {
      message.error('위치 검색 중 오류가 발생했습니다.');
    } finally {
      setSearchingPlace(false);
    }
  };

  const selectPlace = (p: { name: string; address: string }) => {
    setTempAddress(p.name ? `${p.address} (${p.name})` : p.address);
    setIsEditingAddress(false);
    setShowPlaceResults(false);
    setPlaceQuery("");
  };

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

  // --- 명의이전 등록증 전송 모달(애니원모터스 전용) — 수정요청 모달과 동일한 흐름:
  // 버튼 클릭 → 모달에서 사진 선택(미리보기) + 전송 대상(딜러/고객) 체크 + 번호 확인 → 보내기 ---
  // 대상별로 건당 1회만 전송 가능 — 이미 보낸 대상은 체크박스가 자동으로 꺼진다.
  // 둘 다 선택하지 않고 사진만 새로 올리면 SMS 없이 사진만 교체된다(잘못 올린 등록증 정정용 —
  // 이미 보낸 단축링크가 새 사진으로 그대로 반영되므로 재전송할 필요가 없다).
  const [registrationTarget, setRegistrationTarget] = useState<IBooking | null>(null);
  const [registrationFile, setRegistrationFile] = useState<File | null>(null);
  const [registrationPreview, setRegistrationPreview] = useState<string | null>(null);
  const [isDraggingRegistration, setIsDraggingRegistration] = useState(false);
  const registrationFileInputRef = useRef<HTMLInputElement>(null);
  const [registrationMessage, setRegistrationMessage] = useState("이전된 차량등록증을 보내드립니다.");
  const [sendToDealer, setSendToDealer] = useState(false);
  const [sendToCustomer, setSendToCustomer] = useState(false);
  const [dealerPhone, setDealerPhone] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [uploadingRegistration, setUploadingRegistration] = useState(false);

  const openRegistrationModal = (record: IBooking) => {
    setRegistrationTarget(record);
    setRegistrationFile(null);
    setRegistrationPreview(null);
    setRegistrationMessage("이전된 차량등록증을 보내드립니다.");
    // 사무장님은 사진만 저장하고 전송은 담당자가 따로 하는 흐름이라, 열었을 때 체크박스를
    // 자동으로 켜두면 실수로 SMS가 나갈 수 있음 — 기본은 항상 꺼둔 채로 시작한다.
    setSendToDealer(false);
    setSendToCustomer(false);
    setDealerPhone(record.contact || "");
    setCustomerPhone(record.customerContact || "");
  };

  // 사진을 선택하는 즉시 SMS 전송 여부와 무관하게 바로 저장한다 — "올리기만 하고 창을
  // 닫아도 사라진다"는 문제를 막기 위해, 전송 확인 절차(OK 버튼→Modal.confirm)를 기다리지
  // 않고 선택 시점에 조용히 저장부터 해둔다. 이후 "보내기"는 이미 저장된 사진으로 SMS만 보냄.
  const handleSelectRegistrationFile = async (file: File) => {
    setRegistrationFile(file);
    setRegistrationPreview(URL.createObjectURL(file));
    if (!registrationTarget) return;
    setUploadingRegistration(true);
    try {
      const form = new FormData();
      form.append('photo', file);
      form.append('sendToDealer', 'false');
      form.append('sendToCustomer', 'false');
      const res = await fetch(`${API_BASE}/external/request/${registrationTarget.id}/transferred-registration`, {
        method: 'POST',
        body: form,
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      // 둘 다 미전송(sendToDealer/Customer=false)일 때 백엔드는 저장된 Booking을 그대로 반환함
      const savedUrl: string | undefined = data?.transferredRegistrationUrl;
      setRegistrationTarget(prev => prev && savedUrl ? { ...prev, transferredRegistrationUrl: savedUrl } : prev);
      message.success('사진을 저장했습니다.');
      fetchBookings();
    } catch {
      message.error('사진 저장에 실패했습니다.');
    } finally {
      setUploadingRegistration(false);
    }
  };

  // 실제 전송 전, 선택한 대상만큼 비용이 나간다는 걸 한 번 더 확인시키고
  // 여기서 취소하면(Cancel) 업로드 자체가 실행되지 않도록 함
  const confirmSendRegistration = () => {
    if (!registrationTarget?.transferredRegistrationUrl && !registrationFile) return;
    if (!sendToDealer && !sendToCustomer) return; // 사진 저장은 선택 즉시 이미 끝남 — 여기는 전송 전용
    const count = (sendToDealer ? 1 : 0) + (sendToCustomer ? 1 : 0);
    const content = `${[sendToDealer && '딜러', sendToCustomer && '고객'].filter(Boolean).join(', ')}에게 SMS가 발송되어 총 ${count * 50}원(건당 50원, VAT 포함)의 비용이 청구됩니다. 계속하시겠습니까?`;
    Modal.confirm({
      title: '등록증 전송 안내',
      content,
      okText: '보내기',
      cancelText: '취소',
      onOk: handleSendRegistration,
    });
  };

  const handleSendRegistration = async () => {
    if (!registrationTarget || (!registrationFile && !registrationTarget.transferredRegistrationUrl)) return;
    setUploadingRegistration(true);
    try {
      const form = new FormData();
      if (registrationFile) form.append('photo', registrationFile);
      form.append('message', registrationMessage);
      form.append('sendToDealer', String(sendToDealer));
      form.append('sendToCustomer', String(sendToCustomer));
      form.append('dealerPhone', dealerPhone);
      form.append('customerPhone', customerPhone);
      const res = await fetch(`${API_BASE}/external/request/${registrationTarget.id}/transferred-registration`, {
        method: 'POST',
        body: form,
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const failures: string[] = data?.sendFailures || [];
      if (!sendToDealer && !sendToCustomer) {
        message.success('사진을 교체했습니다.');
      } else if (failures.length > 0) {
        message.error(`일부 전송에 실패했습니다 — ${failures.join(' / ')}`);
      } else {
        message.success('등록증을 보냈습니다.');
      }
      setRegistrationTarget(null);
      fetchBookings();
    } catch {
      message.error('업로드 중 오류가 발생했습니다.');
    } finally {
      setUploadingRegistration(false);
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

  // 자체접수(source가 "self-{company}") ↔ 정상접수 전환 — source만 부분 수정
  const handleToggleSource = async (booking: IBooking) => {
    const isSelf = !!booking.source?.startsWith('self-');
    const nextSource = isSelf ? booking.source!.slice(5) : `self-${booking.source}`;
    try {
      await fetch(`${API_BASE}/external/request/${booking.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: nextSource })
      });
      message.success(isSelf ? "정상접수로 전환되었습니다." : "자체접수(외주)로 전환되었습니다.");
      setEditingBooking(prev => prev ? { ...prev, source: nextSource } : prev);
      fetchBookings();
    } catch (e) {
      message.error("전환 중 오류 발생");
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
    setIsEditingAddress(false);
    setPlaceQuery("");
    setShowPlaceResults(false);
    setSelectedDriver(record.assignedDriverId ? { id: record.assignedDriverId, name: record.assignedDriverName || "" } : null);
    setTempContractWriter(record.contractWriter || "");
    setTempVehicleTransferred(record.vehicleTransferred ?? false);
    setTempContractConfirmed(record.contractConfirmed ?? false);
    setTempContractDeposit(record.contractDeposit ?? null);
    setTempContractBalance(record.contractBalance ?? null);
    setTempOldDealerFee(record.oldDealerFee ?? null);
    setTempCustomerContact(record.customerContact || "");
    // 개인거래 등 일부 소스는 "YYYY-MM-DDTHH:mm" 형식으로 저장되어 있어 편집창에서도 통일해서 보여줌
    setTempPreferredDateTime((record.preferredDateTime || "").replace('T', ' '));
    // 오지/준오지/긴급 추가금은 아직 값이 없으면(처음 여는 경우) 기본 제안값을 미리 채워준다 —
    // 관리자가 그대로 저장하거나 수정할 수 있음. 이미 값이 저장돼 있으면 그 값 그대로 사용.
    // 오지·준오지·긴급 추가금 제안값 — 등급별로 다르다(일반은 +1만/+2만, 인증·에이전트는
    // 규정표 기준 +13,000/+25,000). settlement.tsx의 BONUS_BY_TIER, 앱 정산내역의
    // effectiveRemoteBonus와 반드시 같은 값이어야 세 화면 금액이 어긋나지 않는다.
    const bonusTier = drivers.find(d => String(d.id) === String(record.assignedDriverId))?.tier ?? 'general';
    const bonusRate = bonusTier === 'general'
      ? { semiRemote: 10000, remote: 20000, urgent: 10000 }
      : { semiRemote: 13000, remote: 25000, urgent: 13000 };
    const defaultRemoteBonus =
      (record.remoteTier === 'remote' ? bonusRate.remote : record.remoteTier === 'semi_remote' ? bonusRate.semiRemote : 0) +
      (record.isUrgent ? bonusRate.urgent : 0);
    setTempRemoteBonus(record.remoteBonus ?? (defaultRemoteBonus > 0 ? defaultRemoteBonus : null));
    setTempExtraFee(record.extraFee ?? null);
    setTempExtraFeeMemo(record.extraFeeMemo || "");
    setTempClaimDeduction(record.claimDeduction ?? null);
    // 에이전트 관리수당 — 에이전트가 지정 배정한 건(assignedByAgentId)만 해당. 배정 대상
    // 평가사 등급 기준 기본 제안값(일반 +1만원/진단평가사 +5천원)을 채워주되, 라운딩 이관
    // 등 등급으로 자동 판단이 안 되는 경우는 관리자가 직접 금액/메모를 입력한다.
    if (record.assignedByAgentId) {
      const assignedTier = drivers.find(d => String(d.id) === String(record.assignedDriverId))?.tier;
      const defaultAgentBonus = assignedTier === 'general' ? 10000 : assignedTier === 'certified' ? 5000 : null;
      setTempAgentBonus(record.agentBonus ?? defaultAgentBonus);
    } else {
      setTempAgentBonus(record.agentBonus ?? null);
    }
    setTempAgentBonusMemo(record.agentBonusMemo || "");
    setTempCompanyBillingAmount(record.companyBillingAmount ?? null);
    setIsModalOpen(true);
  };

  // --- 진단일시 테이블 인라인 편집 — 모달 안 열고 셀에서 바로 더블클릭→입력→저장 ---
  // 슈퍼관리자는 기존대로 항상 가능. 애니원 등 발주사 관리자는 진단평가사가 이미 배정된
  // 건만 가능(배정 전 건은 자동배정 매칭에 영향 줄 수 있어 제외) — 백엔드 PATCH .../status는
  // preferredDateTime만 단독으로 보내면 재배정/거리뱃지 재계산 등 다른 로직을 안 건드림.
  const canEditPreferredDateTime = (record: IBooking) => isSuperAdminView || !!record.assignedDriverId;

  const startInlineDateTimeEdit = (record: IBooking) => {
    if (!canEditPreferredDateTime(record)) return;
    setInlineEditingId(record.id);
    setInlineDateTimeValue((record.preferredDateTime || "").replace('T', ' '));
  };

  const saveInlineDateTime = async (record: IBooking) => {
    const value = inlineDateTimeValue.trim();
    if (!value || value === (record.preferredDateTime || "").replace('T', ' ')) {
      setInlineEditingId(null);
      return;
    }
    setSavingInlineDateTime(true);
    try {
      await fetch(`${API_BASE}/external/request/${record.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferredDateTime: value }),
      });
      message.success("진단일시가 변경되었습니다.");
      setInlineEditingId(null);
      fetchBookings();
    } catch {
      message.error("저장 중 오류가 발생했습니다.");
    } finally {
      setSavingInlineDateTime(false);
    }
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
          purchasePrice: (tempContractDeposit || 0) + (tempContractBalance || 0),
          contractDeposit: tempContractDeposit,
          contractBalance: tempContractBalance,
          oldDealerFee: tempOldDealerFee,
          customerContact: tempCustomerContact.trim() || null,
          ...(isSuperAdminView ? {
            preferredDateTime: tempPreferredDateTime.trim() || editingBooking.preferredDateTime,
            remoteBonus: tempRemoteBonus,
            extraFee: tempExtraFee,
            extraFeeMemo: tempExtraFeeMemo.trim() || null,
            claimDeduction: tempClaimDeduction,
            agentBonus: tempAgentBonus,
            agentBonusMemo: tempAgentBonusMemo.trim() || null,
            companyBillingAmount: tempCompanyBillingAmount,
          } : {}),
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

  // 스케줄·활동중 여부와 무관하게 승인된 진단사 전원에게 강제 브로드캐스트 —
  // 자동배정이 실패한 당일 긴급 건을 위한 최후 수단(관리자 수동 트리거)
  const handleUrgentBroadcast = async () => {
    if (!editingBooking) return;
    setBroadcasting(true);
    try {
      await fetch(`${API_BASE}/external/request/${editingBooking.id}/urgent-broadcast`, {
        method: 'PATCH',
      });
      message.success("긴급·당일배정으로 전체 진단사에게 브로드캐스트했습니다.");
      fetchBookings();
    } catch (e) {
      message.error("브로드캐스트 중 오류 발생");
    } finally {
      setBroadcasting(false);
    }
  };

  // 계좌이체 신청 건은 입금 확인 전까지 자동배정/브로드캐스트가 보류돼 있다 —
  // 관리자가 실제 입금을 확인한 뒤 이 버튼을 눌러야 그제서야 배정이 진행된다.
  const handleConfirmDeposit = async () => {
    if (!editingBooking) return;
    setConfirmingDeposit(true);
    try {
      await fetch(`${API_BASE}/external/request/${editingBooking.id}/confirm-deposit`, {
        method: 'PATCH',
      });
      message.success("입금 확인 처리되었습니다. 배정을 진행합니다.");
      fetchBookings();
      setIsModalOpen(false);
    } catch (e) {
      message.error("입금 확인 처리 중 오류 발생");
    } finally {
      setConfirmingDeposit(false);
    }
  };

  // 슈퍼관리자 전용 — 주소/희망일시를 수정한 뒤 배정을 초기화하고 자동배정을 다시 태운다.
  // "장소변경+시간변경+배정초기화"를 손으로 반복하던 걸 버튼 하나로 묶은 것 — 사유 있는
  // 변경이므로 백엔드에서 기존 담당 진단사에게 페널티를 주지 않는다.
  const handleRetryAutoAssign = async () => {
    if (!editingBooking) return;
    setRetryingAutoAssign(true);
    try {
      await fetch(`${API_BASE}/external/request/${editingBooking.id}/retry-auto-assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: tempAddress.trim(),
          preferredDateTime: tempPreferredDateTime.trim(),
        }),
      });
      message.success("배정을 초기화하고 자동배정을 재시도했습니다.");
      setIsModalOpen(false);
      fetchBookings();
    } catch (e) {
      message.error("자동배정 재시도 중 오류 발생");
    } finally {
      setRetryingAutoAssign(false);
    }
  };

  // 계약상태를 상세 모달까지 안 들어가고 목록에서 태그 클릭 한 번으로 바로 토글 —
  // 체크박스 찾으러 상세 들어가는 게 불편하다는 피드백으로 추가. 즉시 반응하도록
  // 먼저 화면(data)을 낙관적으로 바꾸고, 실패하면 목록을 다시 불러와 원상복구한다.
  // 구매동행(카비어 검차) 완료 고객에게 리뷰 요청 SMS 발송 — 건당 1회만 가능(서버에서도 중복 차단)
  const [requestingReviewId, setRequestingReviewId] = useState<number | null>(null);
  const handleRequestReview = async (record: IBooking) => {
    setRequestingReviewId(record.id);
    try {
      const res = await fetch(`${API_BASE}/external/inspection/${record.id}/request-review`, {
        method: 'POST',
        headers: INTERNAL_HEADERS,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || '리뷰 요청 발송 실패');
      message.success("리뷰 요청 문자를 보냈습니다.");
      fetchBookings();
    } catch (e: any) {
      message.error(e.message || "리뷰 요청 발송 중 오류 발생");
    } finally {
      setRequestingReviewId(null);
    }
  };

  const handleToggleBoolField = async (
    record: IBooking,
    field: 'contractConfirmed' | 'vehicleTransferred' | 'purchasePriceSeen' | 'contractDepositSeen' | 'oldDealerFeeSeen',
    label: string,
  ) => {
    const next = !record[field];
    setData(prev => prev.map(b => b.id === record.id ? { ...b, [field]: next } : b));
    try {
      await fetch(`${API_BASE}/external/request/${record.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: next }),
      });
    } catch {
      message.error(`${label} 변경 중 오류 발생`);
      fetchBookings();
    }
  };

  // 자동배정 건이 진단사 앱 미확인(driverSeenAt 없음)으로 계속 남는 경우 — 관리자가 전화 등으로
  // 직접 확인시켰으면 여기서 수동으로 "확인" 처리(오클릭 시 다시 클릭하면 되돌릴 수 있음).
  const handleAdminConfirmSeen = async (record: IBooking) => {
    const next = record.driverSeenAt ? null : new Date().toISOString();
    setData(prev => prev.map(b => b.id === record.id ? { ...b, driverSeenAt: next } : b));
    try {
      await fetch(`${API_BASE}/external/request/${record.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverSeenAt: next }),
      });
    } catch {
      message.error('확인 처리 중 오류 발생');
      fetchBookings();
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
    const { searchType, searchText, status, adminMemo, searchDateType, dateStart, dateEnd, contractWriterMissing } = router.query;

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

      // 리포트 있는 건만 보기 토글 — 진단완료 + carHash(리포트 해시)가 실제로 있는 건만
      if (reportOnly && !(item.status === 'COMPLETED' && item.carHash)) return false;

      // 매입가 적혀있는 건만 보기 토글
      if (purchasePriceOnly && item.purchasePrice == null) return false;

      // "계약서 미작성 목록" 메뉴 전용 — 계약서 작성자가 비어있는 건만
      if (contractWriterMissing === 'true' && item.contractWriter) return false;

      return true;
    });
  }, [data, router.query, reportOnly, purchasePriceOnly]);

  // 스마트옥션 매물 등록/수정은 슈퍼 관리자 전용 기능 — 발주사 계정에서 보는
  // 회사 스코프 목록(companyFilter가 있는 경우)에서는 컬럼 자체를 숨긴다.
  const isSuperAdminView = !effectiveCompany;
  // 고객 직접신청(구매동행) 건은 딜러 계약 진행 여부를 관리할 대상이 아니라서
  // 계약상태/매입가/구전 컬럼이 의미가 없음 — 이 화면에서만 숨긴다.
  const isDirectConsumerView = effectiveCompany === 'CARVIOR_INSPECTION';
  // 명의이전 등록증 직접 업로드는 애니원모터스 전용 요청 기능.
  // "자체 진단 목록"은 source가 "self-anyone-motors"로 들어와서 그대로 비교하면 애니원모터스로
  // 인식되지 않아 등록증 열이 안 나왔다 — 자체 접수 건도 명의이전 등록증은 똑같이 보내야 하므로
  // self- 접두사를 떼고 판단한다.
  const isAnyoneMotors = (effectiveCompany || '').replace(/^self-/, '') === 'anyone-motors';
  // 매입팀 전용 화면 여부 — 계정에 붙은 플래그(users.isPurchaseTeam)를 그대로 쓴다.
  // 회사 코드로 판별하면 같은 회사의 대표·사무장까지 같이 걸려서 안 된다.
  const isPurchaseTeam = !!(session?.user as { isPurchaseTeam?: boolean } | undefined)?.isPurchaseTeam;
  // 매입가/구전 확인·미확인 토글 — 같은 회사에 관리자 계정이 여러 개일 때, 이 권한이
  // 있는 계정(예: 사무장)만 토글 가능하고 나머지는 조회만 가능하게 제한할 수 있다.
  // 슈퍼관리자는 항상 가능.
  const canConfirmBilling = isSuperAdminView || !!session?.user?.canConfirmBilling;
  // 구전은 계약금/매입가와 달리 애니원모터스 계정이면(사무장 권한 여부와 무관하게) 누구나 토글 가능
  const canConfirmOldDealerFee = canConfirmBilling || isAnyoneMotors;

  let columns: ColumnsType<IBooking> = [
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
    // 오지/준오지/긴급후보 뱃지는 내부 운영(가격협상 판단 등) 참고용 — 발주사(Anyone모터스 등)
    // 회사 스코프 목록에는 노출하지 않고 슈퍼 관리자에게만 보여준다.
    ...(isSuperAdminView ? [{
      title: "표시",
      key: "flags",
      align: "center" as const,
      render: (_: unknown, record: IBooking) => {
        const tags: React.ReactNode[] = [];
        if (record.paymentMethod === 'BANK_TRANSFER' && !record.depositConfirmed) {
          tags.push(
            <Tag key="pending-deposit" color="volcano">
              💰입금대기
            </Tag>,
          );
        }
        if (record.urgentCandidate && record.status === 'PENDING') {
          tags.push(
            <Tag key="urgent-candidate" color="gold">
              ⚡긴급후보
            </Tag>,
          );
        }
        if (record.remoteTier === 'remote') {
          tags.push(
            <Tag key="remote" color="red">
              🏔오지{record.nearestDriverKm != null ? ` (${record.nearestDriverKm}km)` : ''}
            </Tag>,
          );
        } else if (record.remoteTier === 'semi_remote') {
          tags.push(
            <Tag key="semi-remote" color="orange">
              🗺준오지{record.nearestDriverKm != null ? ` (${record.nearestDriverKm}km)` : ''}
            </Tag>,
          );
        }
        return tags.length > 0 ? <div className="flex flex-col gap-1 items-center">{tags}</div> : <span className="text-gray-300">-</span>;
      },
    }] : []),
    {
      title: "차량명",
      dataIndex: "carModel",
      align: "center",
      render: (value: string | null | undefined, record: IBooking) => {
        const specParts = [record.carSpecManufacturer, record.carSpecModel, record.carSpecBadge].filter(Boolean);
        // 예상시세는 매입 판단 참고용이라 SUPER_ADMIN에게만 노출(데모 단계, 진단사 앱과 동일 계산값을
        // 등급 선택 시점에 저장해둔 걸 그대로 보여줌 — 여기서 재계산하지 않음).
        const hasEstimate = isSuperAdminView && record.estPriceLow != null && record.estPriceHigh != null;
        return (
          <div className="flex flex-col items-center">
            <span>{value || <span className="text-gray-300">-</span>}</span>
            {specParts.length > 0 && (
              <span className="text-xs text-gray-400 mt-0.5">{specParts.join(" ")}</span>
            )}
            {hasEstimate && (
              <div className="mt-1 text-xs">
                <span className="text-gray-500">
                  시세 {record.estPriceLow!.toLocaleString()}~{record.estPriceHigh!.toLocaleString()}만
                </span>
                {record.estPriceDepLow != null && record.estPriceDepHigh != null && (
                  <div className="text-purple-500 font-semibold">
                    감가 {record.estPriceDepLow.toLocaleString()}~{record.estPriceDepHigh.toLocaleString()}만
                    {record.estPriceDepPct != null && ` (-${record.estPriceDepPct}%)`}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      },
    },
    // 시세(참고)는 슈퍼관리자뿐 아니라 발주사 계정도 볼 수 있음 — 페이지 안에서
    // 매입가 입력/등급 재선택 등 내부 전용 조작은 isSuperAdmin으로 추가 가드됨.
    {
      title: "시세(참고)",
      key: "specPrice",
      align: "center" as const,
      render: (_: unknown, record: IBooking) => (
        <Link href={`/booking/${record.id}/price`} target="_blank">
          <Button size="small">
            {record.carSpecManufacturer ? "시세 보기" : isSuperAdminView ? "등급 등록" : "미등록"}
          </Button>
        </Link>
      ),
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
    ...(isDirectConsumerView ? [{
      title: "매물링크",
      dataIndex: "listingUrl",
      align: "center" as const,
      render: (value?: string | null) =>
        value ? <a href={value} target="_blank" rel="noreferrer" className="text-blue-600 underline">보기</a> : <span className="text-gray-300">-</span>,
    }] : []),
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
      title: "진단 리포트",
      key: "report",
      width: 280,
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
            disabled={record.status !== 'COMPLETED'}
            loading={loadingRegId === record.id}
            icon={<FileText size={14} />}
            onClick={() => handleViewRegistration(record)}
          >
            등록증 보기
          </Button>
          <Button
            size="small"
            disabled={record.status !== 'COMPLETED' || isReportEditExpired(record)}
            icon={<PenSquare size={14} />}
            onClick={() => router.push(`/report/edit?bookingId=${record.id}`)}
          >
            {isReportEditExpired(record) ? '수정마감' : '리포트 수정'}
          </Button>
          {record.source === 'CARVIOR_INSPECTION' && (
            <Button
              size="small"
              disabled={record.status !== 'COMPLETED' || !record.carHash || !!record.reviewRequestedAt}
              loading={requestingReviewId === record.id}
              onClick={() => handleRequestReview(record)}
            >
              {record.reviewRequestedAt ? '요청 완료' : '리뷰 요청'}
            </Button>
          )}
        </div>
      ),
    },
    {
      title: "배정 진단사",
      dataIndex: "assignedDriverName",
      align: "center",
      render: (value: string, record: IBooking) => {
        const assignedDriver = drivers.find(d => String(d.id) === String(record.assignedDriverId));
        const phone = assignedDriver?.phone;
        return (
          <div className="flex flex-col items-center gap-1">
            {value
              ? (
                <Popover
                  trigger="hover"
                  content={
                    phone ? (
                      <div className="flex items-center gap-2">
                        <a href={`tel:${phone}`} className="text-lg font-bold text-gray-900 hover:text-violet-600">
                          {phone}
                        </a>
                        <Button
                          size="small"
                          icon={<Copy size={13} />}
                          onClick={() => {
                            navigator.clipboard.writeText(phone);
                            message.success("번호가 복사되었습니다.");
                          }}
                        >
                          복사
                        </Button>
                      </div>
                    ) : (
                      <span className="text-gray-400">번호 없음</span>
                    )
                  }
                >
                  <Tag icon={<UserPlus size={12} />} color="blue">{value}</Tag>
                </Popover>
              )
              : <span className="text-gray-300">미배정</span>
            }
            {record.cancelledByDriverAt && (
              <Tag color="volcano" className="text-xs">🔄 재대기중</Tag>
            )}
            {/* 자동배정 알림톡을 놓칠 수 있어서 추가한 확인 여부 표시 — 배정 상태(ASSIGNED)일 때만
                의미가 있음(완료되면 어차피 이미 확인하고 진단까지 마친 것이므로 표시하지 않음).
                수동배정/셀프클레임은 진단사가 이미 그 순간에 인지한 배정이므로 배정 시각을
                그대로 "확인" 시각으로 표시 — driverSeenAt(앱에서 연락하기/시간변경 등 반응)은
                자동배정 건에만 의미가 있음. 자동배정 건은 진단사가 앱을 안 열어도(예: 관리자가
                전화로 직접 확인시킨 경우) 태그를 클릭하면 수동으로 확인 처리할 수 있다(다시
                클릭하면 되돌림) — driverSeenAt은 "앱에서 열었다"뿐 아니라 "어떤 식으로든
                확인됐다"는 의미로 확장해서 씀. */}
            {value && record.status === 'ASSIGNED' && (
              record.assignSource === 'manual' || record.assignSource === 'self'
                ? <Tag color="green" className="text-xs">✅ 확인 {record.assignedAt ? dayjs(record.assignedAt).format('MM/DD HH:mm') : ''}</Tag>
                : record.driverSeenAt
                  ? (
                    <Tag
                      color="green"
                      className="text-xs"
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleAdminConfirmSeen(record)}
                    >
                      ✅ 확인 {dayjs(record.driverSeenAt).format('MM/DD HH:mm')}
                    </Tag>
                  )
                  : (
                    <Tag
                      color="red"
                      className="text-xs"
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleAdminConfirmSeen(record)}
                    >
                      👀 미확인 (클릭해서 확인처리)
                    </Tag>
                  )
            )}
          </div>
        );
      },
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
      render: (value: boolean, record: IBooking) => (
        <Tag
          color={value ? "blue" : "red"}
          style={{ cursor: "pointer", fontWeight: 700 }}
          onClick={() => handleToggleBoolField(record, "vehicleTransferred", "차량 이전")}
        >
          {value ? "완료" : "미완료"}
        </Tag>
      ),
    },
    // 계약상태/매입가/구전은 딜러 계약 진행을 관리하기 위한 컬럼 — 고객 직접신청(구매동행)
    // 건은 딜러 계약 자체가 없어서 의미가 없으므로 이 화면에서는 숨긴다.
    ...(!isDirectConsumerView ? [{
      title: "계약상태",
      dataIndex: "contractConfirmed",
      align: "center" as const,
      render: (value: boolean, record: IBooking) => (
        <Tag
          color={value ? "blue" : "red"}
          style={{ cursor: "pointer", fontWeight: 700 }}
          onClick={() => handleToggleBoolField(record, "contractConfirmed", "계약상태")}
        >
          {value ? "확인" : "미확인"}
        </Tag>
      ),
    },
    {
      title: "계약금",
      dataIndex: "contractDeposit",
      align: "center" as const,
      render: (value: number | null, record: IBooking) => {
        if (value == null) {
          return (
            <span className="text-gray-300 cursor-pointer underline" onClick={() => openModal(record)}>
              -
            </span>
          );
        }
        const done = record.contractDepositSeen ?? true;
        return (
          <div className="flex flex-col items-center gap-1">
            <span
              className={`font-bold cursor-pointer ${done ? "text-blue-600" : "text-red-600"}`}
              onClick={() => openModal(record)}
            >
              {value.toLocaleString()}만원
            </span>
            <Tag
              color={done ? "blue" : "red"}
              style={{ cursor: canConfirmBilling ? "pointer" : "default", fontWeight: 700 }}
              onClick={canConfirmBilling ? () => handleToggleBoolField(record, "contractDepositSeen", "계약금") : undefined}
            >
              {done ? "완료" : "미완료"}
            </Tag>
          </div>
        );
      },
    },
    {
      title: "매입가",
      dataIndex: "purchasePrice",
      align: "center" as const,
      render: (value: number | null, record: IBooking) => {
        if (value == null) {
          return (
            <span className="text-gray-300 cursor-pointer underline" onClick={() => openModal(record)}>
              -
            </span>
          );
        }
        const done = record.purchasePriceSeen ?? true;
        return (
          <div className="flex flex-col items-center gap-1">
            <span
              className={`font-bold cursor-pointer ${done ? "text-blue-600" : "text-red-600"}`}
              onClick={() => openModal(record)}
            >
              {value.toLocaleString()}만원
            </span>
            <Tag
              color={done ? "blue" : "red"}
              style={{ cursor: canConfirmBilling ? "pointer" : "default", fontWeight: 700 }}
              onClick={canConfirmBilling ? () => handleToggleBoolField(record, "purchasePriceSeen", "매입가") : undefined}
            >
              {done ? "완료" : "미완료"}
            </Tag>
          </div>
        );
      },
    },
    {
      title: "구전",
      dataIndex: "oldDealerFee",
      align: "center" as const,
      render: (value: number | null, record: IBooking) => {
        if (value == null) {
          return (
            <span className="text-gray-300 cursor-pointer underline" onClick={() => openModal(record)}>
              -
            </span>
          );
        }
        const done = record.oldDealerFeeSeen ?? true;
        return (
          <div className="flex flex-col items-center gap-1">
            <span className={`font-bold ${done ? "text-blue-600" : "text-red-600"}`}>{value.toLocaleString()}만원</span>
            <Tag
              color={done ? "blue" : "red"}
              style={{ cursor: canConfirmOldDealerFee ? "pointer" : "default", fontWeight: 700 }}
              onClick={canConfirmOldDealerFee ? () => handleToggleBoolField(record, "oldDealerFeeSeen", "구전") : undefined}
            >
              {done ? "완료" : "미완료"}
            </Tag>
          </div>
        );
      },
    }] : []),
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
      // 더블클릭하면 모달 없이 셀 안에서 바로 입력창으로 바뀜(슈퍼관리자만) — Enter/포커스아웃 시 저장
      render: (value: string | null, record) => {
        if (inlineEditingId === record.id) {
          return (
            <Input
              autoFocus
              size="small"
              value={inlineDateTimeValue}
              disabled={savingInlineDateTime}
              onChange={(e) => setInlineDateTimeValue(e.target.value)}
              onPressEnter={() => saveInlineDateTime(record)}
              onBlur={() => saveInlineDateTime(record)}
              placeholder="YYYY-MM-DD HH:mm"
              style={{ maxWidth: 160 }}
              onClick={(e) => e.stopPropagation()}
            />
          );
        }
        const editable = canEditPreferredDateTime(record);
        return (
          <span
            onDoubleClick={() => startInlineDateTimeEdit(record)}
            title={editable ? "더블클릭하여 수정" : undefined}
            className={
              (value ? "text-red-500 font-bold" : "text-gray-300") +
              (editable ? " cursor-pointer" : "")
            }
          >
            {value ? value.replace('T', ' ') : "-"}
          </span>
        );
      },
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
    // 애니원모터스는 "수정 요청" 대신 명의이전 등록증을 직접 업로드하는 열을 씀
    ...(isAnyoneMotors ? [{
      title: "이전 등록증",
      key: "transferredRegistration",
      width: 150,
      align: "center" as const,
      render: (_: unknown, record: IBooking) => {
        // 빨강: 등록증 미업로드 / 초록: 등록증은 올렸지만 아직 아무도 전송 안 함 / 파랑: 딜러·고객 중 하나라도 전송됨
        const anySent = !!record.registrationSentToDealerAt || !!record.registrationSentToCustomerAt;
        const hasPhoto = !!record.transferredRegistrationUrl;
        const color = anySent ? '#1677ff' : hasPhoto ? '#52c41a' : '#ff4d4f';
        return (
          <Button
            size="small"
            style={{ backgroundColor: color, borderColor: color, color: '#fff' }}
            onClick={() => openRegistrationModal(record)}
          >
            등록증 보내기
          </Button>
        );
      },
    }] : [{
      title: "수정 요청",
      key: "requestUpdate",
      width: 120,
      align: "center" as const,
      render: (_: unknown, record: IBooking) => (
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
    }]),
    {
      title: "출처",
      dataIndex: "source",
      align: "center",
      render: (value: string) => value ? <Tag>{value}</Tag> : <span className="text-gray-300">-</span>,
    },
  ];

  // 매입팀 계정(isPurchaseTeam)은 매입가 판단만 하므로 그 업무에 필요한 컬럼만 남긴다 —
  // 배정/계약서 작성자/차량이전/계약상태/등록증/수정요청 같은 운영 컬럼은 가로로만 길어져서
  // 정작 봐야 할 매입가·구전이 화면 밖으로 밀린다. 남길 컬럼은 유저가 직접 지정한 목록이다.
  if (isPurchaseTeam) {
    const KEEP_TITLES = new Set([
      '관리', '차량번호', '차량명', '시세(참고)',
      '딜러이름', '딜러번호', '차주이름', '고객번호',
      '진단 리포트', '배정 진단사',
      '계약금', '매입가', '구전',
    ]);
    columns = columns.filter(c => KEEP_TITLES.has(String((c as { title?: unknown }).title ?? '')));
  }

  // 애니원모터스 사무장 계정은 리포트를 안 보고 등록증 전송이 주 업무라, 진단리포트보다
  // 이전 등록증 컬럼이 먼저 오게 위치를 바꿔준다(사무장 판별은 canConfirmBilling 재사용).
  if (isAnyoneMotors && canConfirmBilling) {
    const reportIdx = columns.findIndex(c => c.key === 'report');
    const regIdx = columns.findIndex(c => c.key === 'transferredRegistration');
    if (reportIdx !== -1 && regIdx !== -1) {
      [columns[reportIdx], columns[regIdx]] = [columns[regIdx], columns[reportIdx]];
    }
  }

  return (
    <div className="p-4 bg-white rounded-lg shadow-sm">
      <DefaultTableBtn className="justify-between mb-4">
        <div className="flex items-center gap-4">
          <span className="text-gray-500">전체 {filteredData.length}건</span>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <Switch size="small" checked={reportOnly} onChange={setReportOnly} />
            리포트 있는 건만
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <Switch size="small" checked={purchasePriceOnly} onChange={setPurchasePriceOnly} />
            매입가 적힌 건만
          </label>
          {router.query.contractWriterMissing === 'true' && (
            <Tag color="orange" closable onClose={() => router.push(router.pathname)}>
              계약서 미작성 건만 표시 중
            </Tag>
          )}
        </div>
        <Button type="primary" icon={<RefreshCw size={14} />} onClick={fetchBookings} loading={isLoading}>새로고침</Button>
      </DefaultTableBtn>

      <div className="overflow-x-auto">
        <DefaultTable<IBooking>
          columns={columns}
          dataSource={filteredData}
          loading={isLoading}
          rowKey="id"
          // antd 테이블은 배경색을 <tr>가 아니라 각 <td> 셀 단위로 칠해서, row 클래스에
          // 붙인 옅은 배경(bg-blue-50 등)이 셀 배경에 가려 안 보이는 문제가 있었음 —
          // 셀 배경까지 강제로 덮어써서 실제로 눈에 보이게 함.
          // 차량이전/계약상태 둘 중 하나만 완료면 초록, 둘 다 완료면 파랑.
          rowClassName={(record) => {
            const both = record.vehicleTransferred && record.contractConfirmed;
            const either = record.vehicleTransferred || record.contractConfirmed;
            return both ? "[&>td]:!bg-blue-50" : either ? "[&>td]:!bg-green-50" : "";
          }}
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
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">주소</label>
              {!isEditingAddress ? (
                <div className="flex items-start justify-between gap-2 bg-gray-50 rounded px-3 py-2">
                  <span className="text-sm text-gray-700">{tempAddress || <span className="text-gray-300">주소 없음</span>}</span>
                  <Button size="small" onClick={() => setIsEditingAddress(true)}>변경</Button>
                </div>
              ) : (
                <div>
                  <div className="flex gap-2">
                    <Input
                      value={placeQuery}
                      onChange={e => setPlaceQuery(e.target.value)}
                      onPressEnter={searchPlace}
                      placeholder="장소를 입력한 후 검색을 눌러주세요 (예: 도이치오토월드)"
                    />
                    <Button onClick={searchPlace} loading={searchingPlace}>검색</Button>
                    <Button onClick={() => { setIsEditingAddress(false); setShowPlaceResults(false); }}>취소</Button>
                  </div>
                  {showPlaceResults && placeResults.length > 0 && (
                    <div className="mt-2 border rounded overflow-hidden divide-y max-h-48 overflow-y-auto">
                      {placeResults.map((p, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => selectPlace(p)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors"
                        >
                          <p className="text-sm font-bold text-gray-800">{p.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{p.address}</p>
                        </button>
                      ))}
                    </div>
                  )}
                  {/* 시골 지번주소 등 카카오 검색에 안 잡히는 주소를 위한 폴백 —
                      /inspection 고객 페이지와 동일하게 입력한 텍스트를 그대로 등록 가능 */}
                  {showPlaceResults && placeQuery.trim() && (
                    placeResults.length === 0 ? (
                      <div className="mt-2 bg-purple-50 border border-purple-100 rounded p-3">
                        <p className="text-xs text-purple-700 mb-2">
                          검색 결과가 없어요. 시골 지번주소 등은 검색에 안 잡힐 수 있어서, 입력하신 주소를 그대로 등록할 수 있어요.
                        </p>
                        <Button
                          type="primary"
                          size="small"
                          block
                          onClick={() => selectPlace({ name: '', address: placeQuery.trim() })}
                        >
                          &ldquo;{placeQuery.trim()}&rdquo; 그대로 등록하기
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => selectPlace({ name: '', address: placeQuery.trim() })}
                        className="w-full text-left px-3 py-2 mt-2 border border-dashed rounded text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        검색결과에 없나요? <span className="font-bold text-gray-900">&ldquo;{placeQuery.trim()}&rdquo;</span> 그대로 등록하기
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
            {isSuperAdminView ? (
              <div className="flex items-center gap-2">
                <label className="text-gray-500 shrink-0">진단시작시간</label>
                <Input
                  value={tempPreferredDateTime}
                  onChange={(e) => setTempPreferredDateTime(e.target.value)}
                  placeholder="YYYY-MM-DD HH:mm"
                  className="max-w-[220px]"
                />
                <span className="text-xs text-gray-300">재배정 로직에 영향을 주니 신중하게 변경(슈퍼관리자 전용)</span>
              </div>
            ) : null}
            {isSuperAdminView && (
              <div className="mt-1">
                <Button
                  size="small"
                  loading={retryingAutoAssign}
                  onClick={handleRetryAutoAssign}
                >
                  🔁 수정한 주소/시간으로 배정 초기화 후 자동배정 재시도
                </Button>
                <p className="text-[11px] text-gray-400 mt-1">
                  주소·진단시작시간을 위에서 수정한 뒤 눌러주세요. 배정을 초기화하고 새 조건에 맞는 진단사를 다시 찾습니다 — 기존 담당자에게 페널티가 가지 않습니다.
                </p>
              </div>
            )}
            {!isSuperAdminView && (
              <p className="text-gray-500">진단시작시간: {editingBooking?.preferredDateTime || "-"}</p>
            )}
            <p className="text-gray-500">
              진단완료일시: {editingBooking?.firstCompletedAt ? dayjs(editingBooking.firstCompletedAt).format("YYYY-MM-DD HH:mm") : "-"}
              {(() => {
                const duration = formatDuration(editingBooking?.preferredDateTime, editingBooking?.firstCompletedAt);
                return duration ? <span className="text-gray-400"> (소요시간: {duration})</span> : null;
              })()}
            </p>
            {editingBooking?.source && (
              <p className="text-gray-400 flex items-center gap-2">
                출처: <Tag>{editingBooking.source}</Tag>
                <Popconfirm
                  title={editingBooking.source.startsWith('self-') ? "정상접수로 전환할까요?" : "자체접수(외주)로 전환할까요?"}
                  description="담당 진단사 배정은 그대로 유지됩니다. 필요하면 아래에서 다시 배정하세요."
                  onConfirm={() => handleToggleSource(editingBooking)}
                  okText="전환"
                  cancelText="취소"
                >
                  <Button size="small">
                    {editingBooking.source.startsWith('self-') ? "정상접수로 전환" : "자체접수(외주)로 전환"}
                  </Button>
                </Popconfirm>
              </p>
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
            {isSuperAdminView && editingBooking?.urgentCandidate && editingBooking?.status === 'PENDING' && (
              <p className="text-xs text-amber-600 mt-1">
                ⚡ 지역 맞는 진단사는 있지만 활동중인 사람이 없는 당일 건입니다 — 긴급·당일배정 브로드캐스트를 검토해주세요.
              </p>
            )}
            {isSuperAdminView && editingBooking?.remoteTier && (
              <p className="text-xs text-red-500 mt-1">
                {editingBooking.remoteTier === 'remote' ? '🏔 오지' : '🗺 준오지'} 지역입니다(
                {editingBooking.assignedDriverId
                  ? `배정된 진단사(${editingBooking.assignedDriverName || '-'}) 기준 편도 약 ${editingBooking.nearestDriverKm}km`
                  : `가장 가까운 진단사 편도 약 ${editingBooking.nearestDriverKm}km`}
                ) — 필요시 발주사와 가격협상 후 관리자메모에 직접 기록해주세요.
              </p>
            )}
            {(isSuperAdminView || isDirectConsumerView) && editingBooking?.paymentMethod === 'BANK_TRANSFER' && !editingBooking?.depositConfirmed && (
              <div className="mt-2">
                <Button
                  type="primary"
                  block
                  loading={confirmingDeposit}
                  onClick={handleConfirmDeposit}
                >
                  💰 입금 확인 → 배정 진행
                </Button>
                <p className="text-[11px] text-gray-400 mt-1">
                  검차 신청 시 계좌이체를 선택한 건입니다. 실제 입금을 확인한 뒤 눌러주세요 — 그 전까지는 진단사에게 자동배정/알림이 가지 않습니다.
                </p>
              </div>
            )}
            {editingBooking?.status === 'PENDING' && (
              <div className="mt-2">
                <Button
                  danger
                  block
                  loading={broadcasting}
                  disabled={editingBooking?.isUrgent}
                  onClick={handleUrgentBroadcast}
                >
                  {editingBooking?.isUrgent ? '✅ 긴급·당일배정 브로드캐스트 완료' : '🚨 긴급·당일배정으로 전체 브로드캐스트'}
                </Button>
                <p className="text-[11px] text-gray-400 mt-1">
                  스케줄·활동중 여부와 무관하게 승인된 진단사 전원에게 즉시 알림을 보냅니다. 자동배정이 안 되는 당일 긴급 건에만 사용하세요.
                </p>
              </div>
            )}
          </div>

          {/* 오더 기록 구분선 */}
          <div className="border-t pt-4">
            <p className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">오더 기록</p>

            {/* 딜러이름 / 딜러번호 */}
            <div className="grid grid-cols-2 gap-3 mb-3">
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

            {/* 고객번호 — 접수 시 받은 contact(신청자 번호)와 별개로, 계약 진행 중 확인한 실제 차주 연락처 */}
            <div className="mb-3">
              <label className="block text-xs font-bold text-gray-400 mb-1">고객번호 (차주 연락처)</label>
              <Input
                value={tempCustomerContact}
                onChange={e => setTempCustomerContact(e.target.value)}
                placeholder="01012345678"
              />
            </div>

            {/* 계약서 작성자 */}
            <div className="mb-3">
              <label className="block text-xs font-bold text-gray-400 mb-1">계약서 작성자</label>
              <Input
                value={tempContractWriter}
                onChange={e => setTempContractWriter(e.target.value)}
                placeholder="작성자 성함"
              />
            </div>

            {/* 매입가 = 계약금 + 잔금 */}
            <div className="mb-3">
              <label className="block text-xs font-bold text-gray-400 mb-1">매입가 (만원) — 계약금 + 잔금</label>
              <div className="flex gap-2 items-center">
                <InputNumber
                  className="w-full"
                  value={tempContractDeposit}
                  onChange={val => setTempContractDeposit(val)}
                  placeholder="계약금"
                  min={0}
                  formatter={val => val ? `${Number(val).toLocaleString()}` : ''}
                />
                <span className="text-gray-400">+</span>
                <InputNumber
                  className="w-full"
                  value={tempContractBalance}
                  onChange={val => setTempContractBalance(val)}
                  placeholder="잔금"
                  min={0}
                  formatter={val => val ? `${Number(val).toLocaleString()}` : ''}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                합계: {((tempContractDeposit || 0) + (tempContractBalance || 0)).toLocaleString()}만원
              </p>
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

          {/* 진단사 정산 — 슈퍼관리자 전용 */}
          {isSuperAdminView && (
            <div className="border-t pt-4">
              <p className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">진단사 정산</p>

              <div className="mb-3">
                <label className="block text-xs font-bold text-gray-400 mb-1">
                  오지/준오지/긴급 추가금 (원)
                  {editingBooking?.remoteTier && (
                    <span className="ml-1 text-[11px] font-normal text-red-500">
                      {editingBooking.remoteTier === 'remote' ? '오지' : '준오지'}
                      {editingBooking.isUrgent ? ' · 긴급' : ''} 건 — 기본값 제안됨
                    </span>
                  )}
                </label>
                <InputNumber
                  className="w-full"
                  value={tempRemoteBonus}
                  onChange={val => setTempRemoteBonus(val)}
                  placeholder="예: 20000"
                  min={0}
                  step={1000}
                  formatter={val => val ? `${Number(val).toLocaleString()}` : ''}
                />
              </div>

              <div className="mb-3">
                <label className="block text-xs font-bold text-gray-400 mb-1">
                  발주사 청구액 (VAT포함, 원)
                  {editingBooking?.remoteTier === 'remote' ? (
                    <span className="ml-1 text-[11px] font-normal text-red-500">오지건 — 단가표상 117,000~127,000원 협의, 직접 입력 필요</span>
                  ) : (
                    <span className="ml-1 text-[11px] font-normal text-gray-400">기본/준오지/긴급은 정산서에서 자동계산되므로 예외건만 입력</span>
                  )}
                </label>
                <InputNumber
                  className="w-full"
                  value={tempCompanyBillingAmount}
                  onChange={val => setTempCompanyBillingAmount(val)}
                  placeholder="예: 120000 (오지·수입차 등 협의 금액)"
                  min={0}
                  step={1000}
                  formatter={val => val ? `${Number(val).toLocaleString()}` : ''}
                />
              </div>

              <div className="mb-3">
                <label className="block text-xs font-bold text-gray-400 mb-1">기타 비용/인센티브 (원)</label>
                <InputNumber
                  className="w-full mb-2"
                  value={tempExtraFee}
                  onChange={val => setTempExtraFee(val)}
                  placeholder="예: 10000 (유류비, 톨비, 고생하신 것에 대한 성과급 등)"
                  min={0}
                  step={1000}
                  formatter={val => val ? `${Number(val).toLocaleString()}` : ''}
                />
                <Input
                  value={tempExtraFeeMemo}
                  onChange={e => setTempExtraFeeMemo(e.target.value)}
                  placeholder="무엇에 대한 금액인지 메모 (예: 왕복 톨비, 고생하셔서 인센티브 등)"
                />
              </div>

              <div className="mb-3">
                <label className="block text-xs font-bold text-gray-400 mb-1">클레임 차감액 (원)</label>
                <InputNumber
                  className="w-full"
                  value={tempClaimDeduction}
                  onChange={val => setTempClaimDeduction(val)}
                  placeholder="예: 30000"
                  min={0}
                  step={1000}
                  formatter={val => val ? `${Number(val).toLocaleString()}` : ''}
                />
              </div>

              {editingBooking?.assignedByAgentId && (
                <div className="mb-3 bg-violet-50 border border-violet-100 rounded p-3">
                  <label className="block text-xs font-bold text-violet-500 mb-1">
                    에이전트 관리수당 (원) — 배정한 에이전트 본인 몫, 실제 진단자 정산과 별개
                  </label>
                  <InputNumber
                    className="w-full mb-2"
                    value={tempAgentBonus}
                    onChange={val => setTempAgentBonus(val)}
                    placeholder="예: 10000 (일반 배정 +1만/진단평가사 배정 +5천 기본 제안)"
                    min={0}
                    step={1000}
                    formatter={val => val ? `${Number(val).toLocaleString()}` : ''}
                  />
                  <Input
                    value={tempAgentBonusMemo}
                    onChange={e => setTempAgentBonusMemo(e.target.value)}
                    placeholder="메모 (예: 일반평가사 배정, 라운딩 이관 등)"
                  />
                </div>
              )}

              {(() => {
                const assignedDriver = drivers.find(d => String(d.id) === String(editingBooking?.assignedDriverId));
                const baseFee = assignedDriver?.tier ? BASE_FEE_BY_TIER[assignedDriver.tier] : null;
                if (baseFee == null) return null;
                const total = baseFee + (tempRemoteBonus || 0) + (tempExtraFee || 0) - (tempClaimDeduction || 0);
                return (
                  <p className="text-xs text-gray-500 bg-gray-50 rounded px-3 py-2">
                    기본 진단비 {baseFee.toLocaleString()}원 + 추가금 {(tempRemoteBonus || 0).toLocaleString()}원
                    + 기타 {(tempExtraFee || 0).toLocaleString()}원 − 클레임 {(tempClaimDeduction || 0).toLocaleString()}원
                    {' = '}<b className="text-gray-800">총 {total.toLocaleString()}원</b>
                  </p>
                );
              })()}
            </div>
          )}

          {/* 접수 시 입력된 요청사항 — adminMemo에 아직 반영 안 된 과거 건(이 기능 배포 이전 접수)만
              표시. 배포 이후 접수 건은 백엔드에서 접수 시점에 이미 관리자 메모로 복사해서 넣어준다. */}
          {editingBooking?.additionalMemo && !tempMemo.includes(editingBooking.additionalMemo) && (
            <div>
              <label className="block text-xs font-bold text-amber-500 mb-1">⚠️ 접수 시 입력된 요청사항 (원본, 관리자 메모에 미반영)</label>
              <p className="text-xs text-gray-600 bg-amber-50 rounded px-3 py-2 whitespace-pre-wrap">{editingBooking.additionalMemo}</p>
            </div>
          )}

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

      {/* 명의이전 등록증 전송 모달 (애니원모터스 전용) */}
      <Modal
        title={`등록증 전송 — ${registrationTarget?.carNumber}`}
        open={!!registrationTarget}
        onOk={confirmSendRegistration}
        onCancel={() => setRegistrationTarget(null)}
        confirmLoading={uploadingRegistration}
        okText="보내기"
        okButtonProps={{ disabled: !sendToDealer && !sendToCustomer }}
        cancelText="닫기"
      >
        <div className="py-2 space-y-3">
          <Alert
            type="info"
            showIcon
            message="사진은 선택하는 즉시 자동으로 저장돼요. 딜러/고객에게 SMS로 전달하고 싶을 때만 아래 체크하고 보내기를 누르세요(건당 50원, VAT 포함, 대상별 1회만 전송 가능)."
          />
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={sendToDealer}
                disabled={!!registrationTarget?.registrationSentToDealerAt}
                onChange={e => setSendToDealer(e.target.checked)}
              >
                딜러에게 전송{registrationTarget?.registrationSentToDealerAt ? ' (전송완료)' : ''}
              </Checkbox>
              <Input
                size="small"
                value={dealerPhone}
                onChange={e => setDealerPhone(e.target.value)}
                disabled={!sendToDealer || !!registrationTarget?.registrationSentToDealerAt}
                placeholder="딜러 연락처"
                className="max-w-[160px]"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={sendToCustomer}
                disabled={!!registrationTarget?.registrationSentToCustomerAt}
                onChange={e => setSendToCustomer(e.target.checked)}
              >
                고객에게 전송{registrationTarget?.registrationSentToCustomerAt ? ' (전송완료)' : ''}
              </Checkbox>
              <Input
                size="small"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                disabled={!sendToCustomer || !!registrationTarget?.registrationSentToCustomerAt}
                placeholder="고객 연락처"
                className="max-w-[160px]"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">이전된 자동차등록증 사진</label>
            {/* 등록증은 글씨가 작아서 모달 안 썸네일로는 번호를 못 읽는다 — 사진을 클릭하면
                antd Image 프리뷰(확대/축소·회전)로 크게 본다. 예전엔 사진을 클릭하면 파일
                선택창이 떠서 확대가 아예 불가능했고, 실수로 클릭하면 잘 올려둔 사진을 다시
                고르게 되는 문제도 있었다. 그래서 "교체"는 드래그앤드롭과 아래 [파일 올리기]
                버튼 두 가지로만 하고, 사진 클릭은 확대 전용으로 분리했다. */}
            <div
              onDragOver={e => { e.preventDefault(); setIsDraggingRegistration(true); }}
              onDragLeave={() => setIsDraggingRegistration(false)}
              onDrop={e => {
                e.preventDefault();
                setIsDraggingRegistration(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleSelectRegistrationFile(file);
              }}
              className={`rounded border border-dashed transition-colors mb-2 ${
                isDraggingRegistration ? 'border-violet-500 bg-violet-50' : 'border-gray-200'
              }`}
            >
              {registrationPreview || registrationTarget?.transferredRegistrationUrl ? (
                <Image
                  src={registrationPreview || registrationTarget?.transferredRegistrationUrl || ''}
                  alt={registrationPreview ? '등록증 미리보기' : '보낸 등록증'}
                  wrapperClassName="w-full"
                  className="w-full max-h-64 object-contain rounded"
                  preview={{ mask: '클릭하면 확대' }}
                />
              ) : (
                <div
                  onClick={() => registrationFileInputRef.current?.click()}
                  className="w-full h-32 flex items-center justify-center text-gray-300 text-sm cursor-pointer hover:bg-gray-50 rounded"
                >
                  사진을 여기로 끌어다 놓거나, 아래 [파일 올리기] 버튼을 눌러주세요
                </div>
              )}
            </div>
            <Button
              size="small"
              onClick={() => registrationFileInputRef.current?.click()}
              className="mb-2"
            >
              {registrationPreview || registrationTarget?.transferredRegistrationUrl ? '사진 변경 (파일 올리기)' : '파일 올리기'}
            </Button>
            <input
              ref={registrationFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleSelectRegistrationFile(file);
              }}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">전달할 내용</label>
            <Input.TextArea
              value={registrationMessage}
              onChange={e => setRegistrationMessage(e.target.value)}
              rows={2}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default React.memo(BookingList);
