'use client';

import { getDefaultLayout, IDefaultLayoutPage, IPageHeader } from "@/components/layout/default-layout";
import { Button, Input, message, Spin, Tag } from "antd";
import { useRouter } from "next/router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import DamageEditorModal from "@/components/page/store/damage-editor";

const CAVIOR_BASE = (process.env.NEXT_PUBLIC_API_ENDPOINT || 'https://carvior.store/api/v1').replace('/api/v1', '');
const INTERNAL_KEY = process.env.NEXT_PUBLIC_STORE_ITEMS_INTERNAL_KEY ?? '';
const INTERNAL_HEADERS = { 'x-internal-key': INTERNAL_KEY };

const CATEGORY_ORDER = ['exterior', 'wheel', 'undercarriage', 'interior', 'engine', 'damage', 'extra', 'extraMemo'];
const CAT_LABEL: Record<string, string> = {
  exterior: '외관', interior: '내관', engine: '엔진', wheel: '휠',
  undercarriage: '하부', damage: '손상', extra: '옵션', extraMemo: '기타사진',
};

// 4시간 지나면 목록 버튼은 비활성화되지만, 이 페이지 자체에도 안전장치로 한 번 더 체크
const REPORT_EDIT_WINDOW_MS = 4 * 60 * 60 * 1000;

interface IReportData {
  completedAt?: string;
  firstCompletedAt?: string;
  car_info?: { number?: string; type?: string; mileage?: number; color?: string; repairCost?: number };
  evaluation?: { warningDesc?: string; leakDesc?: string; optionsDesc?: string; driveDesc?: string; memo?: string };
  damages?: string[][];
  images?: {
    exterior?: string[]; wheel?: string[]; undercarriage?: string[];
    interior?: string[]; engine?: string[]; damage?: string[];
    extra?: string[]; extraMemo?: string[];
    dashboard?: string[]; registration?: string[]; vin?: string[];
  };
}

interface Lightbox { photos: string[]; idx: number; }

const pageHeader: IPageHeader = { title: "리포트 수정" };

// 사진이 많으면(카테고리별 수십 장) 렌더링 비용이 커서, 텍스트 폼 입력(form state)이
// 바뀔 때마다 이 부분까지 매번 다시 그려지지 않도록 별도 컴포넌트로 분리 + memo.
// props(콜백)는 전부 부모에서 안정적인 참조로 넘겨야 memo가 실제로 효과가 있다.
interface PhotoSectionProps {
  photoOrder: Record<string, string[]>;
  regImage: string;
  vinImage: string;
  dashboardImage: string;
  addingPhoto: string | null;
  replacingSingle: string | null;
  onAddPhotos: (cat: string, files: File[]) => void;
  onReplaceSingle: (key: 'registration' | 'vin' | 'dashboard', file: File) => void;
  onMovePhoto: (fromCat: string, fromIdx: number, toCat: string, toIdx: number) => void;
  onRemove: (cat: string, idx: number) => void;
  onLightbox: (photos: string[], idx: number) => void;
  onOpenDamageEditor: () => void;
}

