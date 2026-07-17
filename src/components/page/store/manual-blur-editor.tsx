import { Button, Modal, message } from "antd";
import { useRef, useState } from "react";

const CAVIOR_BASE = (process.env.NEXT_PUBLIC_API_ENDPOINT || 'https://carvior.store/api/v1').replace('/api/v1', '');

interface Rect { xFrac: number; yFrac: number; wFrac: number; hFrac: number }

export default function ManualBlurEditorModal({
  open,
  imageUrl,
  onClose,
  onApplied,
}: {
  open: boolean;
  imageUrl: string;
  onClose: () => void;
  onApplied: (newUrl: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [regions, setRegions] = useState<Rect[]>([]);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCur, setDrawCur] = useState<{ x: number; y: number } | null>(null);
  const [applying, setApplying] = useState(false);

  const toFrac = (e: React.MouseEvent) => {
    const el = containerRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const p = toFrac(e);
    setDrawStart(p);
    setDrawCur(p);
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!drawStart) return;
    setDrawCur(toFrac(e));
  };
  const handleMouseUp = () => {
    if (!drawStart || !drawCur) { setDrawStart(null); return; }
    const xFrac = Math.min(drawStart.x, drawCur.x);
    const yFrac = Math.min(drawStart.y, drawCur.y);
    const wFrac = Math.abs(drawCur.x - drawStart.x);
    const hFrac = Math.abs(drawCur.y - drawStart.y);
    if (wFrac > 0.01 && hFrac > 0.01) {
      setRegions(prev => [...prev, { xFrac, yFrac, wFrac, hFrac }]);
    }
    setDrawStart(null);
    setDrawCur(null);
  };

  const removeRegion = (i: number) => setRegions(prev => prev.filter((_, idx) => idx !== i));

  const handleApply = async () => {
    if (regions.length === 0) { message.warning("블러 처리할 영역을 드래그로 지정해주세요."); return; }
    setApplying(true);
    try {
      const res = await fetch(`${CAVIOR_BASE}/api/v1/admin/blur/manual-region`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl, regions }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error();
      message.success("수동 블러를 적용했습니다.");
      onApplied(data.url);
      setRegions([]);
      onClose();
    } catch {
      message.error("블러 적용에 실패했습니다.");
    } finally {
      setApplying(false);
    }
  };

  const previewRect = drawStart && drawCur ? {
    left: `${Math.min(drawStart.x, drawCur.x) * 100}%`,
    top: `${Math.min(drawStart.y, drawCur.y) * 100}%`,
    width: `${Math.abs(drawCur.x - drawStart.x) * 100}%`,
    height: `${Math.abs(drawCur.y - drawStart.y) * 100}%`,
  } : null;

  return (
    <Modal
      title="수동 블러 처리"
      open={open}
      onCancel={onClose}
      width={640}
      footer={[
        <Button key="cancel" onClick={onClose}>취소</Button>,
        <Button key="apply" type="primary" loading={applying} onClick={handleApply}>블러 적용</Button>,
      ]}
    >
      <p className="text-xs text-gray-400 mb-3">
        자동 인식이 놓친 얼굴·번호판 등을 드래그로 직접 지정해서 블러 처리하세요. 여러 영역을 지정할 수 있어요.
      </p>
      <div
        ref={containerRef}
        className="relative w-full select-none cursor-crosshair border border-gray-200 rounded-lg overflow-hidden"
        style={{ aspectRatio: "4 / 3" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { setDrawStart(null); setDrawCur(null); }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-contain bg-black" draggable={false} />
        {regions.map((r, i) => (
          <div
            key={i}
            className="absolute border-2 border-red-500 bg-red-500/25 group"
            style={{ left: `${r.xFrac * 100}%`, top: `${r.yFrac * 100}%`, width: `${r.wFrac * 100}%`, height: `${r.hFrac * 100}%` }}
          >
            <button
              onClick={() => removeRegion(i)}
              className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center"
            >×</button>
          </div>
        ))}
        {previewRect && (
          <div className="absolute border-2 border-dashed border-yellow-400 bg-yellow-400/20 pointer-events-none" style={previewRect} />
        )}
      </div>
      <p className="text-[11px] text-gray-400 mt-2">{regions.length}개 영역 지정됨</p>
    </Modal>
  );
}
