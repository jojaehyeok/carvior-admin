'use client';

import { getDefaultLayout, IDefaultLayoutPage, IPageHeader } from "@/components/layout/default-layout";
import { Button, Checkbox, Form, Input, InputNumber, message, Select, Spin, Tag } from "antd";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DamageEditorModal from "@/components/page/store/damage-editor";
import ManualBlurEditorModal from "@/components/page/store/manual-blur-editor";

const CAVIOR_BASE = (process.env.NEXT_PUBLIC_API_ENDPOINT || 'https://carvior.store/api/v1').replace('/api/v1', '');
const INTERNAL_KEY = process.env.NEXT_PUBLIC_STORE_ITEMS_INTERNAL_KEY ?? '';
const INTERNAL_HEADERS = { 'x-internal-key': INTERNAL_KEY };
const EXCHANGE_RATE = 1350;
const FUEL_OPTIONS = ['가솔린', '디젤', '하이브리드', 'LPG', '전기'];
const TRANS_OPTIONS = ['자동', '수동'];
const CATEGORY_OPTIONS = ['SUV', '세단', '해치백', '경차', '소형차', '준중형', '중형', '대형', 'RV', '밴'];

const CAT_LABEL: Record<string, string> = {
  exterior: '외관', interior: '내관', engine: '엔진', wheel: '휠',
  undercarriage: '하부', damage: '손상', extra: '옵션', dashboard: '계기판',
  options: '옵션',
};

interface IBooking {
  id: number; carNumber: string; carOwner: string;
  carModel?: string; address: string;
}

