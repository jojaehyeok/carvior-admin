import { Button, Modal, message } from "antd";
import { useEffect, useRef, useState } from "react";

const CAVIOR_BASE = (process.env.NEXT_PUBLIC_API_ENDPOINT || 'https://carvior.store/api/v1').replace('/api/v1', '');

interface Rect { xFrac: number; yFrac: number; wFrac: number; hFrac: number }
interface Version { versionId: string; lastModified: string; isLatest: boolean; sizeKB: number }

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
  const [versions, setVersions] = useState<Version[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  // 자동/수동 블러가 사진을 잘못 덮어썼을 때 되돌릴 수 있게, 열릴 때마다 S3 이전 버전 목록을 조회
  // (버킷 버전관리를 2026-08-13에 켜서, 그 이후 덮어써진 사진만 이전 버전이 남아있음)
  useEffect(() => {
    if (!open || !imageUrl) { setVersions([]); return; }
    setLoadingVersions(true);
    fetch(`${CAVIOR_BASE}/api/v1/admin/blur/list-versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl }),
    })
      .then(res => res.json())
      .then(data => setVersions(Array.isArray(data.versions) ? data.versions : []))
      .catch(() => setVersions([]))
      .finally(() => setLoadingVersions(false));
  }, [open, imageUrl]);

  const handleRestore = async (versionId: string) => {
    setRestoringId(versionId);
    try {
      const res = await fetch(`${CAVIOR_BASE}/api/v1/admin/blur/restore-version`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl, versionId }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error();
      message.success("이전 버전으로 복원했습니다.");
      onApplied(data.url);
      onClose();
    } catch {
      message.error("복원에 실패했습니다.");
    } finally {
      setRestoringId(null);
    }
  };

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

      <div className="mt-4 pt-4 border-t border-gray-100">
        <p className="text-xs font-bold text-gray-600 mb-2">이전 버전으로 복원</p>
        {loadingVersions ? (
          <p className="text-[11px] text-gray-400">버전 조회 중…</p>
        ) : versions.length <= 1 ? (
          <p className="text-[11px] text-gray-400">복원 가능한 이전 버전이 없습니다. (버킷 버전관리를 켠 이후 덮어써진 사진만 기록이 남아요)</p>
        ) : (
          <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto">
            {versions.map(v => (
              <div key={v.versionId} className="flex items-center justify-between text-[11px] bg-gray-50 rounded-lg px-3 py-1.5">
                <span className="text-gray-500">
                  {new Date(v.lastModified).toLocaleString('ko-KR')} {v.isLatest && <span className="text-violet-500 font-bold">(현재)</span>}
                </span>
                {!v.isLatest && (
                  <Button
                    size="small"
                    loading={restoringId === v.versionId}
                    onClick={() => handleRestore(v.versionId)}
                  >
                    이 버전으로 복원
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
