import { getDefaultLayout, IDefaultLayoutPage, IPageHeader } from "@/components/layout/default-layout";
import { Alert, Card, InputNumber, Skeleton, Typography } from "antd";
import { Settings } from "lucide-react";
import { useEffect, useState } from "react";

const CLASSIFY_API = "https://carvior.store/classify-api";

const pageHeader: IPageHeader = { title: "수출 분석 설정" };

interface ExportSettings {
  usd_rate: string;
  target_profit_usd: string;
  shipping_cost_usd: string;
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
      if (data.ok) {
        setMessage({ type: "success", text: "설정이 저장되었습니다" });
      } else {
        setMessage({ type: "error", text: "저장 실패" });
      }
    } catch {
      setMessage({ type: "error", text: "서버 연결 실패" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Skeleton active />;

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
              max={2000}
              step={10}
              prefix="₩"
              value={settings ? Number(settings.usd_rate) : 1350}
              onChange={v => setSettings(s => s ? { ...s, usd_rate: String(v ?? 1350) } : s)}
            />
            <Typography.Text type="secondary" className="text-xs">
              수출가가 원화로 입력된 경우 이 환율로 USD 변환됩니다
            </Typography.Text>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">목표 수익 (USD)</label>
            <InputNumber
              className="w-full"
              min={0}
              step={50}
              prefix="$"
              value={settings ? Number(settings.target_profit_usd) : 500}
              onChange={v => setSettings(s => s ? { ...s, target_profit_usd: String(v ?? 500) } : s)}
            />
            <Typography.Text type="secondary" className="text-xs">
              시뮬레이터 기본 목표 수익값입니다
            </Typography.Text>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">기본 배송비 (USD)</label>
            <InputNumber
              className="w-full"
              min={0}
              step={50}
              prefix="$"
              value={settings ? Number(settings.shipping_cost_usd) : 300}
              onChange={v => setSettings(s => s ? { ...s, shipping_cost_usd: String(v ?? 300) } : s)}
            />
            <Typography.Text type="secondary" className="text-xs">
              수익 계산 시 참고용으로 표시됩니다
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
    </div>
  );
};

ExportSettingsPage.getLayout = getDefaultLayout;
ExportSettingsPage.pageHeader = pageHeader;

export default ExportSettingsPage;