interface IInspection {
  completedAt?: string;
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

const pageHeader: IPageHeader = { title: "스토어 등록" };

const StoreRegisterPage: IDefaultLayoutPage = () => {
  const router = useRouter();
  const { bookingId, storeItemId } = router.query;
  const isEditMode = !!storeItemId;
  const [form] = Form.useForm();

  const [booking, setBooking] = useState<IBooking | null>(null);
  const [inspection, setInspection] = useState<IInspection | null>(null);
  const [storeItem, setStoreItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [ocrLoading, setOcrLoading] = useState<string | null>(null);
  const [photoOrder, setPhotoOrder] = useState<Record<string, string[]>>({});
  const [blurring, setBlurring] = useState<Record<string, boolean>>({});
  const [lightbox, setLightbox] = useState<Lightbox | null>(null);
  const [ocrInfo, setOcrInfo] = useState<{ vin?: string; ownerName?: string }>({});
  const [damageEditorOpen, setDamageEditorOpen] = useState(false);
  const [blurEditTarget, setBlurEditTarget] = useState<{ cat: string; idx: number; url: string } | null>(null);
  const [addingPhoto, setAddingPhoto] = useState<string | null>(null);
  const photoInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // drag state — ref so no re-render
  const dragSrc = useRef<{ cat: string; idx: number } | null>(null);

  // 진단 연계 매물이면 booking/inspection 로드 시점이 등록모드/수정모드마다 달라서 통일
  const effectiveBookingId = booking?.id ?? storeItem?.bookingId;
  const effectiveCarNumber = booking?.carNumber ?? storeItem?.carNumber;

  // ── 신규 등록 모드 (bookingId) ────────────────────────────────
  useEffect(() => {
    if (!bookingId || isEditMode) return;
    const bid = Number(bookingId);
    setLoading(true);
    Promise.all([
      fetch(`${CAVIOR_BASE}/api/admin/bookings`, { headers: INTERNAL_HEADERS }).then(r => r.ok ? r.json() : []),
      fetch(`${CAVIOR_BASE}/api/admin/inspection?bookingId=${bid}`, { headers: INTERNAL_HEADERS }).then(r => r.ok ? r.json() : null),
    ]).then(([bookings, insp]: [IBooking[], IInspection | null]) => {
      const b = bookings.find((x: IBooking) => x.id === bid) ?? null;
      setBooking(b);
      setInspection(insp);
      const carType = insp?.car_info?.type;
      form.setFieldsValue({
        titleKo: (carType && carType !== '알수없음' ? carType : undefined) ?? b?.carModel ?? '',
        year: new Date().getFullYear(),
        fuel: '가솔린',
        transmission: '자동',
        category: 'SUV',
        region: b?.address?.split(' ')[0] ?? '',
        mileage: insp?.car_info?.mileage,
        colorKo: insp?.car_info?.color || undefined,
      });
      if (insp?.images) {
        const order: Record<string, string[]> = {};
        for (const [cat, arr] of Object.entries(insp.images)) {
          if (['registration', 'vin'].includes(cat)) continue; // 개인정보 사진은 별도 처리
          if (Array.isArray(arr) && arr.length) order[cat] = [...arr];
        }
        setPhotoOrder(order);
      }
    }).finally(() => setLoading(false));
  }, [bookingId, isEditMode]);

  // ── 수정 모드 (storeItemId) ────────────────────────────────────
  useEffect(() => {
    if (!storeItemId) return;
    setLoading(true);
    const sid = Number(storeItemId);
    fetch(`${CAVIOR_BASE}/api/v1/admin/store-items/${sid}`, { headers: INTERNAL_HEADERS })
      .then(r => r.ok ? r.json() : null)
      .then(async (item) => {
        if (!item) return;
        setStoreItem(item);
        form.setFieldsValue({
          titleKo:      item.titleKo ?? '',
          titleEn:      item.titleEn ?? '',
          trim:         item.trim ?? '',
          year:         item.year,
          mileage:      item.mileage,
          fuel:         item.fuel ?? '가솔린',
          displacement: item.displacement ?? '',
          transmission: item.transmission ?? '자동',
          colorKo:      item.colorKo ?? '',
          category:     item.category ?? 'SUV',
          region:       item.region ?? '',
          priceKRW:     item.priceKRW,
          adminMemo:    item.adminMemo ?? '',
          maker:        item.maker ?? '',
          accident:     item.accident ?? false,
          status:       item.status,
        });
        if (item.photos && typeof item.photos === 'object') {
          setPhotoOrder(item.photos);
        }
        // 검차 기반 매물이면 inspection 로드 (OCR 가능하게)
        const THRESHOLD = 10_000_000;
        if (item.bookingId && item.bookingId <= THRESHOLD) {
          try {
            const [bookingList, insp] = await Promise.all([
              fetch(`${CAVIOR_BASE}/api/admin/bookings`, { headers: INTERNAL_HEADERS }).then(r => r.ok ? r.json() : []),
              fetch(`${CAVIOR_BASE}/api/admin/inspection?bookingId=${item.bookingId}`, { headers: INTERNAL_HEADERS }).then(r => r.ok ? r.json() : null),
            ]);
            setBooking(bookingList.find((x: IBooking) => x.id === item.bookingId) ?? null);
            setInspection(insp);
          } catch {}
        }
      })
      .finally(() => setLoading(false));
  }, [storeItemId]);

  // ── 사진 조작 ──────────────────────────────────────────────────
  const removePhoto = useCallback((cat: string, idx: number) => {
    setPhotoOrder(prev => ({
      ...prev,
      [cat]: (prev[cat] ?? []).filter((_, i) => i !== idx),
    }));
  }, []);

  const onDragStart = useCallback((cat: string, idx: number) => {
    dragSrc.current = { cat, idx };
  }, []);

  const onDrop = useCallback((cat: string, toIdx: number) => {
    const src = dragSrc.current;
    if (!src || src.cat !== cat || src.idx === toIdx) { dragSrc.current = null; return; }
    setPhotoOrder(prev => {
      const arr = [...(prev[cat] ?? [])];
      const [item] = arr.splice(src.idx, 1);
      arr.splice(toIdx, 0, item);
      return { ...prev, [cat]: arr };
    });
    dragSrc.current = null;
  }, []);

  // ── 사진 추가 업로드 ────────────────────────────────────────────
  const handleAddPhoto = useCallback(async (cat: string, file: File) => {
    if (!effectiveBookingId) { message.error('예약 정보를 먼저 불러온 뒤 사진을 추가해주세요.'); return; }
    setAddingPhoto(cat);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('requestId', String(effectiveBookingId));
      formData.append('category', cat);
      formData.append('carNumber', effectiveCarNumber ?? '');
      const res = await fetch(`${CAVIOR_BASE}/api/v1/external/inspection/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error();
      setPhotoOrder(prev => ({ ...prev, [cat]: [...(prev[cat] ?? []), data.url] }));
      message.success('사진을 추가했습니다.');
    } catch {
      message.error('사진 업로드에 실패했습니다.');
    } finally {
      setAddingPhoto(null);
    }
  }, [effectiveBookingId, effectiveCarNumber]);

  // ── 개별 사진 수동 블러 적용 반영 ───────────────────────────────
  const handleManualBlurApplied = useCallback((cat: string, idx: number, newUrl: string) => {
    setPhotoOrder(prev => {
      const arr = [...(prev[cat] ?? [])];
      arr[idx] = newUrl;
      return { ...prev, [cat]: arr };
    });
  }, []);

  // ── 카테고리 블러 (등록 전 미리보기 — 결과를 기다렸다가 화면에 바로 반영) ──
  const handleBlurCategory = useCallback(async (cat: string) => {
    const urls = photoOrder[cat] ?? [];
    if (!urls.length) return;
    setBlurring(prev => ({ ...prev, [cat]: true }));
    try {
      const res = await fetch(`${CAVIOR_BASE}/api/v1/admin/blur/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.urls)) throw new Error(data.message || '블러 실패');
      setPhotoOrder(prev => ({ ...prev, [cat]: data.urls }));
      message.success(`${CAT_LABEL[cat] ?? cat} 번호판 블러 완료 — 등록 시 이 사진이 사용됩니다.`);
    } catch {
      message.error('블러 처리 실패');
    } finally {
      setBlurring(prev => ({ ...prev, [cat]: false }));
    }
  }, [photoOrder]);

