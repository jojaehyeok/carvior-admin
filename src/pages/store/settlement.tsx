import { getDefaultLayout, IDefaultLayoutPage, IPageHeader } from "@/components/layout/default-layout";
import { ISO8601DateTime } from "@/types/common";
import { Button, DatePicker, Select, Table, Tag, message } from "antd";
import { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { FileDown, Search } from "lucide-react";
import { useSession } from "next-auth/react";
import React, { useState } from "react";
import * as XLSX from "xlsx";

const INSPECTION_PRICE = 70_000; // 건당 검차비 (원)
const VAT_RATE = 0.1;

interface ISettlementRow {
  id: number;
  no: number;
  dealerName: string;
  preferredDateTime: string;
  region: string;
  address: string;
  carNumber: string;
  contractWriter: string;
  price: number;
  source: string;
}

interface IBooking {
  id: number;
  carNumber: string;
  dealerName: string;
  contact: string;
  address: string;
  preferredDateTime: string;
  status: string;
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

const SettlementPage: IDefaultLayoutPage = () => {
  const { data: session } = useSession();
  const [selectedMonth, setSelectedMonth] = useState<dayjs.Dayjs | null>(dayjs());
  const [selectedSource, setSelectedSource] = useState<string | undefined>(
    session?.user?.company || undefined
  );
  const [rows, setRows] = useState<ISettlementRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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

      // 선택한 월 + COMPLETED 상태만 필터
      const monthStr = selectedMonth.format('YYYY-MM');
      const filtered = all.filter(
        (b) =>
          b.status === 'COMPLETED' &&
          dayjs(b.createdAt).format('YYYY-MM') === monthStr
      );

      setRows(
        filtered.map((b, i) => ({
          id: b.id,
          no: i + 1,
          dealerName: b.dealerName,
          preferredDateTime: b.preferredDateTime,
          region: extractRegion(b.address),
          address: b.address,
          carNumber: b.carNumber,
          contractWriter: b.contractWriter || '-',
          price: INSPECTION_PRICE,
          source: b.source || '-',
        }))
      );
    } catch {
      message.error("데이터 로드 실패");
    } finally {
      setIsLoading(false);
    }
  };

  // --- 집계 ---
  const supplyTotal = rows.length * INSPECTION_PRICE;
  const vat = Math.round(supplyTotal * VAT_RATE);
  const total = supplyTotal + vat;

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
      '일자': r.preferredDateTime,
      '지역': r.region,
      '주소': r.address,
      '차량번호': r.carNumber,
      '담당자': r.contractWriter,
      '검차비': r.price,
    }));

    // 합계 행
    const summaryRows = [
      {},
      { '상사명/딜러명': '공급가액(검차비)', '검차비': supplyTotal },
      { '상사명/딜러명': '부가세 (10%)', '검차비': vat },
      { '상사명/딜러명': 'VAT 포함 합계', '검차비': total },
      {},
      { '상사명/딜러명': '★ 총 입금해주실 금액', '검차비': total },
      { '상사명/딜러명': '★ 입금계좌번호', '차량번호': '카카오뱅크) 3333351997303 카비어' },
    ];

    const ws = XLSX.utils.json_to_sheet([...dataRows, ...summaryRows]);

    // 열 너비 설정
    ws['!cols'] = [
      { wch: 6 },   // No.
      { wch: 18 },  // 상사명
      { wch: 18 },  // 일자
      { wch: 12 },  // 지역
      { wch: 40 },  // 주소
      { wch: 14 },  // 차량번호
      { wch: 10 },  // 담당자
      { wch: 14 },  // 검차비
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${monthLabel} 정산`);
    XLSX.writeFile(wb, `카비어_정산_${selectedMonth?.format('YYYYMM')}.xlsx`);
  };

  const isSuperAdmin = session?.user?.role === 'SUPER_ADMIN';

  const columns: ColumnsType<ISettlementRow> = [
    { title: 'No.', dataIndex: 'no', width: 55, align: 'center' },
    { title: '상사명/딜러명', dataIndex: 'dealerName', width: 140 },
    { title: '일자', dataIndex: 'preferredDateTime', width: 130 },
    { title: '지역', dataIndex: 'region', width: 100 },
    { title: '주소', dataIndex: 'address', ellipsis: true },
    { title: '차량번호', dataIndex: 'carNumber', width: 120 },
    { title: '담당자', dataIndex: 'contractWriter', width: 90 },
    {
      title: '검차비',
      dataIndex: 'price',
      width: 100,
      align: 'right',
      render: (v: number) => `₩${v.toLocaleString()}`,
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
          <label className="block text-xs font-bold text-gray-400 mb-1">정산 월</label>
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
                <Table.Summary.Row className="font-bold bg-gray-50">
                  <Table.Summary.Cell index={0} colSpan={7} align="right">
                    공급가액 (검차비)
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    ₩{supplyTotal.toLocaleString()}
                  </Table.Summary.Cell>
                </Table.Summary.Row>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={7} align="right">
                    부가세 (10%)
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    ₩{vat.toLocaleString()}
                  </Table.Summary.Cell>
                </Table.Summary.Row>
                <Table.Summary.Row className="font-bold text-blue-600">
                  <Table.Summary.Cell index={0} colSpan={7} align="right">
                    ★ 총 입금해주실 금액 (VAT 포함)
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    ₩{total.toLocaleString()}
                  </Table.Summary.Cell>
                </Table.Summary.Row>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={8} align="center" className="text-gray-500 text-xs">
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
