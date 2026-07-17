import { Button, Modal, message } from "antd";
import { useState } from "react";

const CAVIOR_BASE = (process.env.NEXT_PUBLIC_API_ENDPOINT || 'https://carvior.store/api/v1').replace('/api/v1', '');
const INTERNAL_KEY = process.env.NEXT_PUBLIC_STORE_ITEMS_INTERNAL_KEY ?? '';

// cavior의 app/report/[id]/page.tsx DamageChecker와 동일 데이터(좌표계 2109x4001 기준)
const PART_NAMES = [
  "운전석 앞휀더", "운전석 앞도어", "운전석 A필러", "운전석 사이드실 패널",
  "운전석 B필러", "운전석 뒷도어", "운전석 C필러", "운전석 쿼터패널",
  "후드", "루프패널", "트렁크 리드",
  "조수석 앞휀더", "조수석 A필러", "조수석 앞도어", "조수석 사이드실 패널",
  "조수석 B필러", "조수석 뒷도어", "조수석 C필러", "조수석 쿼터패널",
  "라디에이터 서포트", "프런트 패널",
  "운전석 인사이드 패널", "운전석 프런트 사이드멤버", "조수석 프런트 사이드멤버",
  "조수석 인사이드 패널", "운전석 프런트 휠하우스", "조수석 프런트 휠하우스",
  "크로스 멤버", "대쉬 패널", "플로어 패널", "패키지 트레이",
  "운전석 리어 휠하우스", "운전석 리어 사이드멤버", "트렁크 플로어 패널",
  "조수석 리어 사이드멤버", "조수석 리어 휠하우스", "리어 패널",
];
const CHECK_POSITIONS = [
  { x: 311.83, y: 240.14 }, { x: 260.03, y: 892.29 }, { x: 509.3, y: 762.29 },
  { x: 86.64, y: 1111.77 }, { x: 508.86, y: 1142.25 }, { x: 260.03, y: 1333.65 },
  { x: 512.24, y: 1648.91 }, { x: 374.88, y: 1910.12 }, { x: 983.46, y: 458.1 },
  { x: 983.46, y: 1212.79 }, { x: 983.46, y: 1816.54 }, { x: 1667.97, y: 240.48 },
  { x: 1469.7, y: 762.29 }, { x: 1718.76, y: 892.63 }, { x: 1892.36, y: 1111.77 },
  { x: 1470.94, y: 1142.58 }, { x: 1718.76, y: 1333.98 }, { x: 1466.56, y: 1648.24 },
  { x: 1604.92, y: 1910.45 }, { x: 988.04, y: 2101.36 }, { x: 988.04, y: 2241.4 },
  { x: 723.78, y: 2411.14 }, { x: 866.79, y: 2488.66 }, { x: 1099.87, y: 2488.4 },
  { x: 1244.45, y: 2411.14 }, { x: 727.0, y: 2622.66 }, { x: 1237.35, y: 2622.66 },
  { x: 991.04, y: 2784.37 }, { x: 991.04, y: 2922.09 }, { x: 991.04, y: 3153.39 },
  { x: 995.47, y: 3403.48 }, { x: 710.25, y: 3552.65 }, { x: 849.93, y: 3590.53 },
  { x: 987.15, y: 3590.53 }, { x: 1124.26, y: 3590.53 }, { x: 1264.94, y: 3550.65 },
  { x: 992.15, y: 3764.23 },
];
const ORIGINAL_W = 2109;
const ORIGINAL_H = 4001;
const SYMBOL_STYLE: Record<string, { label: string; bg: string }> = {
  X: { label: "교환", bg: "#ef4444" },
  W: { label: "용접", bg: "#3b82f6" },
  M: { label: "탈부착", bg: "#eab308" },
  A: { label: "흠집", bg: "#3b82f6" },
  U: { label: "요철", bg: "#a855f7" },
  T: { label: "깨짐", bg: "#6b7280" },
  C: { label: "부식", bg: "#22c55e" },
  P: { label: "도장필요", bg: "#ec4899" },
  B: { label: "판금", bg: "#8b5cf6" },
};
// 실제로는 X(교환)/W(용접)/B(판금) 3가지만 사용 — 나머지는 과거 데이터 표시 호환용으로만 남겨둠
const SYMBOL_ORDER = ["X", "W", "B"];

