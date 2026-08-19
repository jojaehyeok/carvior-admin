'use client';

import { getDefaultLayout, IDefaultLayoutPage, IPageHeader } from "@/components/layout/default-layout";
import RequireSuperAdmin from "@/components/shared/require-super-admin";
import DashboardPriceChart from "@/components/page/booking/DashboardPriceChart";
import { computeDamageBreakdown, computeFlatRepairDeduction, summarizeDamages } from "@/components/page/booking/damagePartNames";
import { computePriceEstimate } from "@/components/page/booking/priceEstimate";
import { Button, Input, InputNumber, Spin, message } from "antd";
import { ExternalLink } from "lucide-react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_ENDPOINT || 'http://localhost:4000/api/v1';

type SpecMatch = { manufacturer: string; model: string; badge: string; count: number };
type Listing = {
  id: string; model: string; badge: string; year: string;
  mileage: number; fuel: string; priceManwon: number; thumbnailUrl: string | null;
};

interface Booking {
  id: number;
  carModel?: string | null;
  carNumber?: string;
  status?: string;
  carHash?: string | null;
  carSpecManufacturer?: string | null;
  carSpecModel?: string | null;
  carSpecBadge?: string | null;
  purchasePrice?: number | null;
}

const pageHeader: IPageHeader = { title: "매입가 산출" };

