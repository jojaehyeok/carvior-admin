import { getDefaultLayout, IDefaultLayoutPage } from "@/components/layout/default-layout";
import { Button, message, Select, Spin, Tag } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Navigation, RefreshCw, Users, X } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_ENDPOINT;

interface DriverLoc {
  id: number;
  name: string;
  phone: string;
  lat: number | null;
  lng: number | null;
  lastSeenAt: string | null;
  regions: string[] | null;
  availableDays: number[] | null;
  availableStartTime: string | null;
  availableEndTime: string | null;
}

// 진단사가 설정한 가용 시간(요일+시간대) 기준으로 "지금 활성 상태"인지 판단.
// 스케줄을 아직 설정 안 한 진단사는 최근 3시간 내 GPS 갱신 여부로 폴백.
function isActiveNow(d: DriverLoc): boolean {
  const now = new Date();
  if (d.availableDays && d.availableDays.length > 0) {
    if (!d.availableDays.includes(now.getDay())) return false;
    if (d.availableStartTime && d.availableEndTime) {
      const cur = now.getHours() * 60 + now.getMinutes();
      const [sh, sm] = d.availableStartTime.split(":").map(Number);
      const [eh, em] = d.availableEndTime.split(":").map(Number);
      const start = sh * 60 + sm;
      const end = eh * 60 + em;
      return start <= end ? cur >= start && cur <= end : cur >= start || cur <= end;
    }
    return true;
  }
  return !!(d.lastSeenAt && Date.now() - new Date(d.lastSeenAt).getTime() < 3 * 60 * 60 * 1000);
}

interface Booking {
  id: number;
  carNumber: string;
  dealerName: string;
  address: string;
  status: string;
  createdAt: string;
  assignedDriverId: string | null;
  source: string;
  lat?: number | null;
  lng?: number | null;
}

declare global {
  interface Window { L: any; }
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: "orange", ASSIGNED: "blue", COMPLETED: "green", CANCELLED: "red",
};

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number) {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
}

function timeDiff(iso: string | null) {
  if (!iso) return "위치 없음";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return "방금 전";
  if (diff < 60) return `${diff}분 전`;
  return `${Math.floor(diff / 60)}시간 전`;
}

const KAKAO_REST_KEY = "5d73c6482159874735a29becf6849e11";

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    // 1차: 주소 검색
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`,
      { headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` } }
    );
    const data = await res.json();
    const doc = data?.documents?.[0];
    if (doc) return { lat: parseFloat(doc.y), lng: parseFloat(doc.x) };

    // 2차: 키워드 검색 fallback
    const res2 = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(address)}`,
      { headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` } }
    );
    const data2 = await res2.json();
    const doc2 = data2?.documents?.[0];
    if (doc2) return { lat: parseFloat(doc2.y), lng: parseFloat(doc2.x) };

    return null;
  } catch { return null; }
}

