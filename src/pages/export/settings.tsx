import { getDefaultLayout, IDefaultLayoutPage, IPageHeader } from "@/components/layout/default-layout";
import { Alert, Card, InputNumber, Skeleton, Typography } from "antd";
import { Settings } from "lucide-react";
import { useEffect, useState } from "react";

const CLASSIFY_API = "https://carvior.store/classify-api";

const pageHeader: IPageHeader = { title: "수출 분석 설정" };

interface ExportSettings {
  usd_rate: string;
  other_cost_krw: string;
  shipping_per_m3: string;
}

const ExportSettingsPage: IDefaultLayoutPage = () => {
  const [settings, setSettings] = useState<ExportSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch(`${CLASSIFY_API}/export/settings`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => { if (d && d.usd_rate !== undefined) setSettings(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${CLASSIFY_API}/export/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.ok) setMessage({ type: "success", text: "설정이 저장되었습니다" });
      else setMessage({ type: "error", text: "저장 실패" });
    } catch {
      setMessage({ type: "error", text: "서버 연결 실패" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Skeleton active />;

  const usdRate = Number(settings?.usd_rate ?? 1530);
  const otherCost = Number(settings?.other_cost_krw ?? 1500000);
  const shippingPerM3 = Number(settings?.shipping_per_m3 ?? 50);

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <Card title={<span><Settings className="inline w-4 h-4 mr-2" />기본 설정</span>} size="small">
        <Typography.Paragraph type="secondary">
          수출 분석 및 시뮬레이터에 사용되는 기본값입니다.
        </Typography.Paragraph>

        <div className="flex flex-col gap-5 mt-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">환율 (KRW / USD)</label>
            <InputNumber
              className="w-full"
              min={1000}
              max={3000}
              step={10}
              prefix="₩"
              value={usdRate}
              onChange={v => setSettings(s => s ? { ...s, usd_rate: String(v ?? 1530) } : s)}
            />
            <Typography.Text type="secondary" className="text-xs">
              판매금액(USD) × 환율 = 판매금액(KRW)
            </Typography.Text>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">m3당 운임비 (USD)</label>
            <InputNumber
              className="w-full"
              min={0}
              step={5}
              prefix="$"
              value={shippingPerM3}
              onChange={v => setSettings(s => s ? { ...s, shipping_per_m3: String(v ?? 50) } : s)}
            />
            <Typography.Text type="secondary" className="text-xs">
              운임비(USD) = 차량 m3(전장×전폭×전고) × 이 금액
            </Typography.Text>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">기타비용 (KRW)</label>
            <InputNumber
              className="w-full"
              min={0}
              step={100000}
              prefix="₩"
              value={otherCost}
              onChange={v => setSettings(s => s ? { ...s, other_cost_krw: String(v ?? 1500000) } : s)}
            />
            <Typography.Text type="secondary" className="text-xs">
              통관·검사·기타 비용. 권장매입가 = 판매가KRW − 운임비KRW − 기타비용
            </Typography.Text>
          </div>
        </div>

        {message && (
          <Alert className="mt-4" type={message.type} message={message.text} closable onClose={() => setMessage(null)} />
        )}

        <button
          onClick={save}
          disabled={saving}
          className="mt-6 w-full py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-semibold text-sm"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
      </Card>

      <Card title="공식 미리보기" size="small">
        <div className="font-mono text-sm space-y-1 text-gray-600">
          <div>운임비 = 차량m3 × <span className="text-purple-600">${shippingPerM3}</span> × <span className="text-purple-600">₩{usdRate.toLocaleString()}</span></div>
          <div>권장최대매입가 = 판매가KRW − 운임비KRW − <span className="text-purple-600">₩{otherCost.toLocaleString()}</span></div>
        </div>
      </Card>
    </div>
  );
};

ExportSettingsPage.getLayout = getDefaultLayout;
ExportSettingsPage.pageHeader = pageHeader;

export default ExportSettingsPage;
