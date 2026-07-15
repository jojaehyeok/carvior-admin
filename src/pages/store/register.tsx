'use client';

import { getDefaultLayout, IDefaultLayoutPage, IPageHeader } from "@/components/layout/default-layout";
import { Button, Checkbox, Form, Input, InputNumber, message, Select, Spin, Tag } from "antd";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const CAVIOR_BASE = (process.env.NEXT_PUBLIC_API_ENDPOINT || 'https://carvior.store/api/v1').replace('/api/v1', '');
const EXCHANGE_RATE = 1350;
const FUEL_OPTIONS = ['媛?붾┛', '?붿젮', '?섏씠釉뚮━??, 'LPG', '?꾧린'];
const TRANS_OPTIONS = ['?먮룞', '?섎룞'];
const CATEGORY_OPTIONS = ['SUV', '?몃떒', '?댁튂諛?, '寃쎌감', '?뚰삎李?, '以以묓삎', '以묓삎', '???, 'RV', '諛?];

const CAT_LABEL: Record<string, string> = {
  exterior: '?멸?', interior: '?닿?', engine: '?붿쭊', wheel: '??,
  undercarriage: '?섎?', damage: '?먯긽', extra: '?듭뀡', dashboard: '怨꾧린??,
  options: '?듭뀡',
};

interface IBooking {
  id: number; carNumber: string; carOwner: string;
  carModel?: string; address: string;
}

interface IInspection {
  carModel?: string; mileage?: number; color?: string;
  // ?ㅼ젣 ?뷀떚???꾨뱶: photos (諛곗뿴), regImage/vinImage/dashboardImage (?⑥씪 臾몄옄??
  photos?: {
    exterior?: string[]; wheel?: string[]; undercarriage?: string[];
    interior?: string[]; engine?: string[]; damage?: string[];
    extra?: string[]; extraMemo?: string[];
  };
  regImage?: string;
  vinImage?: string;
  dashboardImage?: string;
  inspectionDetails?: { warningDesc?: string; leakDesc?: string; optionsDesc?: string; driveDesc?: string };
  completedAt?: string;
}

interface Lightbox { photos: string[]; idx: number; }

const pageHeader: IPageHeader = { title: "?ㅽ넗???깅줉" };

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

  // drag state ??ref so no re-render
  const dragSrc = useRef<{ cat: string; idx: number } | null>(null);

  // ?? ?좉퇋 ?깅줉 紐⑤뱶 (bookingId) ????????????????????????????????
  useEffect(() => {
    if (!bookingId || isEditMode) return;
    const bid = Number(bookingId);
    setLoading(true);
    Promise.all([
      fetch(`${CAVIOR_BASE}/api/admin/bookings`).then(r => r.ok ? r.json() : []),
      fetch(`${CAVIOR_BASE}/api/admin/inspection?bookingId=${bid}`).then(r => r.ok ? r.json() : null),
    ]).then(([bookings, insp]: [IBooking[], IInspection | null]) => {
      const b = bookings.find((x: IBooking) => x.id === bid) ?? null;
      setBooking(b);
      setInspection(insp);
      form.setFieldsValue({
        titleKo: insp?.carModel ?? b?.carModel ?? '',
        year: new Date().getFullYear(),
        fuel: '媛?붾┛',
        transmission: '?먮룞',
        category: 'SUV',
        region: b?.address?.split(' ')[0] ?? '',
        mileage: insp?.mileage,
        colorKo: insp?.color,
      });
      if (insp?.photos) {
        const order: Record<string, string[]> = {};
        for (const [cat, arr] of Object.entries(insp.photos)) {
          if (Array.isArray(arr) && arr.length) order[cat] = [...arr];
        }
        if (insp.dashboardImage) order.dashboard = [insp.dashboardImage];
        setPhotoOrder(order);
      }
    }).finally(() => setLoading(false));
  }, [bookingId, isEditMode]);

  // ?? ?섏젙 紐⑤뱶 (storeItemId) ????????????????????????????????????
  useEffect(() => {
    if (!storeItemId) return;
    setLoading(true);
    const sid = Number(storeItemId);
    fetch(`${CAVIOR_BASE}/api/v1/admin/store-items/${sid}`)
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
          fuel:         item.fuel ?? '媛?붾┛',
          displacement: item.displacement ?? '',
          transmission: item.transmission ?? '?먮룞',
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
        // 寃李?湲곕컲 留ㅻЪ?대㈃ inspection 濡쒕뱶 (OCR 媛?ν븯寃?
        const THRESHOLD = 10_000_000;
        if (item.bookingId && item.bookingId <= THRESHOLD) {
          try {
            const [bookingList, insp] = await Promise.all([
              fetch(`${CAVIOR_BASE}/api/admin/bookings`).then(r => r.ok ? r.json() : []),
              fetch(`${CAVIOR_BASE}/api/admin/inspection?bookingId=${item.bookingId}`).then(r => r.ok ? r.json() : null),
            ]);
            setBooking(bookingList.find((x: IBooking) => x.id === item.bookingId) ?? null);
            setInspection(insp);
          } catch {}
        }
      })
      .finally(() => setLoading(false));
  }, [storeItemId]);

  // ?? ?ъ쭊 議곗옉 ??????????????????????????????????????????????????
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

  // ?? 移댄뀒怨좊━ 釉붾윭 (?쒕쾭媛 setImmediate濡?諛깃렇?쇱슫??泥섎━ ??fire-and-forget) ??
  const handleBlurCategory = useCallback((cat: string) => {
    const urls = photoOrder[cat] ?? [];
    if (!urls.length) return;
    setBlurring(prev => ({ ...prev, [cat]: true }));
    fetch(`${CAVIOR_BASE}/api/v1/admin/blur/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls }),
    })
      .then(() => message.success(`${CAT_LABEL[cat] ?? cat} 釉붾윭 泥섎━ ?붿껌 ?꾨즺 (諛깃렇?쇱슫??`))
      .catch(() => message.error('釉붾윭 ?붿껌 ?ㅽ뙣'))
      .finally(() => setBlurring(prev => ({ ...prev, [cat]: false })));
  }, [photoOrder]);

  // ?? OCR ????????????????????????????????????????????????????????
  const handleOcr = useCallback(async (mode: 'registration' | 'dashboard') => {
    const photoUrl = mode === 'registration'
      ? inspection?.regImage ?? null
      : (photoOrder.dashboard ?? [])[0] ?? inspection?.dashboardImage ?? null;

    if (!photoUrl) {
      message.warning(mode === 'registration' ? '?먮룞李⑤벑濡앹쬆 ?ъ쭊???놁뒿?덈떎.' : '怨꾧린???ъ쭊???놁뒿?덈떎.');
      return;
    }
    setOcrLoading(mode);
    try {
      const res = await fetch(`${CAVIOR_BASE}/api/v1/external/ocr/${mode}/from-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: photoUrl }),
      });
      if (!res.ok) { message.error('OCR ?ㅽ뙣'); return; }
      const data = await res.json();
      if (data.error) { message.error(data.error); return; }

      if (mode === 'registration') {
        const fuelMap: Record<string, string> = {
          '媛?붾┛': '媛?붾┛', 'gasoline': '媛?붾┛',
          '?붿젮': '?붿젮', 'diesel': '?붿젮',
          '?섏씠釉뚮━??: '?섏씠釉뚮━??, 'hybrid': '?섏씠釉뚮━??,
          'LPG': 'LPG', 'lpg': 'LPG', '?꾧린': '?꾧린', 'electric': '?꾧린',
        };
        form.setFieldsValue({
          ...(data.carName      && { titleKo: data.carName }),
          ...(data.carBrand     && { maker: data.carBrand }),
          ...(data.modelYear    && { year: Number(data.modelYear) }),
          ...(data.displacement && { displacement: data.displacement }),
          ...(data.mileage      && { mileage: Number(data.mileage) }),
          ...(data.fuelType && fuelMap[data.fuelType] && { fuel: fuelMap[data.fuelType] }),
        });
        // VIN, ?뚯쑀?먮뒗 ?쎄린 ?꾩슜 ?쒖떆?⑹쑝濡쒕쭔
        setOcrInfo(prev => ({
          ...prev,
          ...(data.vin       && { vin: data.vin }),
          ...(data.ownerName && { ownerName: data.ownerName }),
        }));
        message.success('?먮룞李⑤벑濡앹쬆 OCR ?먮룞?낅젰 ?꾨즺');
      } else {
        if (data.mileage) {
          form.setFieldsValue({ mileage: Number(data.mileage) });
          message.success(`怨꾧린??OCR: 二쇳뻾嫄곕━ ${Number(data.mileage).toLocaleString()} km`);
        } else {
          message.warning('怨꾧린?먯뿉??二쇳뻾嫄곕━瑜??몄떇?섏? 紐삵뻽?듬땲??');
        }
      }
    } catch {
      message.error('OCR ?ㅻ쪟');
    } finally {
      setOcrLoading(null);
    }
  }, [inspection, photoOrder, form]);

  // ?? ?깅줉 / ?섏젙 ????????????????????????????????????????????????
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (!values.priceKRW) { message.warning('?먮ℓ媛瑜??낅젰?댁＜?몄슂.'); return; }
      setRegistering(true);

      const specs = [
        { label: 'Brand',        value: values.maker || '' },
        { label: 'Year',         value: String(values.year ?? '') },
        { label: 'Mileage',      value: values.mileage ? `${Number(values.mileage).toLocaleString()} KM` : '' },
        { label: 'Fuel',         value: values.fuel ?? '' },
        { label: 'Transmission', value: values.transmission ?? '' },
        { label: 'Displacement', value: values.displacement || '' },
      ].filter(s => s.value);

      // 釉붾윭 fire-and-forget
      const allUrls = Object.values(photoOrder).flat();
      if (allUrls.length > 0) {
        fetch(`${CAVIOR_BASE}/api/v1/admin/blur/photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls: allUrls }),
        }).catch(() => {});
      }

      if (isEditMode) {
        // ?? ?섏젙 (PATCH) ??
        const res = await fetch(`${CAVIOR_BASE}/api/admin/store-items?id=${storeItemId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...values, priceUSD: Math.round(values.priceKRW / EXCHANGE_RATE), photos: photoOrder, specs }),
        });
        if (!res.ok) {
          const err = await res.json();
          message.error(err.message ?? err.error ?? '?섏젙 ?ㅽ뙣');
          return;
        }
        message.success('?섏젙?섏뿀?듬땲??');
        router.push('/store/management');
      } else {
        // ?? ?좉퇋 ?깅줉 (POST) ??
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
          message.error(err.message ?? err.error ?? '?깅줉 ?ㅽ뙣');
          return;
        }
        message.success('?ㅽ넗?댁뿉 ?깅줉?섏뿀?듬땲??');
        router.push('/store/management');
      }
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error('?ㅻ쪟 諛쒖깮');
    } finally {
      setRegistering(false);
    }
  };

  // ?? ?쇱씠?몃컯???ㅻ낫????????????????????????????????????????????
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

  // ?? ?쒖떆??移댄뀒怨좊━ (?숈쟻) ?????????????????????????????????????
  const publicCats = useMemo(
    () => Object.keys(photoOrder).filter(cat => (photoOrder[cat] ?? []).length > 0),
    [photoOrder],
  );

  // 媛쒖씤?뺣낫 ?ъ쭊 (?⑥씪 URL)
  const privacyPhotos = useMemo(() => [
    ...(inspection?.regImage ? [{ url: inspection.regImage, cat: '?먮룞李⑤벑濡앹쬆' }] : []),
    ...(inspection?.vinImage ? [{ url: inspection.vinImage, cat: '李⑤?踰덊샇' }] : []),
  ], [inspection]);

  if (loading) {
    return <div className="flex items-center justify-center h-96"><Spin size="large" tip="濡쒕뵫 以묅? /></div>;
  }
  if (!isEditMode && !booking) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p>?덉빟??李얠쓣 ???놁뒿?덈떎.</p>
        <Button className="mt-4" onClick={() => router.back()}>???뚯븘媛湲?/Button>
      </div>
    );
  }
  if (isEditMode && !storeItem) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p>留ㅻЪ??李얠쓣 ???놁뒿?덈떎.</p>
        <Button className="mt-4" onClick={() => router.back()}>???뚯븘媛湲?/Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ?ㅻ뜑 */}
      <div className="flex items-center gap-3">
        <Button onClick={() => router.back()} size="small">??紐⑸줉</Button>
        <div>
          <h1 className="text-lg font-bold text-gray-900 leading-tight">
            {isEditMode ? '留ㅻЪ ?섏젙' : '?ㅽ넗???깅줉'} ??<span className="text-violet-600">
              {isEditMode ? (storeItem?.carNumber ?? storeItem?.titleKo) : booking?.carNumber}
            </span>
          </h1>
          <p className="text-xs text-gray-400">
            {isEditMode
              ? storeItem?.titleKo
              : `${booking?.carOwner} 쨌 ${booking?.carModel ?? '李⑥쥌 誘몄긽'} 쨌 ${booking?.address?.split(' ').slice(0, 2).join(' ')}`}
          </p>
        </div>
      </div>

      <div className="flex gap-6 items-start">
        {/* ?? ?쇱そ: ?ъ쭊 ?몄쭛 ?? */}
        <div className="w-[55%] flex flex-col gap-4">

          {/* 媛쒖씤?뺣낫 ?ъ쭊 + OCR 踰꾪듉 */}
          {(privacyPhotos.length > 0 || inspection?.regImage || isEditMode) && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-red-600">?좑툘 媛쒖씤?뺣낫 ?ъ쭊 ???ㅽ넗??誘몃끂異?/p>
                <div className="flex gap-2">
                  <Button
                    size="small"
                    loading={ocrLoading === 'registration'}
                    onClick={() => handleOcr('registration')}
                    style={{ borderColor: '#1677ff', color: '#1677ff' }}
                  >
                    ?뱞 ?깅줉利?OCR
                  </Button>
                  <Button
                    size="small"
                    loading={ocrLoading === 'dashboard'}
                    onClick={() => handleOcr('dashboard')}
                    style={{ borderColor: '#7c3aed', color: '#7c3aed' }}
                  >
                    ?벝 怨꾧린??OCR
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

          {/* 怨듦컻 ?ъ쭊 移댄뀒怨좊━蹂?*/}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs font-bold text-gray-500 mb-3">
              ?벜 ?ъ쭊 ?몄쭛 ??<span className="font-normal text-gray-400">?쒕옒洹몃줈 ?쒖꽌 蹂寃?쨌 ?뺣줈 ?쒖쇅 쨌 ?대┃?섎㈃ ?щ씪?대뱶 蹂닿린</span>
            </p>
            {publicCats.length === 0 ? (
              <p className="text-sm text-gray-300 py-8 text-center">吏꾨떒 ?ъ쭊 ?놁쓬</p>
            ) : (
              <div className="space-y-5">
                {publicCats.map(cat => {
                  const photos = photoOrder[cat] ?? [];
                  return (
                    <div key={cat}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Tag color="default" className="text-[10px] m-0">{CAT_LABEL[cat] ?? cat}</Tag>
                          <span className="text-[10px] text-gray-400">{photos.length}??/span>
                        </div>
                        {(cat === 'exterior' || cat === 'damage') && (
                          <Button
                            size="small"
                            loading={blurring[cat]}
                            onClick={() => handleBlurCategory(cat)}
                            className="text-[10px] h-6 px-2"
                          >
                            踰덊샇??釉붾윭
                          </Button>
                        )}
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
                            {/* ?ъ쭊 ?대┃ ???щ씪?대뱶 */}
                            <img
                              src={url}
                              alt=""
                              loading="lazy"
                              onClick={() => setLightbox({ photos, idx: i })}
                              className="w-28 h-20 object-cover rounded-lg border hover:opacity-90 transition-opacity"
                            />
                            {/* ???諭껋? ???멸? 泥?踰덉㎏ ?ъ쭊留?*/}
                            {cat === 'exterior' && i === 0 && (
                              <span className="absolute top-1 left-1 text-[8px] bg-green-600 text-white px-1.5 rounded-full pointer-events-none">???/span>
                            )}
                            {/* X 踰꾪듉 ????긽 ?쒖떆 */}
                            <button
                              onClick={e => { e.stopPropagation(); removePhoto(cat, i); }}
                              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] font-bold flex items-center justify-center hover:bg-red-600 transition-colors leading-none"
                            >횞</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 吏꾨떒 硫붾え */}
          {inspection?.inspectionDetails && (
            <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 grid grid-cols-2 gap-3">
              {Object.entries({
                '寃쎄퀬??: inspection.inspectionDetails.warningDesc,
                '?꾩쑀':   inspection.inspectionDetails.leakDesc,
                '?듭뀡':   inspection.inspectionDetails.optionsDesc,
                '二쇳뻾':   inspection.inspectionDetails.driveDesc,
              }).filter(([, v]) => v).map(([k, v]) => (
                <div key={k}>
                  <p className="text-[10px] text-gray-400 font-bold mb-0.5">{k}</p>
                  <p className="text-xs text-gray-700">{v}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ?? ?ㅻⅨ履? ???? */}
        <div className="flex-1 bg-white rounded-xl border border-gray-100 p-5 sticky top-4">
          {/* ?쎄린 ?꾩슜 李⑤웾 ?뺣낫 */}
          <div className="mb-4 bg-gray-50 rounded-lg px-3 py-2.5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div>
              <span className="text-gray-400">李⑤웾踰덊샇</span>
              <p className="font-mono font-bold text-gray-800">
                {isEditMode ? (storeItem?.carNumber ?? '??) : (booking?.carNumber ?? '??)}
              </p>
            </div>
            <div>
              <span className="text-gray-400">?뚯쑀??/span>
              <p className="font-bold text-gray-800">
                {ocrInfo.ownerName ?? (isEditMode ? '?? : booking?.carOwner ?? '??)}
              </p>
            </div>
            {ocrInfo.vin && (
              <div className="col-span-2">
                <span className="text-gray-400">李⑤?踰덊샇 (VIN)</span>
                <p className="font-mono text-[11px] text-gray-700 break-all">{ocrInfo.vin}</p>
              </div>
            )}
          </div>

          <Form form={form} layout="vertical" size="middle">
            <div className="grid grid-cols-2 gap-x-4">
              <Form.Item label="李⑤웾紐?(?쒓뎅??" name="titleKo" rules={[{ required: true }]} className="col-span-2">
                <Input placeholder="?? 湲곗븘 ?????섎젋?? />
              </Form.Item>
              <Form.Item label="釉뚮옖?? name="maker">
                <Input placeholder="?? Audi" />
              </Form.Item>
              <Form.Item label="?몃┝" name="trim">
                <Input placeholder="?? Noblesse" />
              </Form.Item>
              <Form.Item label="?곗떇" name="year">
                <InputNumber className="w-full" />
              </Form.Item>
              <Form.Item label="二쇳뻾嫄곕━ (km)" name="mileage">
                <InputNumber className="w-full" formatter={v => v ? `${Number(v).toLocaleString()}` : ''} />
              </Form.Item>
              <Form.Item label="諛곌린?? name="displacement">
                <Input placeholder="?? 1968cc" />
              </Form.Item>
              <Form.Item label="?곕즺" name="fuel">
                <Select options={FUEL_OPTIONS.map(o => ({ value: o, label: o }))} />
              </Form.Item>
              <Form.Item label="蹂?띻린" name="transmission">
                <Select options={TRANS_OPTIONS.map(o => ({ value: o, label: o }))} />
              </Form.Item>
              <Form.Item label="移댄뀒怨좊━" name="category">
                <Select options={CATEGORY_OPTIONS.map(o => ({ value: o, label: o }))} />
              </Form.Item>
              <Form.Item label="吏?? name="region">
                <Input placeholder="?? 寃쎄린?? />
              </Form.Item>
              <Form.Item label="?ш퀬 ?대젰" name="accident" valuePropName="checked" className="flex items-end">
                <Checkbox>?ш퀬 ?대젰 ?덉쓬</Checkbox>
              </Form.Item>
              <Form.Item label="?먮ℓ媛 (??" name="priceKRW" rules={[{ required: true }]} className="col-span-2">
                <InputNumber
                  className="w-full"
                  placeholder="?? 36900000"
                  formatter={v => v ? `${Number(v).toLocaleString()}` : ''}
                />
              </Form.Item>
              <Form.Item label="?대뱶誘?硫붾え" name="adminMemo" className="col-span-2">
                <Input.TextArea rows={2} placeholder="?대? 李멸퀬 硫붾え (?몃? 誘몃끂異?" />
              </Form.Item>
              {isEditMode && (
                <Form.Item label="?먮ℓ ?곹깭" name="status" className="col-span-2">
                  <Select
                    options={[
                      { value: 'active',  label: '?먮ℓ以? },
                      { value: 'pending', label: '寃?좎쨷 (?낃툑?뺤씤)' },
                      { value: 'sold',    label: '嫄곕옒?꾨즺' },
                      { value: 'hidden',  label: '?④?' },
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
                {isEditMode ? '?섏젙 ??? : '?ㅽ넗?댁뿉 ?깅줉?섍린'}
              </Button>
            </div>
          </Form>
        </div>
      </div>

      {/* ?? ?쇱씠?몃컯???? */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightbox(null)}
        >
          {/* ?대?吏 */}
          <img
            src={lightbox.photos[lightbox.idx]}
            alt=""
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
            onClick={e => e.stopPropagation()}
          />

          {/* ?リ린 */}
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 text-white text-xl flex items-center justify-center transition-colors"
          >횞</button>

          {/* ?몃뜳??*/}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
            {lightbox.idx + 1} / {lightbox.photos.length}
          </div>

          {/* ?댁쟾 */}
          {lightbox.idx > 0 && (
            <button
              onClick={e => { e.stopPropagation(); setLightbox(lb => lb ? { ...lb, idx: lb.idx - 1 } : lb); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 text-white text-2xl flex items-center justify-center transition-colors"
            >??/button>
          )}

          {/* ?ㅼ쓬 */}
          {lightbox.idx < lightbox.photos.length - 1 && (
            <button
              onClick={e => { e.stopPropagation(); setLightbox(lb => lb ? { ...lb, idx: lb.idx + 1 } : lb); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 text-white text-2xl flex items-center justify-center transition-colors"
            >??/button>
          )}
        </div>
      )}
    </div>
  );
};

StoreRegisterPage.getLayout = getDefaultLayout;
StoreRegisterPage.pageHeader = pageHeader;

export default StoreRegisterPage;