const MapPage: IDefaultLayoutPage = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);
  const driverMarkers = useRef<Record<number, any>>({});
  const bookingMarkers = useRef<Record<number, any>>({});
  const [mapReady, setMapReady] = useState(false);

  const [drivers, setDrivers] = useState<DriverLoc[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [geocoding, setGeocoding] = useState(false);

  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<DriverLoc | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [demoTarget, setDemoTarget] = useState<DriverLoc | null>(null);
  const [activeTab, setActiveTab] = useState<"bookings" | "drivers">("bookings");

  // 활성 진단사 = 가용 시간(요일+시간대)에 지금이 포함되는 진단사 (GPS 최신 여부와 무관)
  const activeDrivers = drivers.filter(isActiveNow);
  // 지도에 핀을 찍을 수 있는 진단사 (마지막으로 알려진 위치 보유)
  const mappableActiveDrivers = activeDrivers.filter((d) => d.lat != null && d.lng != null);

  // 선택된 신청 기준 거리순 진단사 목록 (활성 + 위치 있는 진단사만)
  const nearbyDrivers = useMemo(() => {
    if (!selectedBooking?.lat || !selectedBooking?.lng) return [];
    return mappableActiveDrivers
      .map((d) => ({ driver: d, km: distanceKm(selectedBooking.lat!, selectedBooking.lng!, d.lat!, d.lng!) }))
      .sort((a, b) => a.km - b.km);
  }, [selectedBooking, drivers]);

  // Leaflet CSS + JS 로드
  useEffect(() => {
    if (document.getElementById("leaflet-css")) { setMapReady(true); return; }
    const css = document.createElement("link");
    css.id = "leaflet-css";
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => setMapReady(true);
    document.head.appendChild(script);
  }, []);

  // 지도 초기화
  useEffect(() => {
    if (!mapReady || !mapRef.current || leafletMap.current) return;
    const L = window.L;
    const map = L.map(mapRef.current).setView([37.5665, 126.9780], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
    }).addTo(map);
    leafletMap.current = map;

    map.on("click", async (e: any) => {
      if (!demoMode || !demoTarget) return;
      const { lat, lng } = e.latlng;
      try {
        await fetch(`${API}/drivers/${demoTarget.id}/location`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat, lng }),
        });
        message.success(`${demoTarget.name} 위치 설정 완료`);
        setDemoMode(false);
        setDemoTarget(null);
        fetchData();
      } catch {
        message.error("위치 설정 실패");
      }
    });
  }, [mapReady, demoMode, demoTarget]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dRes, bRes] = await Promise.all([
        fetch(`${API}/drivers/locations/all`),
        fetch(`${API}/external/request/list`),
      ]);
      const dData = await dRes.json();
      const bData = await bRes.json();
      setDrivers(Array.isArray(dData) ? dData : []);
      const all: Booking[] = Array.isArray(bData) ? bData : Array.isArray(bData?.data) ? bData.data : [];
      const rawBookings: Booking[] = all.filter(b => b.status === "PENDING");
      setBookings(rawBookings);

      // 주소 → 좌표 변환 (카카오 REST API, 병렬)
      if (rawBookings.length > 0) {
        setGeocoding(true);
        const geocoded = await Promise.all(
          rawBookings.map(async (b) => {
            const coords = b.address ? await geocodeAddress(b.address) : null;
            return { ...b, lat: coords?.lat ?? null, lng: coords?.lng ?? null };
          })
        );
        setBookings(geocoded);
        setGeocoding(false);
      }
    } catch {
      message.error("데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // 진단사 마커
  useEffect(() => {
    if (!mapReady || !leafletMap.current) return;
    const L = window.L;
    const map = leafletMap.current;

    Object.values(driverMarkers.current).forEach((m: any) => m.remove());
    driverMarkers.current = {};

    mappableActiveDrivers.forEach((d) => {
      const isSelected = selectedDriver?.id === d.id;
      const icon = L.divIcon({
        className: "",
        html: `
          <div style="
            background:${isSelected ? "#ef4444" : "#7c3aed"};
            color:#fff;width:36px;height:36px;border-radius:50%;
            display:flex;align-items:center;justify-content:center;
            font-weight:700;font-size:12px;
            border:3px solid #fff;
            box-shadow:0 2px 8px rgba(0,0,0,0.3);
            cursor:pointer;
            transform:${isSelected ? "scale(1.3)" : "scale(1)"};
            transition:transform .2s;
          ">
            ${d.name.slice(0, 1)}
          </div>
          <div style="
            position:absolute;top:40px;left:50%;transform:translateX(-50%);
            background:#1e293b;color:#fff;font-size:10px;font-weight:600;
            padding:2px 6px;border-radius:4px;white-space:nowrap;
            box-shadow:0 1px 4px rgba(0,0,0,0.3);
          ">${d.name}</div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const marker = L.marker([d.lat, d.lng], { icon })
        .addTo(map)
        .on("click", () => {
          setSelectedDriver(d);
        });

      marker.bindPopup(`
        <div style="font-size:13px;line-height:1.6">
          <strong>${d.name}</strong><br/>
          📍 ${(d.regions ?? []).join(", ") || "지역 미설정"}<br/>
          🕐 ${timeDiff(d.lastSeenAt)}
        </div>
      `);

      driverMarkers.current[d.id] = marker;
    });
  }, [drivers, mapReady, selectedBooking, selectedDriver]);

  // 검차신청 마커 (배정 전 위치 핀)
  useEffect(() => {
    if (!mapReady || !leafletMap.current) return;
    const L = window.L;
    const map = leafletMap.current;

    Object.values(bookingMarkers.current).forEach((m: any) => m.remove());
    bookingMarkers.current = {};

    bookings.forEach((b) => {
      if (!b.lat || !b.lng) return;
      const isSelected = selectedBooking?.id === b.id;

      const icon = L.divIcon({
        className: "",
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">
            <div style="
              background:${isSelected ? "#dc2626" : "#ea580c"};
              color:#fff;
              padding:3px 7px;
              border-radius:6px;
              font-size:10px;font-weight:700;
              border:2px solid #fff;
              box-shadow:0 2px 6px rgba(0,0,0,0.3);
              white-space:nowrap;
              transform:${isSelected ? "scale(1.15)" : "scale(1)"};
              transition:transform .2s;
            ">${b.carNumber}</div>
            <div style="
              width:0;height:0;
              border-left:5px solid transparent;
              border-right:5px solid transparent;
              border-top:7px solid ${isSelected ? "#dc2626" : "#ea580c"};
              margin-top:-1px;
            "></div>
          </div>
        `,
        iconSize: [80, 32],
        iconAnchor: [40, 32],
      });

      const marker = L.marker([b.lat, b.lng], { icon, zIndexOffset: isSelected ? 1000 : 0 })
        .addTo(map)
        .on("click", () => {
          setSelectedBooking(prev => prev?.id === b.id ? null : b);
          setSelectedDriver(null);
        });

      marker.bindPopup(`
        <div style="font-size:12px;line-height:1.7;min-width:160px;">
          <strong style="color:#ea580c">${b.carNumber}</strong><br/>
          📍 ${b.address || "주소 없음"}<br/>
          🕐 ${new Date(b.createdAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          ${b.dealerName ? `<br/>👤 ${b.dealerName}` : ""}
        </div>
      `);

      bookingMarkers.current[b.id] = marker;
    });
  }, [bookings, mapReady, selectedBooking]);

  // 신청 선택 시 지도 해당 위치로 이동
  useEffect(() => {
    if (!selectedBooking?.lat || !selectedBooking?.lng || !leafletMap.current) return;
    leafletMap.current.setView([selectedBooking.lat, selectedBooking.lng], 14, { animate: true });
    bookingMarkers.current[selectedBooking.id]?.openPopup();
  }, [selectedBooking]);

  const handleAssign = async (booking = selectedBooking, driver = selectedDriver) => {
    if (!booking || !driver) return;
    setAssigning(true);
    try {
      const res = await fetch(`${API}/external/request/${booking.id}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: String(driver.id),
          name: driver.name,
        }),
      });
      if (!res.ok) throw new Error();
      message.success(`${booking.carNumber} → ${driver.name} 배정 완료`);
      setSelectedBooking(null);
      setSelectedDriver(null);
      fetchData();
    } catch {
      message.error("배정에 실패했습니다.");
    } finally {
      setAssigning(false);
    }
  };

  const focusDriver = (d: DriverLoc) => {
    setSelectedDriver(d);
    if (d.lat != null && d.lng != null && leafletMap.current) {
      leafletMap.current.setView([d.lat, d.lng], 14, { animate: true });
      driverMarkers.current[d.id]?.openPopup();
    }
  };

  return (
    <div className="flex h-[calc(100vh-120px)] gap-0 overflow-hidden rounded-2xl border border-gray-100 shadow-sm">
      {/* 왼쪽 패널 */}
      <div className="w-72 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col">
        {/* 헤더 */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-bold text-gray-800">
            {activeTab === "bookings" ? "배정 전 신청" : "활성 진단사"}
          </p>
          <button
            onClick={() => { setLoading(true); fetchData(); }}
            className="p-1.5 text-gray-400 hover:text-violet-600 rounded-lg hover:bg-violet-50 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 탭 */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setActiveTab("bookings")}
            className={`flex-1 py-2 text-xs font-semibold transition-colors ${
              activeTab === "bookings"
                ? "text-orange-600 border-b-2 border-orange-500"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            배정 전 신청 {bookings.length > 0 && `(${bookings.length})`}
          </button>
          <button
            onClick={() => setActiveTab("drivers")}
            className={`flex-1 py-2 text-xs font-semibold transition-colors ${
              activeTab === "drivers"
                ? "text-violet-600 border-b-2 border-violet-500"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            활성 진단사 ({activeDrivers.length}/{drivers.length})
          </button>
        </div>

        {/* 목록 */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "bookings" ? (
            loading ? (
              <div className="flex justify-center py-10"><Spin /></div>
            ) : bookings.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">
                <MapPin className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                대기 중인 신청이 없습니다
              </div>
            ) : (
              bookings.map((b) => {
                const isSelected = selectedBooking?.id === b.id;
                return (
                  <div key={b.id}>
                    <div
                      onClick={() => {
                        setSelectedBooking(isSelected ? null : b);
                        setSelectedDriver(null);
                      }}
                      className={`px-4 py-3 border-b border-gray-50 cursor-pointer transition-colors ${
                        isSelected ? "bg-orange-50 border-l-2 border-l-orange-400" : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-gray-900">{b.carNumber}</span>
                        <div className="flex items-center gap-1">
                          {b.lat ? (
                            <span className="text-[9px] text-green-500 font-semibold">📍지도</span>
                          ) : geocoding ? (
                            <span className="text-[9px] text-gray-400">변환중…</span>
                          ) : null}
                          <Tag color={STATUS_COLOR[b.status]} className="text-[10px] m-0">
                            {b.status === "PENDING" ? "대기" : b.status}
                          </Tag>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 truncate">{b.address}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {new Date(b.createdAt).toLocaleDateString("ko-KR", {
                          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    </div>

                    {/* 근처 진단사 - 바로 배정 */}
                    {isSelected && (
                      <div className="px-4 py-2 bg-orange-50/50 border-b border-gray-50">
                        <p className="text-[10px] font-bold text-gray-400 mb-1.5">근처 진단사 (거리순)</p>
                        {nearbyDrivers.length === 0 ? (
                          <p className="text-[10px] text-gray-400">위치가 확인된 활성 진단사가 없습니다</p>
                        ) : (
                          nearbyDrivers.slice(0, 5).map(({ driver: d, km }) => (
                            <div
                              key={d.id}
                              className="flex items-center justify-between py-1.5 cursor-pointer group"
                              onClick={() => focusDriver(d)}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <div className="w-2 h-2 rounded-full bg-[#7c3aed] flex-shrink-0" />
                                <span className="text-xs text-gray-700 truncate group-hover:text-violet-700">{d.name}</span>
                                <span className="text-[10px] text-gray-400 flex-shrink-0">{formatDistance(km)}</span>
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleAssign(b, d); }}
                                disabled={assigning}
                                className="text-[10px] font-semibold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 rounded-md px-2 py-1 flex-shrink-0"
                              >
                                배정
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )
          ) : activeDrivers.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">
              <Users className="w-8 h-8 mx-auto mb-2 text-gray-200" />
              지금 가용 시간인 진단사가 없습니다
            </div>
          ) : (
            activeDrivers.map((d: DriverLoc) => {
              const isSelected = selectedDriver?.id === d.id;
              const km = selectedBooking?.lat && selectedBooking?.lng && d.lat != null && d.lng != null
                ? distanceKm(selectedBooking.lat, selectedBooking.lng, d.lat, d.lng)
                : null;
              return (
                <div
                  key={d.id}
                  onClick={() => focusDriver(d)}
                  className={`px-4 py-3 border-b border-gray-50 cursor-pointer transition-colors ${
                    isSelected ? "bg-violet-50 border-l-2 border-l-violet-400" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-gray-900">{d.name}</span>
                    {km != null ? (
                      <span className="text-[10px] text-orange-500 font-semibold">신청지까지 {formatDistance(km)}</span>
                    ) : d.lat == null ? (
                      <span className="text-[10px] text-gray-400">위치 없음</span>
                    ) : null}
                  </div>
                  <p className="text-xs text-gray-500 truncate">{(d.regions ?? []).join(", ") || "지역 미설정"}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {d.availableStartTime && d.availableEndTime
                      ? `가용 ${d.availableStartTime}~${d.availableEndTime} · 마지막 위치 ${timeDiff(d.lastSeenAt)}`
                      : timeDiff(d.lastSeenAt)}
                  </p>
                  {selectedBooking && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleAssign(selectedBooking, d); }}
                      disabled={assigning}
                      className="mt-1.5 text-[10px] font-semibold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 rounded-md px-2 py-1"
                    >
                      {selectedBooking.carNumber} 배정
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* 데모 도구 */}
        <div className="p-3 border-t border-gray-100 bg-gray-50">
          <p className="text-[10px] font-bold text-gray-400 mb-2">[데모] 진단사 위치 설정</p>
          <Select
            placeholder="진단사 선택 후 지도 클릭"
            className="w-full"
            size="small"
            value={demoTarget?.id ?? null}
            onChange={(id) => {
              const d = drivers.find((x) => x.id === id) ?? null;
              setDemoTarget(d);
              setDemoMode(!!d);
            }}
            allowClear
            onClear={() => { setDemoMode(false); setDemoTarget(null); }}
            options={drivers.map((d) => ({ label: d.name, value: d.id }))}
          />
          {demoMode && (
            <p className="text-[10px] text-orange-500 font-semibold mt-1.5">
              📍 지도를 클릭해 {demoTarget?.name} 위치를 설정하세요
            </p>
          )}
        </div>
      </div>

      {/* 지도 영역 */}
      <div className="flex-1 relative">
        <div ref={mapRef} className="w-full h-full" />

        {/* 지오코딩 진행 표시 */}
        {geocoding && (
          <div className="absolute top-3 right-3 bg-white/90 backdrop-blur rounded-lg px-3 py-2 shadow text-xs text-gray-600 z-[1000] flex items-center gap-2">
            <Spin size="small" />
            신청 위치 변환 중…
          </div>
        )}

        {/* 배정 확인 패널 */}
        {selectedBooking && selectedDriver && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-xl border border-gray-100 px-6 py-4 flex items-center gap-4 z-[1000]">
            <div className="text-center">
              <p className="text-[10px] text-gray-400">신청 차량</p>
              <p className="text-sm font-bold text-gray-900">{selectedBooking.carNumber}</p>
              <p className="text-[10px] text-gray-400 truncate max-w-[100px]">{selectedBooking.address}</p>
            </div>
            <Navigation className="w-5 h-5 text-violet-500" />
            <div className="text-center">
              <p className="text-[10px] text-gray-400">배정 진단사</p>
              <p className="text-sm font-bold text-violet-700">{selectedDriver.name}</p>
            </div>
            <Button
              type="primary"
              loading={assigning}
              onClick={() => handleAssign()}
              style={{ background: "#7c3aed", border: "none" }}
            >
              배정 확정
            </Button>
            <button
              onClick={() => setSelectedDriver(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 안내 메시지 */}
        {selectedBooking && !selectedDriver && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg z-[1000]">
왼쪽 근처 진단사 목록에서 배정하거나, 지도의 보라색 핀을 클릭하세요
          </div>
        )}
      </div>
    </div>
  );
};

MapPage.getLayout = getDefaultLayout;
export default MapPage;
