import { getDefaultLayout, IDefaultLayoutPage, IPageHeader } from "@/components/layout/default-layout";
import { Alert, Card, Col, Divider, InputNumber, Row, Skeleton, Statistic, Tag } from "antd";
import { Calculator, TrendingUp } from "lucide-react";
import { useState } from "react";

const CLASSIFY_API = "https://carvior.store/classify-api";

const pageHeader: IPageHeader = { title: "매입가 시뮬레이터" };

interface SimResult {
  ok: boolean;
  reason?: string;
  sample_count: number;
  avg_export_price_usd: number;
  avg_export_price_krw: number;
  avg_mileage: number | null;
  avg_year: number | null;
  avg_m3: number | null;
  top_export_country: string | null;
  shipping_usd: number;
  shipping_krw: number;
  other_cost_krw: number;
  shipping_per_m3: number;
  usd_rate: number;
  max_purchase_krw: number;
}

const ExportSimulatorPage: IDefaultLayoutPage = () => {
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState<number | null>(null);
  const [mileage, setMileage] = useState<number | null>(null);
  const [result, setResult] = useState<SimResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const run = async () => {
    if (!brand && !model) return;
    setLoading(true);
    setSearched(true);
    const params = new URLSearchParams();
    if (brand) params.append("brand", brand);
    if (model) params.append("model", model);
    if (year) params.append("year", String(year));
    if (mileage) params.append("mileage", String(mileage));

    try {
      const res = await fetch(`${CLASSIFY_API}/export/simulator?${params}`);
      if (!res.ok) throw new Error();
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
        <p className="text-xs text-gray-400 mb-4">
          수출 원데이터 기반으로 유사 차량의 평균 판매가를 계산하고 권장 최대 매입가를 안내합니다.<br />
          공식: <span className="font-mono text-purple-600">권장매입가 = 평균판매가KRW − (평균m3 × $50 × 환율) − 기타비용</span>
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">브랜드 (메이커)</label>
            <input
              className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-purple-400"
              placeholder="예: BMW, HYUNDAI"
              value={brand}
              onChange={e => setBrand(e.target.value)}
              onKeyDown={e => e.key === "Enter" && run()}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">모델명</label>
            <input
              className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-purple-400"
              placeholder="예: Tucson, 3 Series"
              value={model}
              onChange={e => setModel(e.target.value)}
              onKeyDown={e => e.key === "Enter" && run()}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">연식 (선택)</label>
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
            <label className="text-xs text-gray-500 block mb-1">주행거리 km (선택)</label>
            <InputNumber
              className="w-full"
              placeholder="예: 80000"
              min={0}
              step={5000}
              formatter={v => v ? `${Number(v).toLocaleString()}` : ""}
              value={mileage}
              onChange={v => setMileage(v)}
            />
          </div>
        </div>

        <button
          onClick={run}
          disabled={loading || (!brand && !model)}
          className="mt-4 w-full py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-40 font-semibold text-sm"
        >
          {loading ? "분석 중..." : "시뮬레이션 실행"}
        </button>
      </Card>

      {searched && !loading && !result && (
        <Alert type="error" message="서버에 연결할 수 없습니다" />
      )}

      {loading && <Skeleton active />}

      {!loading && result && (
        result.ok === false ? (
          <Alert type="warning" message={result.reason || "유사 차량 데이터가 없습니다"} description="브랜드/모델명을 영문으로 입력해보세요. (예: HYUNDAI, Tucson)" />
        ) : (
          <Card title={<span><TrendingUp className="inline w-4 h-4 mr-2" />시뮬레이션 결과</span>} size="small">
            <div className="flex flex-wrap gap-2 mb-3">
              <Tag color="blue">유사차량 {result.sample_count}건</Tag>
              {result.avg_year && <Tag>평균연식 {result.avg_year.toFixed(1)}년</Tag>}
              {result.avg_mileage && <Tag>평균주행 {Math.round(result.avg_mileage).toLocaleString()}km</Tag>}
              {result.top_export_country && <Tag color="green">주요수출국: {result.top_export_country}</Tag>}
            </div>

            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <Statistic
                  title="평균 판매가 (USD)"
                  value={result.avg_export_price_usd}
                  prefix="$"
                  precision={0}
                />
              </Col>
              <Col xs={24} sm={12}>
                <Statistic
                  title={`평균 판매가 (KRW, 환율 ${result.usd_rate.toLocaleString()})`}
                  value={result.avg_export_price_krw}
                  prefix="₩"
                  precision={0}
                />
              </Col>
            </Row>

            <Divider />

            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
              <p className="text-xs text-purple-500 font-semibold mb-3">
                권장 최대 매입가 계산
              </p>
              <div className="text-xs text-gray-500 mb-3 font-mono space-y-1">
                {result.avg_m3 ? (
                  <div>평균m3 {result.avg_m3} × ${result.shipping_per_m3} × {result.usd_rate.toLocaleString()} = 운임비 ₩{result.shipping_krw.toLocaleString()}</div>
                ) : (
                  <div>m3 데이터 없음 → 운임비 ₩{result.shipping_krw.toLocaleString()} (10% 추정)</div>
                )}
                <div>
                  ₩{result.avg_export_price_krw.toLocaleString()} − ₩{result.shipping_krw.toLocaleString()}(운임) − ₩{result.other_cost_krw.toLocaleString()}(기타)
                  {" = "}<span className="text-purple-700 font-bold">₩{result.max_purchase_krw.toLocaleString()}</span>
                </div>
              </div>
              <Statistic
                title="권장 최대 매입가 (KRW)"
                value={result.max_purchase_krw}
                prefix="₩"
                precision={0}
                valueStyle={{ color: "#5b21b6", fontWeight: "bold", fontSize: "1.5rem" }}
              />
              <p className="text-[10px] text-gray-400 mt-2">
                * 이 가격 이하로 매입 시 수익 확보 가능 ($1 = ₩{result.usd_rate.toLocaleString()})
              </p>
            </div>
          </Card>
        )
      )}
    </div>
  );
};

ExportSimulatorPage.getLayout = getDefaultLayout;
ExportSimulatorPage.pageHeader = pageHeader;

export default ExportSimulatorPage;
