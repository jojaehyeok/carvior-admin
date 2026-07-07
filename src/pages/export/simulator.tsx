import { getDefaultLayout, IDefaultLayoutPage, IPageHeader } from "@/components/layout/default-layout";
import { Alert, Card, Col, Divider, InputNumber, Row, Skeleton, Statistic, Typography } from "antd";
import { Calculator, TrendingUp } from "lucide-react";
import { useState } from "react";

const CLASSIFY_API = "https://carvior.store/classify-api";

const pageHeader: IPageHeader = { title: "매입가 시뮬레이터" };

interface SimResult {
  ok: boolean;
  reason?: string;
  sample_count: number;
  avg_export_price_usd: number;
  avg_purchase_price_krw: number;
  avg_profit_usd: number;
  target_profit_usd: number;
  recommended_purchase_krw: number;
  max_purchase_krw: number;
  usd_rate: number;
}

const ExportSimulatorPage: IDefaultLayoutPage = () => {
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState<number | null>(null);
  const [mileage, setMileage] = useState<number | null>(null);
  const [targetProfit, setTargetProfit] = useState<number | null>(null);
  const [result, setResult] = useState<SimResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const run = async () => {
    setLoading(true);
    setSearched(true);
    const params = new URLSearchParams();
    if (brand) params.append("brand", brand);
    if (model) params.append("model", model);
    if (year) params.append("year", String(year));
    if (mileage) params.append("mileage", String(mileage));
    if (targetProfit) params.append("target_profit_usd", String(targetProfit));

    try {
      const res = await fetch(`${CLASSIFY_API}/export/simulator?${params}`);
      const data = await res.json();
      setResult(data);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <Card title={<span><Calculator className="inline w-4 h-4 mr-2" />입력 조건</span>} size="small">
        <Typography.Paragraph type="secondary">
          과거 수출 데이터를 기반으로 유사 차량의 평균 수출가를 계산하고, 목표 수익 달성을 위한 권장 매입가를 안내합니다.
        </Typography.Paragraph>

        <div className="grid grid-cols-2 gap-4 mt-2">
          <div>
            <label className="text-xs text-gray-500 block mb-1">브랜드</label>
            <input
              className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-purple-400"
              placeholder="예: 현대"
              value={brand}
              onChange={e => setBrand(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">모델명</label>
            <input
              className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-purple-400"
              placeholder="예: 소나타"
              value={model}
              onChange={e => setModel(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">연식</label>
            <InputNumber
              className="w-full"
              placeholder="예: 2020"
              min={2000}
              max={2030}
              value={year}
              onChange={v => setYear(v)}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">주행거리 (km)</label>
            <InputNumber
              className="w-full"
              placeholder="예: 50000"
              min={0}
              step={1000}
              formatter={v => v ? `${Number(v).toLocaleString()}` : ""}
              value={mileage}
              onChange={v => setMileage(v)}
            />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500 block mb-1">목표 수익 (USD) — 미입력 시 설정값 사용</label>
            <InputNumber
              className="w-full"
              placeholder="예: 500"
              min={0}
              step={100}
              prefix="$"
              value={targetProfit}
              onChange={v => setTargetProfit(v)}
            />
          </div>
        </div>

        <button
          onClick={run}
          disabled={loading}
          className="mt-4 w-full py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-semibold text-sm"
        >
          {loading ? "분석 중..." : "시뮬레이션 실행"}
        </button>
      </Card>

      {searched && !loading && !result && (
        <Alert type="error" message="서버에 연결할 수 없습니다" />
      )}

      {!loading && result && (
        result.ok === false ? (
          <Alert type="warning" message={result.reason || "유사 차량 데이터가 없습니다"} />
        ) : (
          <Card title={<span><TrendingUp className="inline w-4 h-4 mr-2" />시뮬레이션 결과</span>} size="small">
            <Typography.Text type="secondary" className="text-xs">
              유사 차량 {result.sample_count}건 기반 · 환율 ₩{result.usd_rate.toLocaleString()}/USD
            </Typography.Text>

            <Divider />

            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <Statistic
                  title="예상 평균 수출가"
                  value={result.avg_export_price_usd}
                  prefix="$"
                  precision={0}
                />
              </Col>
              <Col xs={24} sm={12}>
                <Statistic
                  title="과거 평균 수익"
                  value={result.avg_profit_usd}
                  prefix="$"
                  precision={0}
                  valueStyle={{ color: result.avg_profit_usd >= 0 ? "#3f8600" : "#cf1322" }}
                />
              </Col>
            </Row>

            <Divider />

            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mt-2">
              <p className="text-xs text-purple-500 font-semibold mb-3">
                목표 수익 ${result.target_profit_usd.toLocaleString()} USD 달성을 위한 권장 매입가
              </p>
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12}>
                  <Statistic
                    title="권장 매입가 (최적)"
                    value={result.recommended_purchase_krw}
                    prefix="₩"
                    precision={0}
                    valueStyle={{ color: "#5b21b6", fontWeight: "bold" }}
                  />
                </Col>
                <Col xs={24} sm={12}>
                  <Statistic
                    title="최대 매입가 (마지노선)"
                    value={result.max_purchase_krw}
                    prefix="₩"
                    precision={0}
                    valueStyle={{ color: "#b45309" }}
                  />
                </Col>
              </Row>
              <p className="text-xs text-gray-400 mt-3">
                * 권장: 수익 ${result.target_profit_usd} 확보 / 최대: 수익 ${(result.target_profit_usd * 0.5).toFixed(0)} 확보 기준
              </p>
            </div>
          </Card>
        )
      )}

      {loading && <Skeleton active />}
    </div>
  );
};

ExportSimulatorPage.getLayout = getDefaultLayout;
ExportSimulatorPage.pageHeader = pageHeader;

export default ExportSimulatorPage;
