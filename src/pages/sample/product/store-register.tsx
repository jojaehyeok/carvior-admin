'use client';

import { getDefaultLayout, IDefaultLayoutPage, IPageHeader } from "@/components/layout/default-layout";
import {
  Button, Checkbox, Form, Input, InputNumber, message, Select, Spin, Tag,
} from "antd";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

const CAVIOR_BASE = (process.env.NEXT_PUBLIC_API_ENDPOINT || 'https://carvior.store/api/v1').replace('/api/v1', '');
const EXCHANGE_RATE = 1350;
const FUEL_OPTIONS = ['가솔린', '디젤', '하이브리드', 'LPG', '전기'];
const TRANS_OPTIONS = ['자동', '수동'];
const CATEGORY_OPTIONS = ['SUV', '세단', '해치백', '경차', '소형차', '준중형', '중형', '대형', 'RV', '밴'];
const PUBLIC_CATS = ['exterior', 'interior', 'engine', 'wheel', 'undercarriage', 'damage', 'extra', 'dashboard'] as const;

const CAT_LABEL: Record<string, string> = {
  exterior: '외관', interior: '내관', engine: '엔진', wheel: '휠',
  undercarriage: '하부', damage: '손상', extra: '기타', dashboard: '계기판',
};

interface IBooking {
  id: number; carNumber: string; carOwner: string;
  carModel?: string; address: string;
}

interface IInspection {
  carModel?: string; mileage?: number; color?: string;
  images?: Record<string, string[]>;
  inspectionDetails?: { warningDesc?: string; leakDesc?: string; optionsDesc?: string; driveDesc?: string };
  completedAt?: string;
}

const pageHeader: IPageHeader = { title: "스토어 등록" };

