import { getDefaultLayout, IDefaultLayoutPage, IPageHeader } from "@/components/layout/default-layout";
import { Alert, Card, Col, Row, Skeleton, Statistic, Table, Tag } from "antd";
import { BarChart2, DollarSign, Globe, TrendingUp, Truck } from "lucide-react";
import { useEffect, useState } from "react";

const CLASSIFY_API = "https://carvior.store/classify-api";

const pageHeader: IPageHeader = { title: "수출 데이터 분석" };

interface Stats {
  total_cars: number;
  avg_profit_usd: number | null;
  total_profit_usd: number | null;
  avg_export_price_usd: number | null;
  model_stats: { brand: string; model: string; count: number; avg_profit_usd: number | null; avg_export_usd: number | null; avg_purchase_krw: number | null }[];
  country_stats: { country: string; count: number; avg_profit_usd: number | null }[];
  year_stats: { year: number; count: number; avg_profit_usd: number | null }[];
  monthly_trend: { month: string; count: number; total_profit_usd: number | null }[];
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
  if (error || !stats) return <Alert type="error" message="데이터를 불러오지 못했습니다. classify-api 서버를 확인하세요." />;

  const modelColumns = [
    { title: "브랜드", dataIndex: "brand", key: "brand", render: (v: string) => v || "-" },
    { title: "모델", dataIndex: "model", key: "model", render: (v: string) => <strong>{v}</strong> },
    { title: "건수", dataIndex: "count", key: "count", sorter: (a: any, b: any) => a.count - b.count },
    {
      title: "평균 수출가 (USD)",
      dataIndex: "avg_export_usd",
      key: "avg_export_usd",
      render: (v: number | null) => v ? `$${v.toLocaleString()}` : "-",
      sorter: (a: any, b: any) => (a.avg_export_usd || 0) - (b.avg_export_usd || 0),
    },
    {
      title: "평균 매입가 (KRW)",
      dataIndex: "avg_purchase_krw",
      key: "avg_purchase_krw",
      render: (v: number | null) => v ? `₩${Math.round(v).toLocaleString()}` : "-",
    },
    {
      title: "평균 수익 (USD)",
      dataIndex: "avg_profit_usd",
      key: "avg_profit_usd",
      render: (v: number | null) => {
        if (!v) return "-";
        return <Tag color={v >= 0 ? "green" : "red"}>${v.toLocaleString()}</Tag>;
      },
      sorter: (a: any, b: any) => (a.avg_profit_usd || 0) - (b.avg_profit_usd || 0),
    },
  ];

  const countryColumns = [
    { title: "수출국", dataIndex: "country", key: "country" },
    { title: "건수", dataIndex: "count", key: "count", sorter: (a: any, b: any) => a.count - b.count },
    {
      title: "평균 수익 (USD)",
      dataIndex: "avg_profit_usd",
      key: "avg_profit_usd",
      render: (v: number | null) => v ? <Tag color={v >= 0 ? "green" : "red"}>${v.toLocaleString()}</Tag> : "-",
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
              title="평균 수출가"
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
              title="평균 수익"
              value={stats.avg_profit_usd ?? 0}
              prefix={<TrendingUp className="inline w-4 h-4 mr-1 text-purple-500" />}
              suffix="USD"
              precision={0}
              valueStyle={{ color: (stats.avg_profit_usd ?? 0) >= 0 ? "#3f8600" : "#cf1322" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="총 누적 수익"
              value={stats.total_profit_usd ?? 0}
              prefix={<BarChart2 className="inline w-4 h-4 mr-1 text-orange-500" />}
              suffix="USD"
              precision={0}
            />
          </Card>
        </Col>
      </Row>

      {/* 월별 추이 */}
      {stats.monthly_trend.length > 0 && (
        <Card title="월별 수출 수익 추이" size="small">
          <div className="overflow-x-auto">
            <div className="flex items-end gap-2 min-w-max h-40 px-2">
              {(() => {
                const maxProfit = Math.max(...stats.monthly_trend.map(m => m.total_profit_usd ?? 0), 1);
                return stats.monthly_trend.map(m => (
                  <div key={m.month} className="flex flex-col items-center gap-1">
                    <span className="text-xs text-gray-500">${((m.total_profit_usd ?? 0) / 1000).toFixed(1)}k</span>
                    <div
                      className="w-10 rounded-t bg-purple-400 hover:bg-purple-600 transition-colors cursor-default"
                      style={{ height: `${Math.max(4, ((m.total_profit_usd ?? 0) / maxProfit) * 120)}px` }}
                      title={`${m.month}: $${m.total_profit_usd?.toLocaleString()} (${m.count}건)`}
                    />
                    <span className="text-[10px] text-gray-400 rotate-[-45deg] origin-top-left translate-y-2">{m.month}</span>
                  </div>
                ));
              })()}
            </div>
          </div>
        </Card>
      )}

      {/* 모델별 */}
      <Card title={<span><BarChart2 className="inline w-4 h-4 mr-2" />모델별 수출 실적</span>} size="small">
        <Table
          dataSource={stats.model_stats}
          columns={modelColumns}
          rowKey={r => `${r.brand}-${r.model}`}
          pagination={{ pageSize: 10 }}
          size="small"
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
