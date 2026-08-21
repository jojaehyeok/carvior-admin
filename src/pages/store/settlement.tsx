import { getDefaultLayout, IDefaultLayoutPage, IPageHeader } from "@/components/layout/default-layout";
import { ISO8601DateTime } from "@/types/common";
import { Button, DatePicker, InputNumber, Select, Table, Tag, message } from "antd";
import { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { FileDown, Search } from "lucide-react";
import { useSession } from "next-auth/react";
import React, { useState } from "react";
import * as XLSX from "xlsx";

// 발주사 청구 단가표(VAT포함, 원) — 기본/준오지/오지/긴급은 고정 단가.
// 수입차 등 단가표에 아예 없는 예외건만 관리자가 booking.companyBillingAmount에
// 직접 입력한 값으로 대체한다. 준오지와 긴급이 겹쳐도 더 높은 단가 하나만 적용
// (둘 다 97,000원이라 실질적으로 동일). 오지는 협의 범위(117,000~127,000원)였던 걸
// 117,000원으로 통일.
const BASE_PRICE = 77_000;
const SEMI_REMOTE_OR_URGENT_PRICE = 97_000;
const REMOTE_PRICE = 117_000;
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
  grossPriceInclVat: number; // 클레임 차감 전 단가(VAT포함)
  claimDeduction: number; // 안심케어 클레임 확정 시 청구액에서 차감한 금액(원)
  priceInclVatRaw: number; // 클레임 차감 후 금액(VAT포함, 이 건의 단가보다 클레임이 크면 음수) — 월 합계는 이 값으로 계산해야 초과분이 다른 건 청구액에서마저 온전히 빠진다
  priceInclVat: number; // 화면 표시용(0 미만은 0으로 고정) — 한 줄에 마이너스 금액이 보이면 헷갈리므로
  priceExclVat: number; // 위 값의 공급가액(VAT제외) — 화면에 1차로 노출할 값
  rowVat: number;
  remoteTier?: 'semi_remote' | 'remote' | null;
  isUrgent: boolean;
  isExportBooking: boolean;
  isManualPrice: boolean; // companyBillingAmount로 수동 입력된 예외건인지
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
  claimDeduction?: number | null;
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

// 이 건의 청구액에 뭐가 적용됐는지 한눈에 보이게 — 엑셀 텍스트 열용
function remoteTierLabel(r: Pick<ISettlementRow, 'remoteTier' | 'isUrgent' | 'isExportBooking' | 'isManualPrice'>): string {
  const parts: string[] = [];
  if (r.remoteTier === 'remote') parts.push('오지');
  if (r.remoteTier === 'semi_remote') parts.push('준오지');
  if (r.isUrgent) parts.push('긴급');
  if (r.isExportBooking) parts.push('수출');
  if (r.isManualPrice) parts.push('수동입력');
  return parts.length > 0 ? parts.join('+') : '기본';
}

// 발주사 청구 단가 계산(VAT포함, 클레임 차감 전 그로스 금액) — 수입차 등 단가표에 없는
// 예외건만 companyBillingAmount 수동 입력값을 쓰고, 나머지는 전부 고정 단가로 계산된다.
function computeGrossPrice(b: IBooking): { grossPrice: number; isManualPrice: boolean } {
  if (b.companyBillingAmount != null) {
    return { grossPrice: b.companyBillingAmount, isManualPrice: true };
  }
  if (b.remoteTier === 'remote') {
    return { grossPrice: REMOTE_PRICE, isManualPrice: false };
  }
  let base = BASE_PRICE;
  if (b.remoteTier === 'semi_remote' || b.isUrgent) base = SEMI_REMOTE_OR_URGENT_PRICE;
  if (b.isExportBooking) base += EXPORT_VIDEO_SURCHARGE;
  return { grossPrice: base, isManualPrice: false };
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
  const INTERNAL_HEADERS = { 'x-internal-key': process.env.NEXT_PUBLIC_STORE_ITEMS_INTERNAL_KEY ?? '' };

  // 기타비용은 예전엔 이 state로만 있어서 새로 조회할 때마다 0으로 초기화됐음 — 발주사+정산월
  // 조합으로 백엔드에 저장해서 다시 조회해도 값이 유지되게 함.
  const saveEtcCost = async (source: string | undefined, month: dayjs.Dayjs | null, amount: number | null) => {
    if (!source || !month) return;
    try {
      await fetch(`${API_BASE}/admin/settlement-extra-cost`, {
        method: 'PATCH',
        headers: { ...INTERNAL_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, month: month.format('YYYY-MM'), amount: amount ?? 0 }),
      });
    } catch {
      message.error('기타비용 저장에 실패했습니다.');
    }
  };

  const handleEtcCostChange = (value: number | null) => {
    setEtcCost(value);
    saveEtcCost(selectedSource, selectedMonth, value);
  };

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

      // 저장해둔 기타비용 불러오기(발주사+정산월 기준) — "전체" 조회일 땐 특정 발주사 하나로
      // 안 좁혀져서 저장/조회 대상이 모호하므로 스킵(입력만 가능, 저장은 소스 선택 시에만)
      if (selectedSource) {
        try {
          const etcRes = await fetch(
            `${API_BASE}/admin/settlement-extra-cost?source=${encodeURIComponent(selectedSource)}&month=${selectedMonth.format('YYYY-MM')}`,
            { headers: INTERNAL_HEADERS },
          );
          if (etcRes.ok) {
            const etcData = await etcRes.json();
            setEtcCost(etcData.amount || null);
          }
        } catch {}
      } else {
        setEtcCost(null);
      }

      // 선택한 월 + COMPLETED 상태만 필터 — 접수일이 아니라 방문예정일(preferredDateTime)
      // 기준으로 잡아야 실제로 그 달에 수행한 진단 건과 청구 내역이 일치한다.
      const monthStr = selectedMonth.format('YYYY-MM');
      const filtered = all
        .filter(
          (b) =>
            b.status === 'COMPLETED' &&
            (b.preferredDateTime || '').startsWith(monthStr)
        )
        // 방문일자 최근순(내림차순) 정렬
        .sort((a, b) => (b.preferredDateTime || '').localeCompare(a.preferredDateTime || ''));

      setRows(
        filtered.map((b, i) => {
          const { grossPrice, isManualPrice } = computeGrossPrice(b);
          const claimDeduction = b.claimDeduction || 0;
          // 클레임이 이 건 단가보다 커도(예: 검차비 취소 3건분을 한 건에 몰아 기록한 경우)
          // 초과분이 사라지지 않도록 음수 그대로 갖고 있다가 월 합계에서 다른 건 청구액과 상계한다.
          const priceInclVatRaw = grossPrice - claimDeduction;
          const priceInclVat = Math.max(0, priceInclVatRaw);
          const priceExclVat = Math.round(priceInclVat / (1 + VAT_RATE));
          const rowVat = priceInclVat - priceExclVat;
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
            grossPriceInclVat: grossPrice,
            claimDeduction,
            priceInclVatRaw,
            priceInclVat,
            priceExclVat,
            rowVat,
            remoteTier: b.remoteTier,
            isUrgent: !!b.isUrgent,
            isExportBooking: !!b.isExportBooking,
            isManualPrice,
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

  // --- 집계 --- 단가표 금액은 전부 VAT포함 기준이라, 합계(VAT포함, 클레임 차감 반영)를
  // 먼저 구하고 공급가액/부가세는 거꾸로 역산한다(1.1로 나눔) — 건별로 반올림하면 합계가
  // 어긋날 수 있어 총액 기준으로 한 번만 반올림한다.
  const totalClaimDeduction = rows.reduce((sum, r) => sum + r.claimDeduction, 0);
  // 건별로 0원 밑을 잘라내지 않은 원값(priceInclVatRaw)으로 합산 — 클레임이 그 건 단가보다
  // 커도 초과분이 다른 건 청구액에서 마저 빠지게(전체 협의 금액이 온전히 반영되게) 한다.
  const totalInclVat = Math.max(0, rows.reduce((sum, r) => sum + r.priceInclVatRaw, 0));
  const supplyTotal = Math.round(totalInclVat / (1 + VAT_RATE));
  const vat = totalInclVat - supplyTotal;
  const grandTotal = totalInclVat + (etcCost || 0);

  // --- 엑셀 내보내기 ---
  const handleExport = () => {
    if (rows.length === 0) {
      message.warning("조회된 데이터가 없습니다.");
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
      '적용사항': remoteTierLabel(r),
      '클레임차감': r.claimDeduction || '',
      '청구금액(VAT제외)': r.priceExclVat,
      '청구금액(VAT포함)': r.priceInclVat,
    }));

    // 합계 행 — 청구금액(VAT포함) 열에 이어서 적는다(클레임 차감이 이미 반영된 실제 청구액 기준)
    const summaryRows = [
      {},
      { '상사명/딜러명': '클레임 차감 합계', '청구금액(VAT포함)': totalClaimDeduction ? -totalClaimDeduction : 0 },
      { '상사명/딜러명': '공급가액(검차비)', '청구금액(VAT포함)': supplyTotal },
      { '상사명/딜러명': '부가세', '청구금액(VAT포함)': vat },
      { '상사명/딜러명': '기타비용', '청구금액(VAT포함)': etcCost || 0 },
      { '상사명/딜러명': 'VAT포함', '청구금액(VAT포함)': totalInclVat },
      {},
      { '상사명/딜러명': '★ 총 입금해주실 금액', '청구금액(VAT포함)': grandTotal },
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
      { wch: 14 },  // 적용사항
      { wch: 12 },  // 클레임차감
      { wch: 16 },  // 청구금액(VAT제외)
      { wch: 16 },  // 청구금액(VAT포함)
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
      title: '적용사항',
      key: 'applied',
      width: 150,
      align: 'center',
      render: (_, r) => (
        <div className="flex flex-wrap gap-1 justify-center">
          {r.remoteTier === 'remote' && <Tag color="volcano">오지</Tag>}
          {r.remoteTier === 'semi_remote' && <Tag color="orange">준오지</Tag>}
          {r.isUrgent && <Tag color="red">긴급</Tag>}
          {r.isExportBooking && <Tag color="blue">수출</Tag>}
          {r.isManualPrice && <Tag>수동입력</Tag>}
          {r.claimDeduction > 0 && <Tag color="purple">클레임 -₩{r.claimDeduction.toLocaleString()}</Tag>}
          {!r.remoteTier && !r.isUrgent && !r.isExportBooking && !r.isManualPrice && r.claimDeduction === 0 && (
            <span className="text-gray-300 text-xs">기본</span>
          )}
        </div>
      ),
    },
    {
      title: '청구금액 (VAT제외)',
      dataIndex: 'priceExclVat',
      width: 150,
      align: 'right',
      render: (v: number, r) => (
        <div>
          <div className="font-semibold">₩{v.toLocaleString()}</div>
          <div className="text-xs text-gray-400">+VAT ₩{r.rowVat.toLocaleString()}</div>
        </div>
      ),
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
            onChange={handleEtcCostChange}
            placeholder="예: 108400"
            min={0}
            disabled={!selectedSource}
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
                {totalClaimDeduction > 0 && (
                  <Table.Summary.Row className="text-purple-600">
                    <Table.Summary.Cell index={0} colSpan={9} align="right">
                      클레임 차감 합계 (이미 청구금액에 반영됨)
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      -₩{totalClaimDeduction.toLocaleString()}
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                )}
                <Table.Summary.Row className="font-bold bg-gray-50">
                  <Table.Summary.Cell index={0} colSpan={9} align="right">
                    공급가액 (검차비, VAT제외)
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    ₩{supplyTotal.toLocaleString()}
                  </Table.Summary.Cell>
                </Table.Summary.Row>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={9} align="right">
                    부가세 (나중에 추가)
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    ₩{vat.toLocaleString()}
                  </Table.Summary.Cell>
                </Table.Summary.Row>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={9} align="right">
                    기타비용
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    ₩{(etcCost || 0).toLocaleString()}
                  </Table.Summary.Cell>
                </Table.Summary.Row>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={9} align="right">
                    VAT포함
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    ₩{totalInclVat.toLocaleString()}
                  </Table.Summary.Cell>
                </Table.Summary.Row>
                <Table.Summary.Row className="font-bold text-blue-600">
                  <Table.Summary.Cell index={0} colSpan={9} align="right">
                    ★ 총 입금해주실 금액
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    ₩{grandTotal.toLocaleString()}
                  </Table.Summary.Cell>
                </Table.Summary.Row>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={10} align="center" className="text-gray-500 text-xs">
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
