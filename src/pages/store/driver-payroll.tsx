import { getDefaultLayout, IDefaultLayoutPage } from "@/components/layout/default-layout";
import RequireSuperAdmin from "@/components/shared/require-super-admin";
import { Button, DatePicker, Table, message } from "antd";
import { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { FileDown, Search } from "lucide-react";
import { useState } from "react";
import * as XLSX from "xlsx";

// 등급별 기본 진단비(원, VAT포함) — booking-list.tsx의 진단사 정산 미리보기와 동일 기준.
// 여기서 어긋나면 대시보드에서 건별로 보던 금액이랑 이 월별 합계가 안 맞게 되니 두 곳 다 같이 고칠 것.
const BASE_FEE_BY_TIER: Record<string, number> = { general: 50000, certified: 60000, agent: 65000 };
const WITHHOLDING_RATE = 0.033; // 3.3% 사업소득 원천징수

interface IBooking {
  id: number;
  carNumber: string;
  preferredDateTime: string;
  status: string;
  assignedDriverId?: string | null;
  assignedDriverName?: string | null;
  remoteBonus?: number | null;
  extraFee?: number | null;
  claimDeduction?: number | null;
}

interface IDriver {
  id: number;
  name: string;
  tier?: string | null;
}

interface IPayrollRow {
  driverId: string;
  driverName: string;
  tier: string;
  count: number;
  grossTotal: number; // 기본진단비+추가금+기타-클레임 합계(세전, VAT포함 기준)
  withholding: number; // 3.3% 원천징수액
  netTotal: number; // 실지급액
}

const TIER_LABEL: Record<string, string> = { general: '일반', certified: '인증', agent: '에이전트' };

const DriverPayrollPage: IDefaultLayoutPage = () => {
  const [selectedMonth, setSelectedMonth] = useState<dayjs.Dayjs | null>(dayjs());
  const [rows, setRows] = useState<IPayrollRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const API_BASE = process.env.NEXT_PUBLIC_API_ENDPOINT || 'http://localhost:4000/api/v1';

  const handleSearch = async () => {
    if (!selectedMonth) {
      message.warning("월을 선택해주세요.");
      return;
    }
    setIsLoading(true);
    try {
      const [bookingsRes, driversRes] = await Promise.all([
        fetch(`${API_BASE}/external/request/list`),
        fetch(`${API_BASE}/drivers`),
      ]);
      if (!bookingsRes.ok || !driversRes.ok) throw new Error();
      const allBookings: IBooking[] = await bookingsRes.json();
      const driversData = await driversRes.json();
      const drivers: IDriver[] = Array.isArray(driversData) ? driversData : driversData.data;
      const tierById = new Map(drivers.map(d => [String(d.id), d.tier || 'general']));
      const nameById = new Map(drivers.map(d => [String(d.id), d.name]));

      // 발주사(회사) 구분 없이 이번 달 완료건 전체 — 세무처리는 진단사 개인 기준이라 소속 발주사와 무관
      const monthStr = selectedMonth.format('YYYY-MM');
      const completed = allBookings.filter(
        (b) => b.status === 'COMPLETED' && b.assignedDriverId && (b.preferredDateTime || '').startsWith(monthStr),
      );

      const byDriver = new Map<string, { count: number; grossTotal: number }>();
      for (const b of completed) {
        const driverId = String(b.assignedDriverId);
        const tier = tierById.get(driverId) || 'general';
        const baseFee = BASE_FEE_BY_TIER[tier] ?? BASE_FEE_BY_TIER.general;
        const gross = baseFee + (b.remoteBonus || 0) + (b.extraFee || 0) - (b.claimDeduction || 0);
        const prev = byDriver.get(driverId) || { count: 0, grossTotal: 0 };
        byDriver.set(driverId, { count: prev.count + 1, grossTotal: prev.grossTotal + gross });
      }

      const result: IPayrollRow[] = Array.from(byDriver.entries()).map(([driverId, { count, grossTotal }]) => {
        const withholding = Math.round(grossTotal * WITHHOLDING_RATE);
        return {
          driverId,
          driverName: nameById.get(driverId) || `#${driverId}`,
          tier: tierById.get(driverId) || 'general',
          count,
          grossTotal,
          withholding,
          netTotal: grossTotal - withholding,
        };
      });
      result.sort((a, b) => b.netTotal - a.netTotal);
      setRows(result);
    } catch {
      message.error("데이터 로드 실패");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    if (rows.length === 0) {
      message.warning("조회된 데이터가 없습니다.");
      return;
    }
    const monthLabel = selectedMonth?.format('YYYY년 MM월') ?? '';
    const dataRows = rows.map((r) => ({
      '진단사명': r.driverName,
      '등급': TIER_LABEL[r.tier] || r.tier,
      '완료건수': r.count,
      '지급기준액': r.grossTotal,
      '3.3% 원천징수': r.withholding,
      '실지급액': r.netTotal,
    }));
    const ws = XLSX.utils.json_to_sheet(dataRows);
    ws['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${monthLabel} 진단사 지급`);
    XLSX.writeFile(wb, `카비어_진단사지급_${selectedMonth?.format('YYYYMM')}.xlsx`);
  };

  const columns: ColumnsType<IPayrollRow> = [
    { title: '진단사명', dataIndex: 'driverName', width: 120 },
    { title: '등급', dataIndex: 'tier', width: 90, render: (v: string) => TIER_LABEL[v] || v },
    { title: '완료건수', dataIndex: 'count', width: 90, align: 'right' },
    { title: '지급기준액', dataIndex: 'grossTotal', width: 130, align: 'right', render: (v: number) => `₩${v.toLocaleString()}` },
    { title: '3.3% 원천징수', dataIndex: 'withholding', width: 130, align: 'right', render: (v: number) => `-₩${v.toLocaleString()}` },
    {
      title: '실지급액',
      dataIndex: 'netTotal',
      width: 150,
      align: 'right',
      render: (v: number) => <b className={v < 0 ? 'text-red-600' : ''}>₩{v.toLocaleString()}</b>,
    },
  ];

  return (
    <RequireSuperAdmin>
      <div className="flex flex-col gap-6">
        <div className="bg-white rounded-lg shadow-sm p-5 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">정산 월 (방문예정일 기준)</label>
            <DatePicker picker="month" value={selectedMonth} onChange={setSelectedMonth} format="YYYY년 MM월" />
          </div>
          <Button type="primary" icon={<Search size={14} />} onClick={handleSearch} loading={isLoading}>
            조회
          </Button>
          <Button icon={<FileDown size={14} />} onClick={handleExport} disabled={rows.length === 0}>
            엑셀 다운로드
          </Button>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-5">
          <p className="text-xs text-gray-400 mb-3">
            지급기준액 = 등급별 기본 진단비(일반 5만/인증 6만/에이전트 6.5만) + 오지·준오지·긴급 추가금 + 기타비용 − 클레임 차감(진단사 페널티). 발주사 소속과 무관하게 진단사 개인별로 이번 달 완료건 전체를 합산합니다.
          </p>
          <Table columns={columns} dataSource={rows} rowKey="driverId" loading={isLoading} pagination={false} />
        </div>
      </div>
    </RequireSuperAdmin>
  );
};

DriverPayrollPage.getLayout = getDefaultLayout;
DriverPayrollPage.pageHeader = { title: "진단사 지급 내역 (세무용)" };

export default DriverPayrollPage;