export default function DamageEditorModal({
  open,
  bookingId,
  initialDamages,
  onClose,
  onSaved,
}: {
  open: boolean;
  bookingId: number;
  initialDamages: string[][];
  onClose: () => void;
  onSaved: (damages: string[][]) => void;
}) {
  const [damages, setDamages] = useState<string[][]>(() => {
    const base = Array.from({ length: PART_NAMES.length }, () => [] as string[]);
    (initialDamages ?? []).forEach((d, i) => { if (base[i]) base[i] = d ?? []; });
    return base;
  });
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const setSymbol = (i: number, sym: string | null) => {
    setDamages(prev => {
      const next = [...prev];
      next[i] = sym ? [sym] : [];
      return next;
    });
    setActiveIdx(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${CAVIOR_BASE}/api/v1/external/inspection/${bookingId}/damages`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-internal-key": INTERNAL_KEY },
        body: JSON.stringify({ checkedDamages: damages }),
      });
      if (!res.ok) throw new Error();
      message.success("손상부위를 저장했습니다.");
      onSaved(damages);
      onClose();
    } catch {
      message.error("손상부위 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const spotCount = damages.filter(d => d.length > 0).length;

  return (
    <Modal
      title={`손상부위 수정 — ${spotCount}개 표시 중`}
      open={open}
      onCancel={onClose}
      width={520}
      footer={[
        <Button key="cancel" onClick={onClose}>취소</Button>,
        <Button key="save" type="primary" loading={saving} onClick={handleSave}>저장</Button>,
      ]}
    >
      <p className="text-xs text-gray-400 mb-3">부위를 클릭해서 손상 유형을 선택하세요. 이미 표시된 부위는 클릭하면 유형을 바꾸거나 지울 수 있어요.</p>
      <div className="relative w-full" style={{ aspectRatio: `${ORIGINAL_W} / ${ORIGINAL_H}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="https://carvior.store/car-damage-bg.svg" alt="차량 도면" className="absolute inset-0 w-full h-full" draggable={false} />
        {CHECK_POSITIONS.map((pos, i) => {
          const syms = damages[i] ?? [];
          const sym = syms[0];
          const style = sym ? SYMBOL_STYLE[sym] : null;
          const leftPct = ((pos.x + 60) / ORIGINAL_W) * 100;
          const topPct = ((pos.y + 60) / ORIGINAL_H) * 100;
          return (
            <button
              key={i}
              onClick={() => setActiveIdx(activeIdx === i ? null : i)}
              title={PART_NAMES[i]}
              className="absolute flex items-center justify-center rounded-full border-2 transition-transform hover:scale-110"
              style={{
                left: `${leftPct}%`,
                top: `${topPct}%`,
                width: 22, height: 22,
                transform: "translate(-50%, -50%)",
                background: style?.bg ?? "rgba(255,255,255,0.7)",
                borderColor: style?.bg ?? "#d1d5db",
                color: "#fff",
                fontSize: 11,
                fontWeight: 800,
                zIndex: activeIdx === i ? 20 : 1,
              }}
            >
              {sym ?? ""}
              {activeIdx === i && (
                <div
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-1.5 flex flex-col gap-0.5 z-30"
                  style={{ width: 132 }}
                  onClick={e => e.stopPropagation()}
                >
                  <p className="text-[10px] text-gray-400 px-1 mb-0.5">{PART_NAMES[i]}</p>
                  <div className="flex flex-wrap gap-1">
                    {SYMBOL_ORDER.map(s => (
                      <button
                        key={s}
                        onClick={() => setSymbol(i, s)}
                        className="text-[10px] font-bold text-white rounded px-1.5 py-1"
                        style={{ background: SYMBOL_STYLE[s].bg }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setSymbol(i, null)}
                    className="text-[10px] font-semibold text-gray-500 border border-gray-200 rounded px-1.5 py-1 mt-0.5 hover:bg-gray-50"
                  >
                    정상(지우기)
                  </button>
                </div>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        {SYMBOL_ORDER.map(s => (
          <span key={s} className="flex items-center gap-1 text-[10px] text-gray-500">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: SYMBOL_STYLE[s].bg }} />
            {s} {SYMBOL_STYLE[s].label}
          </span>
        ))}
      </div>
    </Modal>
  );
}
