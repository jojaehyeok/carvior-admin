import { getDefaultLayout, IDefaultLayoutPage, IPageHeader } from "@/components/layout/default-layout";
import { ISO8601DateTime } from "@/types/common";
import { Button, DatePicker, InputNumber, Select, Table, Tag, message } from "antd";
import { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { FileDown, Search } from "lucide-react";
import { useSession } from "next-auth/react";
import React, { useState } from "react";
import * as XLSX from "xlsx";

// 발주사 청구 단가표(VAT포함, 원) — 기본/준오지/긴급은 고정, 오지·수입차 등은 건마다
// 협의 금액이라 관리자가 booking.companyBillingAmount에 직접 입력한 값을 그대로 쓴다.
// 준오지와 긴급이 겹쳐도 더 높은 단가 하나만 적용(둘 다 97,000원이라 실질적으로 동일).
const BASE_PRICE = 77_000;
const SEMI_REMOTE_OR_URGENT_PRICE = 97_000;
const EXPORT_VIDEO_SURCHARGE = 15_000;
const VAT_RATE = 0.1;

interface ISettlementRow {
  id: number;
  no: number;
  dealerName: string;
  preferredDateTime: string;
  region: string;
  address: string;
  carModel: string;
  carNumber: string;
  assignedDriverName: string;
  price: number | null; // null = 오지/수입차 등 미입력 예외건(관리자 확인 필요)
  needsManualPrice: boolean;
  source: string;
}

interface IBooking {
  id: number;
  carNumber: string;
  carModel?: string | null;
  dealerName: string;
  contact: string;
  address: string;
  preferredDateTime: string;
  status: string;
  assignedDriverName?: string | null;
  remoteTier?: 'semi_remote' | 'remote' | null;
  isUrgent?: boolean;
  isExportBooking?: boolean;
  companyBillingAmount?: number | null;
  contractWriter?: string;
  source?: string;
  createdAt: ISO8601DateTime;
}

// 주소에서 시/도 or 시/군/구 추출
function extractRegion(address: string): string {
  if (!address) return '-';
  const parts = address.split(' ');
  return parts.slice(0, 2).join(' ');
}

// 발주사 청구 단가 계산(VAT포함) — 오지처럼 단가표에 고정값이 없는 건은 관리자가
// booking.companyBillingAmount에 직접 입력한 값이 있어야 하며, 없으면 null(확인 필요).
function computeBillingPrice(b: IBooking): { price: number | null; needsManualPrice: boolean } {
  if (b.companyBillingAmount != null) {
    return { price: b.companyBillingAmount, needsManualPrice: false };
  }
  if (b.remoteTier === 'remote') {
    // 오지(왕복 70km 이상 등) — 117,000~127,000원 협의, 관리자 직접입력 필수
    return { price: null, needsManualPrice: true };
  }
  let base = BASE_PRICE;
  if (b.remoteTier === 'semi_remote' || b.isUrgent) base = SEMI_REMOTE_OR_URGENT_PRICE;
  if (b.isExportBooking) base += EXPORT_VIDEO_SURCHARGE;
  return { price: base, needsManualPrice: false };
}

const SettlementPage: IDefaultLayoutPage = () => {
  const { data: session } = useSession();
  const [selectedMonth, setSelectedMonth] = useState<dayjs.Dayjs | null>(dayjs());
  const [selectedSource, setSelectedSource] = useState<string | undefined>(
    session?.user?.company || undefined
  );
  const [rows, setRows] = useState<ISettlementRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [etcCost, setEtcCost] = useState<number | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_ENDPOINT || 'http://localhost:4000/api/v1';

  const handleSearch = async () => {
    if (!selectedMonth) {
      message.warning("월을 선택해주세요.");
      return;
    }
    setIsLoading(true);
    try {
      const url = new URL(`${API_BASE}/external/request/list`);
      if (selectedSource) url.searchParams.set('source', selectedSource);

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error();
      const all: IBooking[] = await res.json();

      // 선택한 월 + COMPLETED 상태만 필터 — 접수일이 아니라 방문예정일(preferredDateTime)
      // 기준으로 잡아야 실제로 그 달에 수행한 진단 건과 청구 내역이 일치한다.
      const monthStr = selectedMonth.format('YYYY-MM');
      const filtered = all.filter(
        (b) =>
          b.status === 'COMPLETED' &&
          (b.preferredDateTime || '').startsWith(monthStr)
      );

      setRows(
        filtered.map((b, i) => {
          const { price, needsManualPrice } = computeBillingPrice(b);
          return {
            id: b.id,
            no: i + 1,
            dealerName: b.dealerName,
            preferredDateTime: b.preferredDateTime,
            region: extractRegion(b.address),
            address: b.address,
            carModel: b.carModel || '-',
            carNumber: b.carNumber,
            assignedDriverName: b.assignedDriverName || '-',
            price,
            needsManualPrice,
            source: b.source || '-',
          };
        })
      );
    } catch {
      message.error("데이터 로드 실패");
    } finally {
      setIsLoading(false);
    }
  };

  // --- 집계 --- 단가표 금액은 전부 VAT포함 기준이라, 합계(VAT포함)를 먼저 구하고
  // 공급가액/부가세는 거꾸로 역산한다(1.1로 나눔) — 건별로 반올림하면 합계가 어긋날 수 있어
  // 총액 기준으로 한 번만 반올림한다.
  const unresolvedCount = rows.filter((r) => r.needsManualPrice).length;
  const totalInclVat = rows.reduce((sum, r) => sum + (r.price ?? 0), 0);
  const supplyTotal = Math.round(totalInclVat / (1 + VAT_RATE));
  const vat = totalInclVat - supplyTotal;
  const grandTotal = totalInclVat + (etcCost || 0);

  // --- 엑셀 내보내기 ---
  const handleExport = () => {
    if (rows.length === 0) {
      message.warning("조회된 데이터가 없습니다.");
      return;
    }
    if (unresolvedCount > 0) {
      message.warning(`오지 등 단가 미입력 건이 ${unresolvedCount}건 있습니다. 대시보드에서 발주사 청구액을 먼저 입력해주세요.`);
      return;
    }

    const monthLabel = selectedMonth?.format('YYYY년 MM월') ?? '';

    // 데이터 행
    const dataRows = rows.map((r) => ({
      'No.': r.no,
      '상사명/딜러명': r.dealerName,
      '방문일자': r.preferredDateTime,
      '지역': r.region,
      '방문장소': r.address,
      '차종': r.carModel,
      '차량번호': r.carNumber,
      '담당 진단사': r.assignedDriverName,
      '청구금액': r.price ?? 0,
    }));

    // 합계 행
    const summaryRows = [
      {},
      { '상사명/딜러명': '공급가액(검차비)', '청구금액': supplyTotal },
      { '상사명/딜러명': '부가세', '청구금액': vat },
      { '상사명/딜러명': '기타비용', '청구금액': etcCost || 0 },
      { '상사명/딜러명': 'VAT포함', '청구금액': totalInclVat },
      {},
      { '상사명/딜러명': '★ 총 입금해주실 금액', '청구금액': grandTotal },
      { '상사명/딜러명': '★ 입금계좌번호', '차량번호': '카카오뱅크) 3333351997303 카비어' },
    ];

    const ws = XLSX.utils.json_to_sheet([...dataRows, ...summaryRows]);

    // 열 너비 설정
    ws['!cols'] = [
      { wch: 6 },   // No.
      { wch: 18 },  // 상사명
      { wch: 18 },  // 방문일자
      { wch: 12 },  // 지역
      { wch: 40 },  // 방문장소
      { wch: 12 },  // 차종
      { wch: 14 },  // 차량번호
      { wch: 10 },  // 담당 진단사
      { wch: 14 },  // 청구금액
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${monthLabel} 정산`);
    XLSX.writeFile(wb, `카비어_정산_${selectedMonth?.format('YYYYMM')}.xlsx`);
  };

  const isSuperAdmin = session?.user?.role === 'SUPER_ADMIN';

  const columns: ColumnsType<ISettlementRow> = [
    { title: 'No.', dataIndex: 'no', width: 55, align: 'center' },
    { title: '상사명/딜러명', dataIndex: 'dealerName', width: 140 },
    { title: '방문일자', dataIndex: 'preferredDateTime', width: 130 },
    { title: '지역', dataIndex: 'region', width: 100 },
    { title: '방문장소', dataIndex: 'address', ellipsis: true },
    { title: '차종', dataIndex: 'carModel', width: 100 },
    { title: '차량번호', dataIndex: 'carNumber', width: 120 },
    { title: '담당 진단사', dataIndex: 'assignedDriverName', width: 100 },
    {
      title: '청구금액',
      dataIndex: 'price',
      width: 130,
      align: 'right',
      render: (v: number | null) => v == null
        ? <Tag color="red">확인필요(오지)</Tag>
        : `₩${v.toLocaleString()}`,
    },
    ...(isSuperAdmin
      ? [{
          title: '출처',
          dataIndex: 'source',
          width: 120,
          render: (v: string) => <Tag>{v}</Tag>,
        }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* 검색 조건 */}
      <div className="bg-white rounded-lg shadow-sm p-5 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-400 mb-1">정산 월 (방문예정일 기준)</label>
          <DatePicker
            picker="month"
            value={selectedMonth}
            onChange={setSelectedMonth}
            format="YYYY년 MM월"
          />
        </div>

        {isSuperAdmin && (
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">발주사</label>
            <Select
              style={{ width: 160 }}
              placeholder="전체"
              allowClear
              value={selectedSource}
              onChange={setSelectedSource}
              options={[
                { label: '전체', value: undefined },
                { label: '애니원 모터스', value: 'anyone-motors' },
                // 발주사 추가 시 여기에 추가
              ]}
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-gray-400 mb-1">기타비용 (원, 수동 입력)</label>
          <InputNumber
            style={{ width: 160 }}
            value={etcCost}
            onChange={setEtcCost}
            placeholder="예: 108400"
            min={0}
            formatter={val => val ? `${Number(val).toLocaleString()}` : ''}
          />
        </div>

        <Button
          type="primary"
          icon={<Search size={14} />}
          onClick={handleSearch}
          loading={isLoading}
        >
          조회
        </Button>

        <Button
          icon={<FileDown size={14} />}
          onClick={handleExport}
          disabled={rows.length === 0}
        >
          엑셀 다운로드
        </Button>
      </div>

      {unresolvedCount > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
          오지 건 등 발주사 청구액이 아직 입력되지 않은 건이 {unresolvedCount}건 있습니다 —
          대시보드 예약 목록에서 해당 건을 열어 &ldquo;발주사 청구액&rdquo;을 입력해주세요.
        </div>
      )}

      {/* 테이블 */}
      <div className="bg-white rounded-lg shadow-sm p-5">
        <Table
          columns={columns}
          dataSource={rows}
          rowKey="id"
          loading={isLoading}
          pagination={false}
          summary={() =>
            rows.length > 0 ? (
              <Table.Summary fixed>
                <Table.Summary.Row className="font-bold bg-gray-50">
                  <Table.Summary.Cell index={0} colSpan={8} align="right">
                    공급가액 (검차비)
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    ₩{supplyTotal.toLocaleString()}
                  </Table.Summary.Cell>
                </Table.Summary.Row>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={8} align="right">
                    부가세
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    ₩{vat.toLocaleString()}
                  </Table.Summary.Cell>
                </Table.Summary.Row>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={8} align="right">
                    기타비용
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    ₩{(etcCost || 0).toLocaleString()}
                  </Table.Summary.Cell>
                </Table.Summary.Row>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={8} align="right">
                    VAT포함
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    ₩{totalInclVat.toLocaleString()}
                  </Table.Summary.Cell>
                </Table.Summary.Row>
                <Table.Summary.Row className="font-bold text-blue-600">
                  <Table.Summary.Cell index={0} colSpan={8} align="right">
                    ★ 총 입금해주실 금액
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    ₩{grandTotal.toLocaleString()}
                  </Table.Summary.Cell>
                </Table.Summary.Row>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={9} align="center" className="text-gray-500 text-xs">
                    ★ 입금계좌번호: 카카오뱅크) 3333351997303 카비어
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            ) : null
          }
        />
      </div>
    </div>
  );
};

SettlementPage.getLayout = getDefaultLayout;
SettlementPage.pageHeader = { title: "월별 정산 관리" };

export default SettlementPage;
