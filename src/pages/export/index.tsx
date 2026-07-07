import { getDefaultLayout, IDefaultLayoutPage, IPageHeader } from "@/components/layout/default-layout";
import { Alert, Card, Col, Row, Skeleton, Statistic, Table, Tag } from "antd";
import { BarChart2, DollarSign, Globe, TrendingUp, Truck } from "lucide-react";
import { useEffect, useState } from "react";

const CLASSIFY_API = "https://carvior.store/classify-api";

const pageHeader: IPageHeader = { title: "수출 데이터 분석" };

interface ModelStat {
  brand: string;
  model: string;
  car_type: string;
  count: number;
  avg_export_usd: number | null;
  avg_export_krw: number | null;
  avg_mileage: number | null;
  avg_year: number | null;
  max_purchase_krw: number | null;
}

interface Stats {
  total_cars: number;
  avg_export_price_usd: number | null;
  usd_rate: number;
  other_cost_krw: number;
  shipping_per_m3: number;
  model_stats: ModelStat[];
  country_stats: { country: string; count: number; avg_export_usd: number | null }[];
  type_stats: { car_type: string; count: number; avg_export_usd: number | null }[];
  year_stats: { year: number; count: number; avg_export_usd: number | null }[];
}

const ExportDashboard: IDefaultLayoutPage = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${CLASSIFY_API}/export/stats`)
      .then(r => { if (!r.ok) throw new Error("not ok"); return r.json(); })
      .then(d => {
        if (d && typeof d.total_cars === "number") setStats(d);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton active />;
  if (error || !stats) return (
    <Alert type="warning" message="데이터 없음" description="classify-api 서버가 실행 중인지 확인하거나, 먼저 엑셀을 업로드하세요." />
  );

  const modelColumns = [
    { title: "브랜드", dataIndex: "brand", key: "brand", render: (v: string) => v || "-" },
    { title: "모델", dataIndex: "model", key: "model", render: (v: string) => <strong>{v}</strong> },
    { title: "타입", dataIndex: "car_type", key: "car_type", render: (v: string) => v ? <Tag>{v}</Tag> : "-" },
    { title: "건수", dataIndex: "count", key: "count", sorter: (a: any, b: any) => a.count - b.count },
    { title: "평균연식", dataIndex: "avg_year", key: "avg_year", render: (v: number) => v ? v.toFixed(1) : "-" },
    {
      title: "평균주행거리",
      dataIndex: "avg_mileage",
      key: "avg_mileage",
      render: (v: number) => v ? `${Math.round(v).toLocaleString()}km` : "-",
    },
    {
      title: "평균판매가(USD)",
      dataIndex: "avg_export_usd",
      key: "avg_export_usd",
      render: (v: number) => v ? `$${Math.round(v).toLocaleString()}` : "-",
      sorter: (a: any, b: any) => (a.avg_export_usd || 0) - (b.avg_export_usd || 0),
    },
    {
      title: "평균판매가(KRW)",
      dataIndex: "avg_export_krw",
      key: "avg_export_krw",
      render: (v: number) => v ? `₩${Math.round(v).toLocaleString()}` : "-",
    },
    {
      title: "권장최대매입가(KRW)",
      dataIndex: "max_purchase_krw",
      key: "max_purchase_krw",
      render: (v: number) => v ? (
        <span className="font-bold text-purple-700">₩{Math.round(v).toLocaleString()}</span>
      ) : "-",
      sorter: (a: any, b: any) => (a.max_purchase_krw || 0) - (b.max_purchase_krw || 0),
    },
  ];

  const countryColumns = [
    { title: "수출국", dataIndex: "country", key: "country" },
    { title: "건수", dataIndex: "count", key: "count", sorter: (a: any, b: any) => a.count - b.count },
    {
      title: "평균판매가(USD)",
      dataIndex: "avg_export_usd",
      key: "avg_export_usd",
      render: (v: number) => v ? `$${Math.round(v).toLocaleString()}` : "-",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* 요약 카드 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="총 수출 건수"
              value={stats.total_cars}
              suffix="건"
              prefix={<Truck className="inline w-4 h-4 mr-1 text-blue-500" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="평균 판매가"
              value={stats.avg_export_price_usd ?? 0}
              prefix={<DollarSign className="inline w-4 h-4 mr-1 text-green-500" />}
              suffix="USD"
              precision={0}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="적용 환율"
              value={stats.usd_rate}
              prefix={<TrendingUp className="inline w-4 h-4 mr-1 text-purple-500" />}
              suffix="KRW"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="기타비용"
              value={stats.other_cost_krw}
              prefix={<BarChart2 className="inline w-4 h-4 mr-1 text-orange-500" />}
              suffix="KRW"
            />
          </Card>
        </Col>
      </Row>

      {/* 타입별 분포 */}
      {stats.type_stats.length > 0 && (
        <Card title="차량 타입별 분포" size="small">
          <div className="flex flex-wrap gap-3">
            {stats.type_stats.map(t => (
              <div key={t.car_type} className="flex flex-col items-center bg-gray-50 border rounded-xl px-4 py-3 min-w-[100px]">
                <span className="text-lg font-black text-purple-700">{t.count}</span>
                <span className="text-xs font-semibold text-gray-700">{t.car_type}</span>
                {t.avg_export_usd && (
                  <span className="text-[10px] text-gray-400 mt-0.5">${Math.round(t.avg_export_usd).toLocaleString()}</span>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 차종별 실적 */}
      <Card title={<span><BarChart2 className="inline w-4 h-4 mr-2" />차종별 수출 실적 및 권장 매입가</span>} size="small">
        <p className="text-xs text-gray-400 mb-3">
          권장최대매입가 = 평균판매가KRW − (평균m3 × ${stats.shipping_per_m3} × {stats.usd_rate.toLocaleString()}) − 기타비용(₩{stats.other_cost_krw.toLocaleString()})
        </p>
        <Table
          dataSource={stats.model_stats}
          columns={modelColumns}
          rowKey={r => `${r.brand}-${r.model}`}
          pagination={{ pageSize: 15 }}
          size="small"
          scroll={{ x: 900 }}
        />
      </Card>

      {/* 수출국별 */}
      <Card title={<span><Globe className="inline w-4 h-4 mr-2" />수출국별 실적</span>} size="small">
        <Table
          dataSource={stats.country_stats}
          columns={countryColumns}
          rowKey="country"
          pagination={false}
          size="small"
        />
      </Card>
    </div>
  );
};

ExportDashboard.getLayout = getDefaultLayout;
ExportDashboard.pageHeader = pageHeader;

export default ExportDashboard;
