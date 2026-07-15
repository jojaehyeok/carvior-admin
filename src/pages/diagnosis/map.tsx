import { getDefaultLayout, IDefaultLayoutPage } from "@/components/layout/default-layout";
import { Button, message, Select, Spin, Tag } from "antd";
import { useEffect, useRef, useState } from "react";
import { MapPin, Navigation, RefreshCw, UserCheck, X } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_ENDPOINT;

interface DriverLoc {
  id: number;
  name: string;
  phone: string;
  lat: number | null;
  lng: number | null;
  lastSeenAt: string | null;
  regions: string[] | null;
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

    drivers.forEach((d) => {
      if (!d.lat || !d.lng) return;
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
          if (selectedBooking) setSelectedDriver(d);
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

  const handleAssign = async () => {
    if (!selectedBooking || !selectedDriver) return;
    setAssigning(true);
    try {
      const res = await fetch(`${API}/external/request/${selectedBooking.id}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: String(selectedDriver.id),
          name: selectedDriver.name,
        }),
      });
      if (!res.ok) throw new Error();
      message.success(`${selectedBooking.carNumber} → ${selectedDriver.name} 배정 완료`);
      setSelectedBooking(null);
      setSelectedDriver(null);
      fetchData();
    } catch {
      message.error("배정에 실패했습니다.");
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-120px)] gap-0 overflow-hidden rounded-2xl border border-gray-100 shadow-sm">
      {/* 왼쪽 패널 */}
      <div className="w-72 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col">
        {/* 헤더 */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-bold text-gray-800">배정 전 신청</p>
          <button
            onClick={() => { setLoading(true); fetchData(); }}
            className="p-1.5 text-gray-400 hover:text-violet-600 rounded-lg hover:bg-violet-50 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 범례 */}
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#7c3aed]" />
            <span className="text-[10px] text-gray-500">진단사</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-[#ea580c]" />
            <span className="text-[10px] text-gray-500">검차신청</span>
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <UserCheck className="w-3 h-3 text-violet-600" />
            <span className="text-[10px] text-violet-700 font-semibold">
              {drivers.filter((d) => d.lat).length}/{drivers.length}명 온라인
            </span>
          </div>
        </div>

        {/* 신청 목록 */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
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
                <div
                  key={b.id}
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
                  {isSelected && (
                    <p className="text-[10px] text-orange-600 font-semibold mt-1">
                      → 지도에서 진단사 핀을 클릭해 배정하세요
                    </p>
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
              onClick={handleAssign}
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
            지도에서 진단사 핀(보라색)을 클릭해 배정하세요
          </div>
        )}
      </div>
    </div>
  );
};

MapPage.getLayout = getDefaultLayout;
export default MapPage;