const PhotoSection = React.memo(function PhotoSection({
  photoOrder, regImage, vinImage, dashboardImage, addingPhoto, replacingSingle,
  onAddPhotos, onReplaceSingle, onMovePhoto, onRemove, onLightbox, onOpenDamageEditor,
}: PhotoSectionProps) {
  const singleInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const dragSrc = useRef<{ cat: string; idx: number } | null>(null);
  const [dragOverCat, setDragOverCat] = useState<string | null>(null);

  const handleCategoryDragOver = (e: React.DragEvent, cat: string) => {
    e.preventDefault();
    setDragOverCat(cat);
  };

  const handleCategoryDrop = (e: React.DragEvent, cat: string, toIdx?: number) => {
    e.preventDefault();
    setDragOverCat(null);
    // 데스크톱에서 파일을 바로 끌어다 놓으면 업로드
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onAddPhotos(cat, Array.from(e.dataTransfer.files));
      return;
    }
    // 기존 사진을 다른 자리/다른 카테고리로 이동
    const src = dragSrc.current;
    if (!src) return;
    const targetIdx = toIdx ?? (photoOrder[cat]?.length ?? 0);
    onMovePhoto(src.cat, src.idx, cat, targetIdx);
    dragSrc.current = null;
  };

  return (
    <div className="w-[55%] flex flex-col gap-4">
      {/* 개인정보 사진 */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <p className="text-xs font-bold text-red-600 mb-3">⚠️ 개인정보 사진 — 스토어/리포트 미노출</p>
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'registration' as const, url: regImage, label: '자동차등록증' },
            { key: 'vin' as const, url: vinImage, label: '차대번호' },
            { key: 'dashboard' as const, url: dashboardImage, label: '계기판' },
          ].map(({ key, url, label }) => (
            <div key={key} className="flex flex-col items-center gap-1">
              <input
                ref={el => { singleInputRefs.current[key] = el; }}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) onReplaceSingle(key, f); e.target.value = ''; }}
              />
              {url ? (
                <div className="relative cursor-pointer" onClick={() => onLightbox([url], 0)}>
                  <img src={url} alt="" loading="lazy" className="w-28 h-20 object-cover rounded-lg border border-red-200 hover:opacity-80 transition-opacity" />
                  <span className="absolute bottom-1 left-1 text-[9px] bg-red-600 text-white px-1.5 py-0.5 rounded">{label}</span>
                </div>
              ) : (
                <div className="w-28 h-20 rounded-lg border border-dashed border-red-200 flex items-center justify-center text-[10px] text-gray-300">없음</div>
              )}
              <Button
                size="small"
                loading={replacingSingle === key}
                onClick={() => singleInputRefs.current[key]?.click()}
                className="text-[10px] h-6 px-2"
              >
                {url ? '교체' : '업로드'}
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* 공개 사진 카테고리별 */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-gray-500">
            📷 사진 편집 — <span className="font-normal text-gray-400">사진을 다른 칸으로 끌어다 놓으면 카테고리 이동 · 파일을 바로 끌어다 놓으면 업로드 · ✕로 제외</span>
          </p>
          <Button size="small" onClick={onOpenDamageEditor}>
            🔧 손상부위 수정
          </Button>
        </div>
        <div className="space-y-5">
          {CATEGORY_ORDER.map(cat => {
            const photos = photoOrder[cat] ?? [];
            return (
              <div
                key={cat}
                onDragOver={e => handleCategoryDragOver(e, cat)}
                onDragLeave={() => setDragOverCat(prev => (prev === cat ? null : prev))}
                onDrop={e => handleCategoryDrop(e, cat)}
                className={`rounded-lg p-1.5 -m-1.5 transition-colors ${dragOverCat === cat ? 'bg-violet-50 ring-1 ring-violet-300' : ''}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Tag color="default" className="text-[10px] m-0">{CAT_LABEL[cat] ?? cat}</Tag>
                    <span className="text-[10px] text-gray-400">{photos.length}장</span>
                  </div>
                  {addingPhoto === cat && <span className="text-[10px] text-violet-500">업로드 중…</span>}
                </div>
                {photos.length === 0 ? (
                  <div className="h-14 rounded-lg border border-dashed border-gray-200 flex items-center justify-center text-[10px] text-gray-300">
                    사진을 여기로 끌어다 놓으세요
                  </div>
                ) : (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {photos.map((url, i) => (
                      <div
                        key={`${cat}-${i}-${url.slice(-8)}`}
                        className="relative flex-shrink-0 cursor-grab active:cursor-grabbing select-none"
                        draggable
                        onDragStart={() => { dragSrc.current = { cat, idx: i }; }}
                        onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                        onDrop={e => { e.stopPropagation(); handleCategoryDrop(e, cat, i); }}
                      >
                        <img
                          src={url}
                          alt=""
                          loading="lazy"
                          onClick={() => onLightbox(photos, i)}
                          className="w-28 h-20 object-cover rounded-lg border hover:opacity-90 transition-opacity"
                        />
                        {cat === 'exterior' && i === 0 && (
                          <span className="absolute top-1 left-1 text-[8px] bg-green-600 text-white px-1.5 rounded-full pointer-events-none">대표</span>
                        )}
                        <button
                          onClick={e => { e.stopPropagation(); onRemove(cat, i); }}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] font-bold flex items-center justify-center hover:bg-red-600 transition-colors leading-none"
                        >×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

const ReportEditPage: IDefaultLayoutPage = () => {
  const router = useRouter();
  const { bookingId } = router.query;

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expired, setExpired] = useState(false);

  const [form, setForm] = useState({
    carNumber: '', carModel: '', mileage: '', color: '', repairCost: '',
    memo: '', warningDesc: '', leakDesc: '', optionsDesc: '', driveDesc: '',
  });

  const [photoOrder, setPhotoOrder] = useState<Record<string, string[]>>({});
  const [dashboardImage, setDashboardImage] = useState<string>('');
  const [regImage, setRegImage] = useState<string>('');
  const [vinImage, setVinImage] = useState<string>('');
  const [damages, setDamages] = useState<string[][]>([]);

  const [lightbox, setLightbox] = useState<Lightbox | null>(null);
  const [damageEditorOpen, setDamageEditorOpen] = useState(false);
  const [addingPhoto, setAddingPhoto] = useState<string | null>(null);
  const [replacingSingle, setReplacingSingle] = useState<string | null>(null);
  // form.carNumber를 ref로도 들고 있어서, 사진 업로드 콜백들이 텍스트 입력 때마다
  // 새로 만들어지지 않고 계속 같은 참조를 유지하게 함(PhotoSection memo가 실제로 먹히려면 필요)
  const carNumberRef = useRef('');
  carNumberRef.current = form.carNumber;

  // ── 로드 ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!bookingId) return;
    setLoading(true);
    fetch(`${CAVIOR_BASE}/api/v1/external/inspection/report/${bookingId}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: IReportData | null) => {
        if (!data) { setNotFound(true); return; }
        if (data.firstCompletedAt && Date.now() - new Date(data.firstCompletedAt).getTime() > REPORT_EDIT_WINDOW_MS) {
          setExpired(true);
        }
        setForm({
          carNumber: data.car_info?.number ?? '',
          carModel: data.car_info?.type ?? '',
          mileage: data.car_info?.mileage != null ? String(data.car_info.mileage) : '',
          color: data.car_info?.color ?? '',
          repairCost: data.car_info?.repairCost != null ? String(data.car_info.repairCost) : '',
          memo: data.evaluation?.memo ?? '',
          warningDesc: data.evaluation?.warningDesc ?? '',
          leakDesc: data.evaluation?.leakDesc ?? '',
          optionsDesc: data.evaluation?.optionsDesc ?? '',
          driveDesc: data.evaluation?.driveDesc ?? '',
        });
        const order: Record<string, string[]> = {};
        if (data.images) {
          for (const [cat, arr] of Object.entries(data.images)) {
            if (['registration', 'vin', 'dashboard'].includes(cat)) continue;
            if (Array.isArray(arr) && arr.length) order[cat] = [...arr];
          }
        }
        setPhotoOrder(order);
        setDashboardImage(data.images?.dashboard?.[0] ?? '');
        setRegImage(data.images?.registration?.[0] ?? '');
        setVinImage(data.images?.vin?.[0] ?? '');
        setDamages(data.damages ?? []);
      })
      .catch(() => message.error('리포트 조회 실패'))
      .finally(() => setLoading(false));
  }, [bookingId]);

  // ── 사진 조작 ──────────────────────────────────────────────────
  const removePhoto = useCallback((cat: string, idx: number) => {
    setPhotoOrder(prev => ({ ...prev, [cat]: (prev[cat] ?? []).filter((_, i) => i !== idx) }));
  }, []);

  // 같은 카테고리 안에서 순서 변경 + 다른 카테고리로 이동(=라벨 변경) 둘 다 처리
  const movePhoto = useCallback((fromCat: string, fromIdx: number, toCat: string, toIdx: number) => {
    if (fromCat === toCat && fromIdx === toIdx) return;
    setPhotoOrder(prev => {
      if (fromCat === toCat) {
        const arr = [...(prev[fromCat] ?? [])];
        const [item] = arr.splice(fromIdx, 1);
        arr.splice(toIdx, 0, item);
        return { ...prev, [fromCat]: arr };
      }
      const fromArr = [...(prev[fromCat] ?? [])];
      const [item] = fromArr.splice(fromIdx, 1);
      const toArr = [...(prev[toCat] ?? [])];
      toArr.splice(toIdx, 0, item);
      return { ...prev, [fromCat]: fromArr, [toCat]: toArr };
    });
  }, []);

  const handleAddPhotos = useCallback(async (cat: string, files: File[]) => {
    if (!bookingId) return;
    setAddingPhoto(cat);
    try {
      const uploaded: string[] = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('requestId', String(bookingId));
        formData.append('category', cat);
        formData.append('carNumber', carNumberRef.current ?? '');
        const res = await fetch(`${CAVIOR_BASE}/api/v1/external/inspection/upload`, { method: 'POST', body: formData });
        const data = await res.json();
        if (res.ok && data.url) uploaded.push(data.url);
      }
      if (uploaded.length) {
        setPhotoOrder(prev => ({ ...prev, [cat]: [...(prev[cat] ?? []), ...uploaded] }));
        message.success(`사진 ${uploaded.length}장을 추가했습니다.`);
      }
      if (uploaded.length < files.length) message.warning('일부 사진 업로드에 실패했습니다.');
    } catch {
      message.error('사진 업로드에 실패했습니다.');
    } finally {
      setAddingPhoto(null);
    }
  }, [bookingId]);

  // 등록증/차대번호/계기판은 단일 사진이라 "추가"가 아니라 "교체"
  const handleReplaceSingle = useCallback(async (key: 'registration' | 'vin' | 'dashboard', file: File) => {
    if (!bookingId) return;
    setReplacingSingle(key);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('requestId', String(bookingId));
      formData.append('category', key);
      formData.append('carNumber', carNumberRef.current ?? '');
      const res = await fetch(`${CAVIOR_BASE}/api/v1/external/inspection/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error();
      if (key === 'registration') setRegImage(data.url);
      if (key === 'vin') setVinImage(data.url);
      if (key === 'dashboard') setDashboardImage(data.url);
      message.success('사진을 교체했습니다.');
    } catch {
      message.error('사진 업로드에 실패했습니다.');
    } finally {
      setReplacingSingle(null);
    }
  }, [bookingId]);

  // ── 저장 ───────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!bookingId) return;
    // 목록 버튼뿐 아니라 URL로 직접 들어와도 4시간 지나면 저장 자체를 막는다
    if (expired) { message.error('수정 가능 시간(진단 완료 후 4시간)이 지났습니다.'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${CAVIOR_BASE}/api/v1/external/inspection/${bookingId}/report-fields`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...INTERNAL_HEADERS },
        body: JSON.stringify({
          carNumber: form.carNumber,
          carModel: form.carModel,
          mileage: form.mileage ? Number(form.mileage) : undefined,
          color: form.color,
          repairCost: form.repairCost ? Number(form.repairCost) : undefined,
          memo: form.memo,
          inspectionDetails: {
            warningDesc: form.warningDesc,
            leakDesc: form.leakDesc,
            optionsDesc: form.optionsDesc,
            driveDesc: form.driveDesc,
          },
          photos: photoOrder,
          dashboardImage,
          regImage,
          vinImage,
        }),
      });
      if (!res.ok) throw new Error();
      message.success('리포트가 수정되었습니다.');
      router.back();
    } catch {
      message.error('리포트 수정 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleLightbox = useCallback((photos: string[], idx: number) => setLightbox({ photos, idx }), []);
  const handleOpenDamageEditor = useCallback(() => setDamageEditorOpen(true), []);

  if (loading) {
    return <div className="flex items-center justify-center h-96"><Spin size="large" tip="로딩 중…" /></div>;
  }
  if (notFound) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p>진단 내역을 찾을 수 없습니다.</p>
        <Button className="mt-4" onClick={() => router.back()}>← 돌아가기</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Button onClick={() => router.back()} size="small">← 목록</Button>
        <div>
          <h1 className="text-lg font-bold text-gray-900 leading-tight">
            리포트 수정 — <span className="text-violet-600">{form.carNumber || '차량번호 미상'}</span>
          </h1>
          <p className="text-xs text-gray-400">
            진단 완료 후 4시간까지만 수정 가능합니다.
            {expired && <span className="text-red-500 font-bold ml-1">— 수정 가능 시간이 지났습니다.</span>}
          </p>
        </div>
      </div>

      <div className="flex gap-6 items-start">
        <PhotoSection
          photoOrder={photoOrder}
          regImage={regImage}
          vinImage={vinImage}
          dashboardImage={dashboardImage}
          addingPhoto={addingPhoto}
          replacingSingle={replacingSingle}
          onAddPhotos={handleAddPhotos}
          onReplaceSingle={handleReplaceSingle}
          onMovePhoto={movePhoto}
          onRemove={removePhoto}
          onLightbox={handleLightbox}
          onOpenDamageEditor={handleOpenDamageEditor}
        />

        {/* ── 오른쪽: 폼 ── */}
        <div className="flex-1 bg-white rounded-xl border border-gray-100 p-5 sticky top-4">
          <div className="space-y-4">
            <div>
              <label className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider mb-1.5 block">차량번호</label>
              <Input value={form.carNumber} onChange={e => setForm(f => ({ ...f, carNumber: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider mb-1.5 block">차종/모델</label>
              <Input value={form.carModel} onChange={e => setForm(f => ({ ...f, carModel: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider mb-1.5 block">주행거리 (km)</label>
                <Input value={form.mileage} onChange={e => setForm(f => ({ ...f, mileage: e.target.value.replace(/[^0-9]/g, '') }))} />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider mb-1.5 block">색상</label>
                <Input value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider mb-1.5 block">수리비 (원)</label>
              <Input value={form.repairCost} onChange={e => setForm(f => ({ ...f, repairCost: e.target.value.replace(/[^0-9]/g, '') }))} />
            </div>

            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs font-bold text-gray-500 my-3">평가 내용</p>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider mb-1.5 block">경고등</label>
                  <Input.TextArea rows={2} value={form.warningDesc} onChange={e => setForm(f => ({ ...f, warningDesc: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider mb-1.5 block">누유</label>
                  <Input.TextArea rows={2} value={form.leakDesc} onChange={e => setForm(f => ({ ...f, leakDesc: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider mb-1.5 block">옵션</label>
                  <Input.TextArea rows={2} value={form.optionsDesc} onChange={e => setForm(f => ({ ...f, optionsDesc: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider mb-1.5 block">주행</label>
                  <Input.TextArea rows={2} value={form.driveDesc} onChange={e => setForm(f => ({ ...f, driveDesc: e.target.value }))} />
                </div>
              </div>
            </div>

            <div>
              <label className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider mb-1.5 block">진단 메모</label>
              <Input.TextArea rows={3} value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} />
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100 mt-2">
            <Button
              type="primary"
              size="large"
              block
              loading={saving}
              disabled={expired}
              onClick={handleSave}
              style={{ background: '#7c3aed', borderColor: '#7c3aed' }}
            >
              {expired ? '수정 가능 시간 지남' : '수정 저장'}
            </Button>
          </div>
        </div>
      </div>

      {/* ── 라이트박스 ── */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={() => setLightbox(null)}>
          <img
            src={lightbox.photos[lightbox.idx]}
            alt=""
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 text-white text-xl flex items-center justify-center transition-colors"
          >×</button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
            {lightbox.idx + 1} / {lightbox.photos.length}
          </div>
          {lightbox.idx > 0 && (
            <button
              onClick={e => { e.stopPropagation(); setLightbox(lb => lb && lb.idx > 0 ? { ...lb, idx: lb.idx - 1 } : lb); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 text-white text-2xl flex items-center justify-center transition-colors"
            >‹</button>
          )}
          {lightbox.idx < lightbox.photos.length - 1 && (
            <button
              onClick={e => { e.stopPropagation(); setLightbox(lb => lb && lb.idx < lb.photos.length - 1 ? { ...lb, idx: lb.idx + 1 } : lb); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 text-white text-2xl flex items-center justify-center transition-colors"
            >›</button>
          )}
        </div>
      )}

      {damageEditorOpen && bookingId && (
        <DamageEditorModal
          open={damageEditorOpen}
          bookingId={Number(bookingId)}
          initialDamages={damages}
          onClose={() => setDamageEditorOpen(false)}
          onSaved={(newDamages: string[][]) => setDamages(newDamages)}
        />
      )}
    </div>
  );
};

ReportEditPage.getLayout = getDefaultLayout;
ReportEditPage.pageHeader = pageHeader;

export default ReportEditPage;