const BookingPricePage: IDefaultLayoutPage = () => {
  const router = useRouter();
  const bookingId = router.query.id as string | undefined;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [bookingLoading, setBookingLoading] = useState(true);

  const [reportMileage, setReportMileage] = useState<number | null>(null);
  const [reportDamages, setReportDamages] = useState<string[][] | null>(null);
  const [carStatus, setCarStatus] = useState<any>(null);

  const [step, setStep] = useState<'search' | 'listings'>('search');
  const [query, setQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [matches, setMatches] = useState<SpecMatch[]>([]);
  const [selected, setSelected] = useState<SpecMatch | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(false);

  const [purchasePrice, setPurchasePrice] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // ── 예약 + 리포트 로드 ──────────────────────────────────────────
  useEffect(() => {
    if (!bookingId) return;
    setBookingLoading(true);
    fetch(`${API_BASE}/external/request/${bookingId}`)
      .then((res) => res.json())
      .then((data: Booking) => {
        setBooking(data);
        setPurchasePrice(data.purchasePrice ?? null);
        if (data.carSpecManufacturer && data.carSpecModel) {
          const spec = { manufacturer: data.carSpecManufacturer, model: data.carSpecModel, badge: data.carSpecBadge || '', count: 0 };
          setSelected(spec);
          setStep('listings');
          fetchListings(spec);
        } else if (data.carModel) {
          setQuery(data.carModel);
          searchByQuery(data.carModel);
        }
        if (data.status === 'COMPLETED') {
          fetch(`${API_BASE}/external/inspection/report/${bookingId}`)
            .then((r) => r.json())
            .then((rep) => {
              setReportMileage(rep?.car_info?.mileage ?? null);
              setReportDamages(Array.isArray(rep?.damages) ? rep.damages : null);
              setCarStatus(rep?.car_status ?? null);
            })
            .catch(() => {});
        }
      })
      .catch(() => message.error('예약 정보를 불러오지 못했어요.'))
      .finally(() => setBookingLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  const searchByQuery = async (q: string) => {
    setSearchLoading(true);
    setMatches([]);
    try {
      const res = await fetch(`${API_BASE}/external/car-spec/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setMatches(Array.isArray(data) ? data : []);
    } catch {
      setMatches([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const fetchListings = async (m: { manufacturer: string; model: string; badge: string }) => {
    setListingsLoading(true);
    setListings([]);
    try {
      const qs = new URLSearchParams({ manufacturer: m.manufacturer, model: m.model, badge: m.badge });
      const res = await fetch(`${API_BASE}/external/car-spec/listings?${qs.toString()}`);
      const data = await res.json();
      setListings(Array.isArray(data) ? data : []);
    } catch {
      setListings([]);
    } finally {
      setListingsLoading(false);
    }
  };

  const handleSelect = async (m: SpecMatch) => {
    if (!bookingId) return;
    setSelected(m);
    setStep('listings');
    fetchListings(m);
    try {
      await fetch(`${API_BASE}/external/request/${bookingId}/car-spec`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manufacturer: m.manufacturer, model: m.model, badge: m.badge }),
      });
    } catch {
      message.error('등급 저장에 실패했어요.');
    }
  };

  const handleReselect = async () => {
    if (!bookingId) return;
    setSelected(null);
    setListings([]);
    setStep('search');
    setMatches([]);
    try {
      await fetch(`${API_BASE}/external/request/${bookingId}/car-spec`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    } catch {
      message.error('등급 초기화에 실패했어요.');
    }
  };

  const handleSavePurchasePrice = async () => {
    if (!bookingId) return;
    setSaving(true);
    try {
      await fetch(`${API_BASE}/external/request/${bookingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchasePrice }),
      });
      message.success('매입가를 저장했어요.');
    } catch {
      message.error('매입가 저장에 실패했어요.');
    } finally {
      setSaving(false);
    }
  };

  if (bookingLoading) {
    return (
      <RequireSuperAdmin>
        <div className="flex justify-center py-20"><Spin /></div>
      </RequireSuperAdmin>
    );
  }
  if (!booking) {
    return (
      <RequireSuperAdmin>
        <div className="text-center text-gray-400 py-20">예약을 찾을 수 없어요.</div>
      </RequireSuperAdmin>
    );
  }

  const estimate = computePriceEstimate(listings, reportMileage ?? undefined);
  const basePriceManwon = estimate?.midpoint ?? 0;
  const damageBreakdown = basePriceManwon > 0 ? computeDamageBreakdown(reportDamages, basePriceManwon) : null;
  const repairBreakdown = carStatus
    ? computeFlatRepairDeduction({
        manufacturer: selected?.manufacturer,
        paintNeeded: carStatus.paintNeeded || 0,
        wheelScratch: carStatus.wheelScratch || 0,
        smartKeyCount: carStatus.keys?.smart || 0,
        frontTirePct: carStatus.tireTread?.front ?? 50,
        backTirePct: carStatus.tireTread?.back ?? 50,
      })
    : null;
  const totalDeductionWon = (damageBreakdown?.totalWon || 0) + (repairBreakdown?.totalWon || 0);
  const adjustedLow = estimate ? estimate.rangeLow - totalDeductionWon : null;
  const adjustedHigh = estimate ? estimate.rangeHigh - totalDeductionWon : null;

  return (
    <RequireSuperAdmin>
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      {/* 상단: 차량 + 리포트 */}
      <div className="bg-white rounded-2xl border p-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-bold">{booking.carModel || '차량'} · {booking.carNumber}</h2>
            <p className="text-xs text-gray-400 mt-0.5">예약 #{booking.id}</p>
          </div>
          {booking.status === 'COMPLETED' && booking.carHash && (
            <a href={`/report/${booking.carHash}`} target="_blank" rel="noreferrer">
              <Button icon={<ExternalLink size={14} />}>진단 리포트 전체보기</Button>
            </a>
          )}
        </div>

        {booking.status === 'COMPLETED' ? (
          <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <p className="text-xs font-bold text-amber-700 mb-1.5">진단 결과 요약</p>
            <p className="text-sm">
              <span className="text-gray-500">주행거리 </span>
              <span className="font-bold">{reportMileage != null ? `${reportMileage.toLocaleString()}km` : '미입력'}</span>
            </p>
            {(() => {
              const { text, count } = summarizeDamages(reportDamages);
              return (
                <p className="text-sm mt-1">
                  <span className="text-gray-500">사고내역 </span>
                  {count === 0
                    ? <span className="font-bold text-green-600">무사고</span>
                    : <span className="font-bold text-red-600">{text} (총 {count}곳)</span>}
                </p>
              );
            })()}
          </div>
        ) : (
          <p className="mt-4 text-sm text-gray-400">아직 진단완료 전이라 주행거리/사고내역을 확인할 수 없어요.</p>
        )}
      </div>

      {/* 등급 검색/선택 + 그래프 */}
      <div className="bg-white rounded-2xl border p-5">
        {step === 'search' && (
          <div>
            <div className="flex gap-2 mb-3">
              <Input value={query} onChange={(e) => setQuery(e.target.value)} onPressEnter={() => searchByQuery(query.trim())} placeholder="예: 투싼, 그랜저 IG" />
              <Button type="primary" onClick={() => searchByQuery(query.trim())} loading={searchLoading}>검색</Button>
            </div>
            {matches.length === 0 && !searchLoading && <p className="text-gray-400 text-sm">차종을 검색해서 등급을 선택하세요.</p>}
            <div className="divide-y">
              {matches.map((m, i) => (
                <div key={i} className="flex items-center justify-between py-2 cursor-pointer hover:bg-gray-50 px-2" onClick={() => handleSelect(m)}>
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
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-sm">{selected?.manufacturer} {selected?.model} · {selected?.badge}</p>
              <Button size="small" onClick={handleReselect}>재선택</Button>
            </div>

            {listingsLoading ? (
              <div className="py-10 text-center text-gray-400">불러오는 중...</div>
            ) : listings.length === 0 ? (
              <div className="py-10 text-center text-gray-400">비교할 매물을 찾지 못했어요.</div>
            ) : (
              <>
                <DashboardPriceChart listings={listings} targetMileage={reportMileage ?? undefined} />

                {estimate && (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-gray-50 border">
                      <p className="text-xs text-gray-500 mb-1">실거래 판매시세(호가 기준)</p>
                      <p className="font-black text-lg">{estimate.rangeLow.toLocaleString()} ~ {estimate.rangeHigh.toLocaleString()}만원</p>
                    </div>
                    {totalDeductionWon > 0 && adjustedLow != null && adjustedHigh != null && (
                      <div className="p-3 rounded-xl bg-[#f5f1fc] border border-[#7c3aed33]">
                        <p className="text-xs font-bold text-[#7c3aed] mb-1">사고감가+실비 반영 참고가</p>
                        <p className="font-black text-lg">{adjustedLow.toLocaleString()} ~ {adjustedHigh.toLocaleString()}만원</p>
                      </div>
                    )}
                  </div>
                )}

                {/* 감가 내역 세부 breakdown */}
                {((damageBreakdown && damageBreakdown.items.length > 0) || (repairBreakdown && repairBreakdown.breakdown.length > 0)) && (
                  <div className="mt-4 p-3 rounded-xl border divide-y">
                    <p className="text-xs font-bold text-gray-500 pb-2">차감 내역</p>
                    {damageBreakdown?.items.map((it, i) => (
                      <div key={`d${i}`} className="flex items-center justify-between py-1.5 text-sm">
                        <span className="text-gray-600">{it.name} ({it.symbol === 'X' ? '교환' : it.symbol === 'B' ? '판금' : '용접'}) -{it.pct}%</span>
                        <span className="font-semibold text-red-500">-{it.won.toLocaleString()}만원</span>
                      </div>
                    ))}
                    {repairBreakdown?.breakdown.map((line, i) => (
                      <div key={`r${i}`} className="py-1.5 text-sm text-gray-600">{line}</div>
                    ))}
                  </div>
                )}

                <div className="mt-4 max-h-64 overflow-y-auto divide-y border rounded-lg">
                  {[...listings].sort((a, b) => a.priceManwon - b.priceManwon).map((l) => (
                    <div key={l.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                      {l.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={l.thumbnailUrl} alt="" className="w-14 h-10 rounded object-cover shrink-0 bg-gray-100" loading="lazy"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <div className="w-14 h-10 rounded bg-gray-100 shrink-0" />
                      )}
                      <span className="text-gray-600 flex-1 min-w-0">{l.year}년식 · {l.mileage?.toLocaleString()}km · {l.fuel}</span>
                      <span className="font-bold shrink-0">{l.priceManwon?.toLocaleString()}만원</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* 매입가 입력 */}
      <div className="bg-white rounded-2xl border p-5">
        <p className="text-xs font-bold text-gray-500 mb-2">매입가 입력 (만원)</p>
        <div className="flex gap-2">
          <InputNumber className="flex-1" value={purchasePrice} onChange={(v) => setPurchasePrice(v)} placeholder="매입가" min={0} style={{ width: '100%' }} />
          <Button type="primary" onClick={handleSavePurchasePrice} loading={saving}>저장</Button>
        </div>
      </div>
    </div>
    </RequireSuperAdmin>
  );
};

BookingPricePage.getLayout = getDefaultLayout;
BookingPricePage.pageHeader = pageHeader;

export default BookingPricePage;