  // ── OCR ────────────────────────────────────────────────────────
  const handleOcr = useCallback(async (mode: 'registration' | 'dashboard') => {
    const photoUrl = mode === 'registration'
      ? inspection?.images?.registration?.[0] ?? null
      : (photoOrder.dashboard ?? [])[0] ?? inspection?.images?.dashboard?.[0] ?? null;

    if (!photoUrl) {
      message.warning(mode === 'registration' ? '자동차등록증 사진이 없습니다.' : '계기판 사진이 없습니다.');
      return;
    }
    setOcrLoading(mode);
    try {
      const res = await fetch(`${CAVIOR_BASE}/api/v1/external/ocr/${mode}/from-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: photoUrl }),
      });
      if (!res.ok) { message.error('OCR 실패'); return; }
      const data = await res.json();
      if (data.error) { message.error(data.error); return; }

      if (mode === 'registration') {
        const fuelMap: Record<string, string> = {
          '가솔린': '가솔린', 'gasoline': '가솔린',
          '디젤': '디젤', 'diesel': '디젤',
          '하이브리드': '하이브리드', 'hybrid': '하이브리드',
          'LPG': 'LPG', 'lpg': 'LPG', '전기': '전기', 'electric': '전기',
        };
        form.setFieldsValue({
          ...(data.carName      && { titleKo: data.carName }),
          ...(data.carBrand     && { maker: data.carBrand }),
          ...(data.modelYear    && { year: Number(data.modelYear) }),
          ...(data.displacement && { displacement: data.displacement }),
          ...(data.mileage      && { mileage: Number(data.mileage) }),
          ...(data.fuelType && fuelMap[data.fuelType] && { fuel: fuelMap[data.fuelType] }),
        });
        // VIN, 소유자는 읽기 전용 표시용으로만
        setOcrInfo(prev => ({
          ...prev,
          ...(data.vin       && { vin: data.vin }),
          ...(data.ownerName && { ownerName: data.ownerName }),
        }));
        message.success('자동차등록증 OCR 자동입력 완료');
      } else {
        if (data.mileage) {
          form.setFieldsValue({ mileage: Number(data.mileage) });
          message.success(`계기판 OCR: 주행거리 ${Number(data.mileage).toLocaleString()} km`);
        } else {
          message.warning('계기판에서 주행거리를 인식하지 못했습니다.');
        }
      }
    } catch {
      message.error('OCR 오류');
    } finally {
      setOcrLoading(null);
    }
  }, [inspection, photoOrder, form]);

  // ── 등록 / 수정 ────────────────────────────────────────────────
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (!values.priceKRW) { message.warning('판매가를 입력해주세요.'); return; }
      setRegistering(true);

      const specs = [
        { label: 'Brand',        value: values.maker || '' },
        { label: 'Year',         value: String(values.year ?? '') },
        { label: 'Mileage',      value: values.mileage ? `${Number(values.mileage).toLocaleString()} KM` : '' },
        { label: 'Fuel',         value: values.fuel ?? '' },
        { label: 'Transmission', value: values.transmission ?? '' },
        { label: 'Displacement', value: values.displacement || '' },
      ].filter(s => s.value);

      // 블러 fire-and-forget
      const allUrls = Object.values(photoOrder).flat();
      if (allUrls.length > 0) {
        fetch(`${CAVIOR_BASE}/api/v1/admin/blur/photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls: allUrls }),
        }).catch(() => {});
      }

      if (isEditMode) {
        // ── 수정 (PATCH) ──
        const res = await fetch(`${CAVIOR_BASE}/api/admin/store-items?id=${storeItemId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...INTERNAL_HEADERS },
          body: JSON.stringify({ ...values, priceUSD: Math.round(values.priceKRW / EXCHANGE_RATE), photos: photoOrder, specs }),
        });
        if (!res.ok) {
          const err = await res.json();
          message.error(err.message ?? err.error ?? '수정 실패');
          return;
        }
        message.success('수정되었습니다.');
        router.push('/store/management');
      } else {
        // ── 신규 등록 (POST) ──
        const body = {
          bookingId: booking!.id,
          carNumber: booking!.carNumber,
          ...values,
          priceUSD: Math.round(values.priceKRW / EXCHANGE_RATE),
          hasReport: true,
          location: 'Korea',
          doors: 5, seats: 5,
          inspectedAt: inspection?.completedAt
            ? new Date(inspection.completedAt).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0],
          status: 'active',
          hidePrice: false,
          photos: photoOrder,
          specs,
          options: [],
        };
        const res = await fetch(`${CAVIOR_BASE}/api/admin/store-items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json();
          message.error(err.message ?? err.error ?? '등록 실패');
          return;
        }
        message.success('스토어에 등록되었습니다.');
        router.push('/store/management');
      }
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error('오류 발생');
    } finally {
      setRegistering(false);
    }
  };

  // ── 라이트박스 키보드 ──────────────────────────────────────────
  useEffect(() => {
    if (!lightbox) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
      if (e.key === 'ArrowRight') setLightbox(lb => lb && lb.idx < lb.photos.length - 1 ? { ...lb, idx: lb.idx + 1 } : lb);
      if (e.key === 'ArrowLeft')  setLightbox(lb => lb && lb.idx > 0 ? { ...lb, idx: lb.idx - 1 } : lb);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightbox]);

  // ── 표시할 카테고리 (동적) ─────────────────────────────────────
  const publicCats = useMemo(
    () => Object.keys(photoOrder).filter(cat => (photoOrder[cat] ?? []).length > 0),
    [photoOrder],
  );

  // 개인정보 사진 (단일 URL)
  const privacyPhotos = useMemo(() => [
    ...(inspection?.images?.registration?.[0] ? [{ url: inspection.images.registration[0], cat: '자동차등록증' }] : []),
    ...(inspection?.images?.vin?.[0] ? [{ url: inspection.images.vin[0], cat: '차대번호' }] : []),
  ], [inspection]);

  if (loading) {
    return <div className="flex items-center justify-center h-96"><Spin size="large" tip="로딩 중…" /></div>;
  }
  if (!isEditMode && !booking) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p>예약을 찾을 수 없습니다.</p>
        <Button className="mt-4" onClick={() => router.back()}>← 돌아가기</Button>
      </div>
    );
  }
  if (isEditMode && !storeItem) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p>매물을 찾을 수 없습니다.</p>
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
            {isEditMode ? '매물 수정' : '스토어 등록'} — <span className="text-violet-600">
              {isEditMode ? (storeItem?.carNumber ?? storeItem?.titleKo) : booking?.carNumber}
            </span>
          </h1>
          <p className="text-xs text-gray-400">
            {isEditMode
              ? storeItem?.titleKo
              : `${booking?.carOwner} · ${booking?.carModel ?? '차종 미상'} · ${booking?.address?.split(' ').slice(0, 2).join(' ')}`}
          </p>
        </div>
      </div>

      <div className="flex gap-6 items-start">
        {/* ── 왼쪽: 사진 편집 ── */}
        <div className="w-[55%] flex flex-col gap-4">

          {/* 개인정보 사진 + OCR 버튼 */}
          {(privacyPhotos.length > 0 || inspection?.images?.registration?.[0] || isEditMode) && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-red-600">⚠️ 개인정보 사진 — 스토어 미노출</p>
                <div className="flex gap-2">
                  <Button
                    size="small"
                    loading={ocrLoading === 'registration'}
                    onClick={() => handleOcr('registration')}
                    style={{ borderColor: '#1677ff', color: '#1677ff' }}
                  >
                    📄 등록증 OCR
                  </Button>
                  <Button
                    size="small"
                    loading={ocrLoading === 'dashboard'}
                    onClick={() => handleOcr('dashboard')}
                    style={{ borderColor: '#7c3aed', color: '#7c3aed' }}
                  >
                    📸 계기판 OCR
                  </Button>
                </div>
              </div>
              {privacyPhotos.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {privacyPhotos.map(({ url, cat }, i) => (
                    <div key={i}
                      className="relative flex-shrink-0 cursor-pointer"
                      onClick={() => setLightbox({ photos: privacyPhotos.map(p => p.url), idx: i })}
                    >
                      <img src={url} alt="" loading="lazy"
                        className="w-28 h-20 object-cover rounded-lg border border-red-200 hover:opacity-80 transition-opacity" />
                      <span className="absolute bottom-1 left-1 text-[9px] bg-red-600 text-white px-1.5 py-0.5 rounded">{cat}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 공개 사진 카테고리별 */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-gray-500">
                📷 사진 편집 — <span className="font-normal text-gray-400">드래그로 순서 변경 · ✕로 제외 · 클릭하면 슬라이드 보기</span>
              </p>
              {inspection && (
                <Button size="small" onClick={() => setDamageEditorOpen(true)}>
                  🔧 손상부위 수정
                </Button>
              )}
            </div>
            {publicCats.length === 0 ? (
              <p className="text-sm text-gray-300 py-8 text-center">진단 사진 없음</p>
            ) : (
              <div className="space-y-5">
                {publicCats.map(cat => {
                  const photos = photoOrder[cat] ?? [];
                  return (
                    <div key={cat}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Tag color="default" className="text-[10px] m-0">{CAT_LABEL[cat] ?? cat}</Tag>
                          <span className="text-[10px] text-gray-400">{photos.length}장</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <input
                            ref={el => { photoInputRefs.current[cat] = el; }}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e => {
                              const file = e.target.files?.[0];
                              if (file) handleAddPhoto(cat, file);
                              e.target.value = '';
                            }}
                          />
                          <Button
                            size="small"
                            loading={addingPhoto === cat}
                            onClick={() => photoInputRefs.current[cat]?.click()}
                            className="text-[10px] h-6 px-2"
                          >
                            ➕ 추가
                          </Button>
                          {(cat === 'exterior' || cat === 'damage') && (
                            <Button
                              size="small"
                              loading={blurring[cat]}
                              onClick={() => handleBlurCategory(cat)}
                              className="text-[10px] h-6 px-2"
                            >
                              번호판 블러
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {photos.map((url, i) => (
                          <div
                            key={`${cat}-${i}-${url.slice(-8)}`}
                            className="relative flex-shrink-0 cursor-grab active:cursor-grabbing select-none"
                            draggable
                            onDragStart={() => onDragStart(cat, i)}
                            onDragOver={e => e.preventDefault()}
                            onDrop={() => onDrop(cat, i)}
                          >
                            {/* 사진 클릭 → 슬라이드 */}
                            <img
                              src={url}
                              alt=""
                              loading="lazy"
                              onClick={() => setLightbox({ photos, idx: i })}
                              className="w-28 h-20 object-cover rounded-lg border hover:opacity-90 transition-opacity"
                            />
                            {/* 대표 뱃지 — 외관 첫 번째 사진만 */}
                            {cat === 'exterior' && i === 0 && (
                              <span className="absolute top-1 left-1 text-[8px] bg-green-600 text-white px-1.5 rounded-full pointer-events-none">대표</span>
                            )}
                            {/* 수동 블러 버튼 — 자동인식이 놓친 얼굴·번호판을 직접 지정 */}
                            <button
                              onClick={e => { e.stopPropagation(); setBlurEditTarget({ cat, idx: i, url }); }}
                              className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] flex items-center justify-center hover:bg-blue-600 transition-colors leading-none"
                              title="수동 블러 처리"
                            >🔧</button>
                            {/* X 버튼 — 항상 표시 */}
                            <button
                              onClick={e => { e.stopPropagation(); removePhoto(cat, i); }}
                              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] font-bold flex items-center justify-center hover:bg-red-600 transition-colors leading-none"
                            >×</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 진단 메모 */}
          {inspection?.evaluation && (
            <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 grid grid-cols-2 gap-3">
              {Object.entries({
                '경고등': inspection.evaluation.warningDesc,
                '누유':   inspection.evaluation.leakDesc,
                '옵션':   inspection.evaluation.optionsDesc,
                '주행':   inspection.evaluation.driveDesc,
              }).filter(([, v]) => v).map(([k, v]) => (
                <div key={k}>
                  <p className="text-[10px] text-gray-400 font-bold mb-0.5">{k}</p>
                  <p className="text-xs text-gray-700">{v}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── 오른쪽: 폼 ── */}
        <div className="flex-1 bg-white rounded-xl border border-gray-100 p-5 sticky top-4">
          {/* 읽기 전용 차량 정보 */}
          <div className="mb-4 bg-gray-50 rounded-lg px-3 py-2.5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div>
              <span className="text-gray-400">차량번호</span>
              <p className="font-mono font-bold text-gray-800">
                {isEditMode ? (storeItem?.carNumber ?? '—') : (booking?.carNumber ?? '—')}
              </p>
            </div>
            <div>
              <span className="text-gray-400">소유자</span>
              <p className="font-bold text-gray-800">
                {ocrInfo.ownerName ?? (isEditMode ? '—' : booking?.carOwner ?? '—')}
              </p>
            </div>
            {ocrInfo.vin && (
              <div className="col-span-2">
                <span className="text-gray-400">차대번호 (VIN)</span>
                <p className="font-mono text-[11px] text-gray-700 break-all">{ocrInfo.vin}</p>
              </div>
            )}
          </div>

          <Form form={form} layout="vertical" size="middle">
            <div className="grid grid-cols-2 gap-x-4">
              <Form.Item label="차량명 (한국어)" name="titleKo" rules={[{ required: true }]} className="col-span-2">
                <Input placeholder="예: 기아 더 뉴 쏘렌토" />
              </Form.Item>
              <Form.Item label="브랜드" name="maker">
                <Input placeholder="예: Audi" />
              </Form.Item>
              <Form.Item label="트림" name="trim">
                <Input placeholder="예: Noblesse" />
              </Form.Item>
              <Form.Item label="연식" name="year">
                <InputNumber className="w-full" />
              </Form.Item>
              <Form.Item label="주행거리 (km)" name="mileage">
                <InputNumber className="w-full" formatter={v => v ? `${Number(v).toLocaleString()}` : ''} />
              </Form.Item>
              <Form.Item label="배기량" name="displacement">
                <Input placeholder="예: 1968cc" />
              </Form.Item>
              <Form.Item label="연료" name="fuel">
                <Select options={FUEL_OPTIONS.map(o => ({ value: o, label: o }))} />
              </Form.Item>
              <Form.Item label="변속기" name="transmission">
                <Select options={TRANS_OPTIONS.map(o => ({ value: o, label: o }))} />
              </Form.Item>
              <Form.Item label="카테고리" name="category">
                <Select options={CATEGORY_OPTIONS.map(o => ({ value: o, label: o }))} />
              </Form.Item>
              <Form.Item label="지역" name="region">
                <Input placeholder="예: 경기도" />
              </Form.Item>
              <Form.Item label="사고 이력" name="accident" valuePropName="checked" className="flex items-end">
                <Checkbox>사고 이력 있음</Checkbox>
              </Form.Item>
              <Form.Item label="판매가 (원)" name="priceKRW" rules={[{ required: true }]} className="col-span-2">
                <InputNumber
                  className="w-full"
                  placeholder="예: 36900000"
                  formatter={v => v ? `${Number(v).toLocaleString()}` : ''}
                />
              </Form.Item>
              <Form.Item label="어드민 메모" name="adminMemo" className="col-span-2">
                <Input.TextArea rows={2} placeholder="내부 참고 메모 (외부 미노출)" />
              </Form.Item>
              {isEditMode && (
                <Form.Item label="판매 상태" name="status" className="col-span-2">
                  <Select
                    options={[
                      { value: 'active',  label: '판매중' },
                      { value: 'pending', label: '검토중 (입금확인)' },
                      { value: 'sold',    label: '거래완료' },
                      { value: 'hidden',  label: '숨김' },
                    ]}
                  />
                </Form.Item>
              )}
            </div>
            <div className="pt-2 border-t border-gray-100 mt-2">
              <Button
                type="primary"
                size="large"
                block
                loading={registering}
                onClick={handleSubmit}
                style={{ background: '#7c3aed', borderColor: '#7c3aed' }}
              >
                {isEditMode ? '수정 저장' : '스토어에 등록하기'}
              </Button>
            </div>
          </Form>
        </div>
      </div>

      {/* ── 라이트박스 ── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightbox(null)}
        >
          {/* 이미지 */}
          <img
            src={lightbox.photos[lightbox.idx]}
            alt=""
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
            onClick={e => e.stopPropagation()}
          />

          {/* 닫기 */}
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 text-white text-xl flex items-center justify-center transition-colors"
          >×</button>

          {/* 인덱스 */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
            {lightbox.idx + 1} / {lightbox.photos.length}
          </div>

          {/* 이전 */}
          {lightbox.idx > 0 && (
            <button
              onClick={e => { e.stopPropagation(); setLightbox(lb => lb ? { ...lb, idx: lb.idx - 1 } : lb); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 text-white text-2xl flex items-center justify-center transition-colors"
            >‹</button>
          )}

          {/* 다음 */}
          {lightbox.idx < lightbox.photos.length - 1 && (
            <button
              onClick={e => { e.stopPropagation(); setLightbox(lb => lb ? { ...lb, idx: lb.idx + 1 } : lb); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 text-white text-2xl flex items-center justify-center transition-colors"
            >›</button>
          )}
        </div>
      )}

      {damageEditorOpen && effectiveBookingId && (
        <DamageEditorModal
          open={damageEditorOpen}
          bookingId={effectiveBookingId}
          initialDamages={inspection?.damages ?? []}
          onClose={() => setDamageEditorOpen(false)}
          onSaved={(damages) => setInspection(prev => prev ? { ...prev, damages } : prev)}
        />
      )}

      {blurEditTarget && (
        <ManualBlurEditorModal
          open={!!blurEditTarget}
          imageUrl={blurEditTarget.url}
          onClose={() => setBlurEditTarget(null)}
          onApplied={(newUrl) => handleManualBlurApplied(blurEditTarget.cat, blurEditTarget.idx, newUrl)}
        />
      )}
    </div>
  );
};

StoreRegisterPage.getLayout = getDefaultLayout;
StoreRegisterPage.pageHeader = pageHeader;

export default StoreRegisterPage;
