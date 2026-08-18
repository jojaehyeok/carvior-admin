'use client';

import { Button, Input, InputNumber, Modal, message } from "antd";
import React, { useEffect, useState } from "react";
import { summarizeDamages } from "./damagePartNames";

const API_BASE = process.env.NEXT_PUBLIC_API_ENDPOINT || 'http://localhost:4000/api/v1';

type SpecMatch = { manufacturer: string; model: string; badge: string; count: number };
type Listing = {
  id: string;
  model: string;
  badge: string;
  year: string;
  mileage: number;
  fuel: string;
  priceManwon: number;
  thumbnailUrl: string | null;
};

interface BookingLike {
  id: number;
  carModel?: string | null;
  carSpecManufacturer?: string | null;
  carSpecModel?: string | null;
  carSpecBadge?: string | null;
  estPriceLow?: number | null;
  estPriceHigh?: number | null;
  estPriceDepLow?: number | null;
  estPriceDepHigh?: number | null;
  estPriceDepPct?: number | null;
  purchasePrice?: number | null;
  status?: string;
  carHash?: string | null;
}

interface Props {
  booking: BookingLike | null;
  onClose: () => void;
  onSaved: (bookingId: number, patch: Partial<BookingLike>) => void;
}

// 딜러(관리자)가 매입가를 정할 때 참고할 실거래 매물 시세를 EnCarAPI로 조회 + 매입가 직접 입력.
// 진단사 앱의 "상세정보"와 같은 조회 API를 그대로 쓰되, 여기서는 진단사가 입력한 주행거리를
// 몰라서(예약 데이터엔 없음) 회귀 예상시세 대신 실거래 매물 목록만 그대로 보여준다.
// 등급을 새로 고르면 예약에도 저장(등급이 아직 없던 건에 한해 "등록"하는 개념).
export default function CarSpecPriceModal({ booking, onClose, onSaved }: Props) {
  const [step, setStep] = useState<'search' | 'listings'>('search');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<SpecMatch[]>([]);
  const [selected, setSelected] = useState<SpecMatch | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [purchasePrice, setPurchasePrice] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [reportMileage, setReportMileage] = useState<number | null>(null);
  const [reportDamages, setReportDamages] = useState<string[][] | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    if (!booking) return;
    setReportMileage(null);
    setReportDamages(null);
    if (booking.status === 'COMPLETED') {
      setReportLoading(true);
      fetch(`${API_BASE}/external/inspection/report/${booking.id}`)
        .then((res) => res.json())
        .then((data) => {
          setReportMileage(data?.car_info?.mileage ?? null);
          setReportDamages(Array.isArray(data?.damages) ? data.damages : null);
        })
        .catch(() => {})
        .finally(() => setReportLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.id, booking?.status]);

  useEffect(() => {
    if (!booking) return;
    setPurchasePrice(booking.purchasePrice ?? null);
    if (booking.carSpecManufacturer && booking.carSpecModel) {
      const spec = {
        manufacturer: booking.carSpecManufacturer,
        model: booking.carSpecModel,
        badge: booking.carSpecBadge || '',
        count: 0,
      };
      setSelected(spec);
      setStep('listings');
      fetchListings(spec);
    } else {
      setSelected(null);
      setStep('search');
      setMatches([]);
      setListings([]);
      // 등급이 아직 없어도 차량명은 접수 시점에 이미 적혀있는 경우가 많아, 그걸로 바로 검색해서 보여준다.
      const initialQuery = booking.carModel || '';
      setQuery(initialQuery);
      if (initialQuery.trim()) searchByQuery(initialQuery.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.id]);

  const fetchListings = async (m: { manufacturer: string; model: string; badge: string }) => {
    setLoading(true);
    setListings([]);
    try {
      const qs = new URLSearchParams({ manufacturer: m.manufacturer, model: m.model, badge: m.badge });
      const res = await fetch(`${API_BASE}/external/car-spec/listings?${qs.toString()}`);
      const data = await res.json();
      setListings(Array.isArray(data) ? data : []);
    } catch {
      setListings([]);
    } finally {
      setLoading(false);
    }
  };

  const searchByQuery = async (q: string) => {
    setLoading(true);
    setMatches([]);
    try {
      const res = await fetch(`${API_BASE}/external/car-spec/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setMatches(Array.isArray(data) ? data : []);
    } catch {
      setMatches([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (!query.trim()) return;
    searchByQuery(query.trim());
  };

  const handleSelect = async (m: SpecMatch) => {
    if (!booking) return;
    setSelected(m);
    setStep('listings');
    fetchListings(m);
    // 등급을 새로 등록 — 시세 추정치(주행거리 기반)는 진단사 앱에서만 계산 가능해서 여기선 비워둔다.
    try {
      const res = await fetch(`${API_BASE}/external/request/${booking.id}/car-spec`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manufacturer: m.manufacturer, model: m.model, badge: m.badge }),
      });
      const data = await res.json();
      if (data?.data) {
        onSaved(booking.id, {
          carSpecManufacturer: m.manufacturer,
          carSpecModel: m.model,
          carSpecBadge: m.badge,
          estPriceLow: null, estPriceHigh: null, estPriceDepLow: null, estPriceDepHigh: null, estPriceDepPct: null,
        });
      }
    } catch {
      message.error('등급 저장에 실패했어요.');
    }
  };

  const handleSavePurchasePrice = async () => {
    if (!booking) return;
    setSaving(true);
    try {
      await fetch(`${API_BASE}/external/request/${booking.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchasePrice }),
      });
      onSaved(booking.id, { purchasePrice });
      message.success('매입가를 저장했어요.');
    } catch {
      message.error('매입가 저장에 실패했어요.');
    } finally {
      setSaving(false);
    }
  };

  const sortedListings = [...listings].sort((a, b) => a.priceManwon - b.priceManwon);

  return (
    <Modal
      open={!!booking}
      onCancel={onClose}
      footer={null}
      title={booking ? `${booking.carModel || '차량'} · 시세 참고` : ''}
      width="min(640px, 94vw)"
    >
      {booking?.status === 'COMPLETED' && booking?.carHash && (
        <Button
          className="mb-4"
          onClick={() => window.open(`/report/${booking.carHash}`, '_blank')}
        >
          진단 리포트 보기 (새 탭)
        </Button>
      )}

      {booking?.status === 'COMPLETED' && (reportLoading || reportMileage != null || reportDamages) && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
          <p className="text-xs font-bold text-amber-700 mb-1.5">진단 결과 요약</p>
          {reportLoading ? (
            <p className="text-sm text-gray-400">불러오는 중...</p>
          ) : (
            <>
              <p className="text-sm">
                <span className="text-gray-500">주행거리 </span>
                <span className="font-bold">
                  {reportMileage != null ? `${reportMileage.toLocaleString()}km` : '미입력'}
                </span>
              </p>
              {(() => {
                const { text, count } = summarizeDamages(reportDamages);
                return (
                  <p className="text-sm mt-1">
                    <span className="text-gray-500">사고내역 </span>
                    {count === 0 ? (
                      <span className="font-bold text-green-600">무사고</span>
                    ) : (
                      <span className="font-bold text-red-600">{text} (총 {count}곳)</span>
                    )}
                  </p>
                );
              })()}
            </>
          )}
        </div>
      )}

      {booking?.estPriceLow != null && (
        <div className="mb-4 p-3 rounded-lg bg-gray-50 border border-gray-200">
          <p className="text-xs text-gray-500 mb-1">진단사 앱에서 계산된 예상시세 (주행거리 반영)</p>
          <p className="font-bold">
            {booking.estPriceLow?.toLocaleString()} ~ {booking.estPriceHigh?.toLocaleString()}만원
          </p>
          {booking.estPriceDepLow != null && (
            <p className="text-purple-600 font-semibold text-sm mt-0.5">
              사고감가+실비 반영: {booking.estPriceDepLow?.toLocaleString()} ~ {booking.estPriceDepHigh?.toLocaleString()}만원
              {booking.estPriceDepPct != null && ` (사고감가 -${booking.estPriceDepPct}%, 외판/휠/키/타이어 등 실비 별도 차감)`}
            </p>
          )}
        </div>
      )}

      {step === 'search' && (
        <div>
          <div className="flex gap-2 mb-3">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onPressEnter={handleSearch}
              placeholder="예: 투싼, 그랜저 IG"
            />
            <Button type="primary" onClick={handleSearch} loading={loading}>검색</Button>
          </div>
          {matches.length === 0 && !loading && <p className="text-gray-400 text-sm">차종을 검색해서 등급을 선택하세요.</p>}
          <div className="divide-y">
            {matches.map((m, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 cursor-pointer hover:bg-gray-50 px-2"
                onClick={() => handleSelect(m)}
              >
                <div>
                  <p className="font-semibold text-sm">{m.manufacturer} {m.model}</p>
                  <p className="text-xs text-gray-400">{m.badge}</p>
                </div>
                <span className="text-xs text-gray-400">매물 {m.count}건 ›</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 'listings' && (
        <div>
          <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
            <p className="font-semibold text-sm">{selected?.manufacturer} {selected?.model} · {selected?.badge}</p>
            <div className="flex gap-2 shrink-0">
              {selected && (
                <a
                  href={`https://carvior.store/price?${new URLSearchParams({
                    manufacturer: selected.manufacturer,
                    model: selected.model,
                    badge: selected.badge,
                    ...(reportMileage != null ? { mileage: String(reportMileage) } : {}),
                    ...(booking?.estPriceDepLow != null && booking?.estPriceDepHigh != null ? {
                      depLow: String(booking.estPriceDepLow),
                      depHigh: String(booking.estPriceDepHigh),
                      depLabel: booking.estPriceDepPct != null
                        ? `사고감가+실비 반영 (-${booking.estPriceDepPct}%)`
                        : '사고감가+실비 반영',
                    } : {}),
                  }).toString()}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button size="small">carvior.store에서 그래프로 보기</Button>
                </a>
              )}
              <Button size="small" onClick={() => { setStep('search'); setMatches([]); }}>재선택</Button>
            </div>
          </div>
          {loading ? (
            <p className="text-gray-400 text-sm py-6 text-center">불러오는 중...</p>
          ) : sortedListings.length === 0 ? (
            <p className="text-gray-400 text-sm py-6 text-center">비교할 매물을 찾지 못했어요.</p>
          ) : (
            <div className="max-h-72 overflow-y-auto divide-y border rounded-lg">
              {sortedListings.map((l) => (
                <div key={l.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  {l.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={l.thumbnailUrl}
                      alt=""
                      className="w-14 h-10 rounded object-cover shrink-0 bg-gray-100"
                      loading="lazy"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-14 h-10 rounded bg-gray-100 shrink-0" />
                  )}
                  <span className="text-gray-600 flex-1 min-w-0">{l.year}년식 · {l.mileage?.toLocaleString()}km · {l.fuel}</span>
                  <span className="font-bold shrink-0">{l.priceManwon?.toLocaleString()}만원</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-5 pt-4 border-t">
        <p className="text-xs font-bold text-gray-500 mb-2">매입가 입력 (만원)</p>
        <div className="flex gap-2">
          <InputNumber
            className="flex-1"
            value={purchasePrice}
            onChange={(v) => setPurchasePrice(v)}
            placeholder="매입가"
            min={0}
            style={{ width: '100%' }}
          />
          <Button type="primary" onClick={handleSavePurchasePrice} loading={saving}>저장</Button>
        </div>
      </div>
    </Modal>
  );
}
