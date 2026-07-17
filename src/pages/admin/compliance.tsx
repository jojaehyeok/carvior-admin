import { getDefaultLayout, IDefaultLayoutPage } from "@/components/layout/default-layout";
import { Input, Spin, Table, Tag } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_ENDPOINT;
const INTERNAL_KEY = process.env.NEXT_PUBLIC_STORE_ITEMS_INTERNAL_KEY ?? "";

interface ComplianceRecord {
  id: number;
  storeItemId?: number;
  bookingId?: number;
  carHash?: string;
  plateNumber: string;
  vin?: string;
  carName?: string;
  vehicleType?: string;
  engineType?: string;
  usageType?: string;
  modelYear?: string;
  color?: string;
  mileage?: string;
  registrationDate?: string;
  manufactureDate?: string;
  inspectionValidUntil?: string;
  ownerName?: string;
  ownerAddress?: string;
  sourceImageUrl?: string;
  capturedAt: string;
  retainUntil: string;
}

const V = (v?: string | null) => (v ? v : <span className="text-gray-300">미확인</span>);

// 상세 항목: 법정 보관 대상 12개 항목을 그대로 매핑 (자동차관리법 시행규칙 제144조의3)
function DetailPanel({ r }: { r: ComplianceRecord }) {
  const rows: [string, React.ReactNode][] = [
    ["자동차등록번호", V(r.plateNumber)],
    ["차대번호(VIN)", V(r.vin)],
    ["차명", V(r.carName)],
    ["자동차 종류·구분", V(r.vehicleType)],
    ["원동기형식", V(r.engineType)],
    ["용도", V(r.usageType)],
    ["연식", V(r.modelYear)],
    ["색상", V(r.color)],
    ["총주행거리", r.mileage ? `${Number(r.mileage).toLocaleString()} km` : V(undefined)],
    ["최초등록일", V(r.registrationDate)],
    ["제작연월일", V(r.manufactureDate)],
    ["검사유효기간", V(r.inspectionValidUntil)],
    ["소유자명(제공 당시)", V(r.ownerName)],
    ["소유자 주소(사용본거지)", V(r.ownerAddress)],
  ];
  return (
    <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
      {rows.map(([label, value]) => (
        <div key={label}>
          <p className="text-[11px] text-gray-400">{label}</p>
          <p className="text-sm font-semibold text-gray-800">{value}</p>
        </div>
      ))}
      {r.sourceImageUrl && (
        <div className="col-span-full">
          <a href={r.sourceImageUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">
            등록증 원본 이미지 보기 →
          </a>
        </div>
      )}
    </div>
  );
}

const CompliancePage: IDefaultLayoutPage = () => {
  const [records, setRecords] = useState<ComplianceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/compliance`, { headers: { "x-internal-key": INTERNAL_KEY } });
      const data = await res.json();
      setRecords(Array.isArray(data) ? data : []);
    } catch {
      // 조용히 실패 — 빈 목록으로 표시
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const filtered = useMemo(() => {
    if (!search.trim()) return records;
    const q = search.replace(/\s/g, "").toLowerCase();
    return records.filter(r =>
      (r.plateNumber ?? "").replace(/\s/g, "").toLowerCase().includes(q) ||
      (r.carName ?? "").toLowerCase().includes(q) ||
      (r.vin ?? "").toLowerCase().includes(q)
    );
  }, [records, search]);

  const columns = [
    { title: "자동차등록번호", dataIndex: "plateNumber", render: (v: string) => <span className="font-bold">{v}</span> },
    { title: "차명", dataIndex: "carName", render: V },
    { title: "차대번호(VIN)", dataIndex: "vin", render: (v?: string) => v ? <span className="font-mono text-xs">{v}</span> : V(v) },
    { title: "연식", dataIndex: "modelYear", render: V },
    {
      title: "기록일",
      dataIndex: "capturedAt",
      render: (v: string) => new Date(v).toLocaleDateString("ko-KR"),
    },
    {
      title: "보관만료일",
      dataIndex: "retainUntil",
      render: (v: string) => {
        const d = new Date(v);
        const soon = d.getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000;
        return <Tag color={soon ? "orange" : "default"}>{d.toLocaleDateString("ko-KR")}</Tag>;
      },
    },
  ];

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">온라인 자동차매매정보 보관 기록</h1>
        <p className="text-sm text-gray-400 mt-1">
          자동차관리법 제65조의2제4항 · 시행규칙 제144조의3에 따라 매물 등록 시점의 등록증 정보를 3년간 보관합니다.
          행을 클릭하면 법정 보관 항목 전체를 확인할 수 있습니다.
        </p>
      </div>

      <Input.Search
        placeholder="자동차등록번호 / 차명 / 차대번호로 검색"
        allowClear
        style={{ maxWidth: 360, marginBottom: 16 }}
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {loading ? (
        <div className="flex justify-center py-16"><Spin /></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <Table
            dataSource={filtered}
            columns={columns}
            rowKey="id"
            pagination={{ pageSize: 20 }}
            locale={{ emptyText: "보관된 기록이 없습니다." }}
            expandable={{ expandedRowRender: (r: ComplianceRecord) => <DetailPanel r={r} /> }}
          />
        </div>
      )}
    </div>
  );
};

CompliancePage.getLayout = getDefaultLayout;
export default CompliancePage;