const StoreRegisterPage: IDefaultLayoutPage = () => {
  const router = useRouter();
  const { bookingId } = router.query;
  const [form] = Form.useForm();

  const [booking, setBooking] = useState<IBooking | null>(null);
  const [inspection, setInspection] = useState<IInspection | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [ocrLoading, setOcrLoading] = useState<'registration' | 'insurance' | null>(null);
  const [photoOrder, setPhotoOrder] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!bookingId) return;
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
        fuel: '가솔린',
        transmission: '자동',
        category: 'SUV',
        region: b?.address?.split(' ')[0] ?? '',
        mileage: insp?.mileage,
        colorKo: insp?.color,
        color: insp?.color,
      });
      if (insp?.images) {
        const order: Record<string, string[]> = {};
        for (const cat of PUBLIC_CATS) {
          const arr = (insp.images as any)[cat];
          if (arr?.length) order[cat] = [...arr];
        }
        setPhotoOrder(order);
      }
    }).finally(() => setLoading(false));
  }, [bookingId]);

  const movePhoto = (cat: string, idx: number, dir: -1 | 1) => {
    setPhotoOrder(prev => {
      const arr = [...(prev[cat] ?? [])];
      const to = idx + dir;
      if (to < 0 || to >= arr.length) return prev;
      [arr[idx], arr[to]] = [arr[to], arr[idx]];
      return { ...prev, [cat]: arr };
    });
  };

  const removePhoto = (cat: string, idx: number) => {
    setPhotoOrder(prev => ({
      ...prev,
      [cat]: (prev[cat] ?? []).filter((_, i) => i !== idx),
    }));
  };

  const handleOcr = async (mode: 'registration' | 'insurance') => {
    const imgs = inspection?.images ?? {};
    const photoUrl = mode === 'registration'
      ? (imgs.registration ?? [])[0]
      : (imgs.extra ?? [])[0]; // 보험이력은 보통 extra에 업로드됨

    if (!photoUrl) {
      message.warning(mode === 'registration' ? '자동차등록증 사진이 없습니다.' : '보험이력 사진이 없습니다.');
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
          ...(data.modelYear    && { year: Number(data.modelYear) }),
          ...(data.displacement && { displacement: data.displacement }),
          ...(data.mileage      && { mileage: Number(data.mileage) }),
          ...(data.color        && { colorKo: data.color }),
          ...(data.fuelType     && fuelMap[data.fuelType] && { fuel: fuelMap[data.fuelType] }),
        });
      } else {
        // 보험이력: 주행거리만 업데이트
        if (data.mileage) form.setFieldsValue({ mileage: Number(data.mileage) });
      }
      message.success(`OCR 자동입력 완료 (${mode === 'registration' ? '자동차등록증' : '보험이력'})`);
    } catch {
      message.error('OCR 오류');
    } finally {
      setOcrLoading(null);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (!values.priceKRW) { message.warning('판매가를 입력해주세요.'); return; }
      setRegistering(true);

      const rawPhotos = {
        exterior:      photoOrder.exterior      ?? [] as string[],
        interior:      photoOrder.interior      ?? [] as string[],
        engine:        photoOrder.engine        ?? [] as string[],
        wheel:         photoOrder.wheel         ?? [] as string[],
        undercarriage: photoOrder.undercarriage ?? [] as string[],
        damage:        photoOrder.damage        ?? [] as string[],
        extra:         photoOrder.extra         ?? [] as string[],
        dashboard:     photoOrder.dashboard     ?? [] as string[],
      };

      const allUrls = Object.values(rawPhotos).flat();
      let blurredUrls = allUrls;

      if (allUrls.length > 0) {
        message.loading({ content: `블러 처리 중… (${allUrls.length}장)`, key: 'blur', duration: 0 });
        try {
          const blurRes = await fetch(`${CAVIOR_BASE}/api/v1/admin/blur/photos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls: allUrls }),
          });
          if (blurRes.ok) {
            const bd = await blurRes.json();
            blurredUrls = bd.urls ?? allUrls;
          }
        } catch { /* 원본 사용 */ }
        message.destroy('blur');
      }

      let cursor = 0;
      const blurredPhotos: Record<string, string[]> = {};
      for (const [k, arr] of Object.entries(rawPhotos)) {
        blurredPhotos[k] = blurredUrls.slice(cursor, cursor + arr.length);
        cursor += arr.length;
      }

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
        photos: blurredPhotos,
        specs: [
          { label: 'Year',         value: String(values.year) },
          { label: 'Mileage',      value: `${(values.mileage || 0).toLocaleString()} KM` },
          { label: 'Fuel',         value: values.fuel },
          { label: 'Transmission', value: values.transmission },
          { label: 'Color',        value: values.colorKo || values.color || '' },
          { label: 'Displacement', value: values.displacement || '' },
        ].filter(s => s.value),
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
      router.push('/sample/product/StoreManagementPage');
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error('등록 중 오류 발생');
    } finally {
      setRegistering(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spin size="large" tip="데이터 로딩 중…" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p>예약을 찾을 수 없습니다. (bookingId: {bookingId})</p>
        <Button className="mt-4" onClick={() => router.back()}>← 돌아가기</Button>
      </div>
    );
  }

  const privacyPhotos = [
    ...(inspection?.images?.registration ?? []).map(u => ({ url: u, cat: '자동차등록증' })),
    ...(inspection?.images?.vin ?? []).map(u => ({ url: u, cat: '차대번호' })),
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Button onClick={() => router.back()} size="small">← 목록</Button>
        <div>
          <h1 className="text-lg font-bold text-gray-900 leading-tight">
            스토어 등록 — <span className="text-violet-600">{booking.carNumber}</span>
          </h1>
          <p className="text-xs text-gray-400">{booking.carOwner} · {booking.carModel ?? '차종 미상'} · {booking.address?.split(' ').slice(0, 2).join(' ')}</p>
        </div>
      </div>

      <div className="flex gap-6 items-start">
        {/* ── 왼쪽: 사진 편집 ── */}
        <div className="w-[55%] flex flex-col gap-4">

          {/* 개인정보 사진 */}
          {privacyPhotos.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
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
                    loading={ocrLoading === 'insurance'}
                    onClick={() => handleOcr('insurance')}
                    style={{ borderColor: '#7c3aed', color: '#7c3aed' }}
                  >
                    📋 보험이력 OCR
                  </Button>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {privacyPhotos.map(({ url, cat }, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer" className="flex-shrink-0">
                    <div className="relative">
                      <img src={url} alt="" className="w-28 h-20 object-cover rounded-lg border border-red-200 hover:opacity-80 transition-opacity" />
                      <span className="absolute bottom-1 left-1 text-[9px] bg-red-600 text-white px-1.5 py-0.5 rounded">{cat}</span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* 공개 사진 순서 편집 */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs font-bold text-gray-500 mb-3">📷 사진 순서 편집 — 첫 번째 사진이 대표사진</p>
            {PUBLIC_CATS.filter(cat => (photoOrder[cat] ?? []).length > 0).length === 0 ? (
              <p className="text-sm text-gray-300 py-8 text-center">진단 사진 없음</p>
            ) : (
              <div className="space-y-4">
                {PUBLIC_CATS.filter(cat => (photoOrder[cat] ?? []).length > 0).map(cat => (
                  <div key={cat}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Tag color="default" className="text-[10px]">{CAT_LABEL[cat]}</Tag>
                      <span className="text-[10px] text-gray-400">{photoOrder[cat]?.length}장</span>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {(photoOrder[cat] ?? []).map((url, i) => (
                        <div key={i} className="relative flex-shrink-0 group">
                          <a href={url} target="_blank" rel="noreferrer">
                            <img
                              src={url} alt=""
                              className="w-28 h-20 object-cover rounded-lg border hover:opacity-90 transition-opacity"
                            />
                          </a>
                          {i === 0 && (
                            <span className="absolute top-1 left-1 text-[8px] bg-green-600 text-white px-1.5 rounded-full">대표</span>
                          )}
                          {/* hover 컨트롤 */}
                          <div className="absolute bottom-1 left-0 right-0 flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => movePhoto(cat, i, -1)}
                              disabled={i === 0}
                              className="text-white text-[10px] font-bold bg-black/60 px-1.5 py-0.5 rounded disabled:opacity-30"
                            >◀</button>
                            <button
                              onClick={() => removePhoto(cat, i)}
                              className="text-white text-[10px] font-bold bg-red-600/80 px-1.5 py-0.5 rounded"
                            >✕</button>
                            <button
                              onClick={() => movePhoto(cat, i, 1)}
                              disabled={i === (photoOrder[cat]?.length ?? 0) - 1}
                              className="text-white text-[10px] font-bold bg-black/60 px-1.5 py-0.5 rounded disabled:opacity-30"
                            >▶</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 진단 메모 */}
          {inspection?.inspectionDetails && (
            <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 grid grid-cols-2 gap-3 text-sm">
              {Object.entries({
                '경고등': inspection.inspectionDetails.warningDesc,
                '누유':   inspection.inspectionDetails.leakDesc,
                '옵션':   inspection.inspectionDetails.optionsDesc,
                '주행':   inspection.inspectionDetails.driveDesc,
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
        <div className="flex-1 bg-white rounded-xl border border-gray-100 p-5">
          <Form form={form} layout="vertical" size="middle">
            <div className="grid grid-cols-2 gap-x-4">
              <Form.Item label="차량명 (한국어)" name="titleKo" rules={[{ required: true }]} className="col-span-2">
                <Input placeholder="예: 기아 더 뉴 쏘렌토" />
              </Form.Item>
              <Form.Item label="차량명 (영어)" name="titleEn">
                <Input placeholder="예: Kia Sorento" />
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
                <Input placeholder="예: 2,497cc" />
              </Form.Item>
              <Form.Item label="연료" name="fuel">
                <Select options={FUEL_OPTIONS.map(o => ({ value: o, label: o }))} />
              </Form.Item>
              <Form.Item label="변속기" name="transmission">
                <Select options={TRANS_OPTIONS.map(o => ({ value: o, label: o }))} />
              </Form.Item>
              <Form.Item label="색상 (한국어)" name="colorKo">
                <Input placeholder="예: 스노우 화이트 펄" />
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
                스토어에 등록하기
              </Button>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
};

StoreRegisterPage.getLayout = getDefaultLayout;
StoreRegisterPage.pageHeader = pageHeader;

export default StoreRegisterPage;
