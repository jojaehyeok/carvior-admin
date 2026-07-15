import { getDefaultLayout, IDefaultLayoutPage } from "@/components/layout/default-layout";
import { Button, InputNumber, message, Select, Spin, Tag } from "antd";
import { useCallback, useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_ENDPOINT;

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

const REGION_OPTIONS = [
  // 특별시/광역시/특별자치시 (구 단위 없이 시 단위로)
  "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
  // 경기도
  "수원시", "성남시", "의정부시", "안양시", "부천시", "광명시", "평택시", "동두천시",
  "안산시", "고양시", "과천시", "구리시", "남양주시", "오산시", "시흥시", "군포시",
  "의왕시", "하남시", "용인시", "파주시", "이천시", "안성시", "김포시", "화성시",
  "광주시", "양주시", "포천시", "여주시", "연천군", "가평군", "양평군",
  // 강원특별자치도
  "춘천시", "원주시", "강릉시", "동해시", "태백시", "속초시", "삼척시",
  "홍천군", "횡성군", "영월군", "평창군", "정선군", "철원군", "화천군",
  "양구군", "인제군", "고성군(강원)", "양양군",
  // 충청북도
  "청주시", "충주시", "제천시", "보은군", "옥천군", "영동군", "증평군",
  "진천군", "괴산군", "음성군", "단양군",
  // 충청남도
  "천안시", "공주시", "보령시", "아산시", "서산시", "논산시", "계룡시",
  "당진시", "금산군", "부여군", "서천군", "청양군", "홍성군", "예산군", "태안군",
  // 전북특별자치도
  "전주시", "군산시", "익산시", "정읍시", "남원시", "김제시",
  "완주군", "진안군", "무주군", "장수군", "임실군", "순창군", "고창군", "부안군",
  // 전라남도
  "목포시", "여수시", "순천시", "나주시", "광양시",
  "담양군", "곡성군", "구례군", "고흥군", "보성군", "화순군", "장흥군",
  "강진군", "해남군", "영암군", "무안군", "함평군", "영광군", "장성군",
  "완도군", "진도군", "신안군",
  // 경상북도
  "포항시", "경주시", "김천시", "안동시", "구미시", "영주시", "영천시",
  "상주시", "문경시", "경산시", "군위군", "의성군", "청송군", "영양군",
  "영덕군", "청도군", "고령군", "성주군", "칠곡군", "예천군", "봉화군",
  "울진군", "울릉군",
  // 경상남도
  "창원시", "진주시", "통영시", "사천시", "김해시", "밀양시", "거제시", "양산시",
  "의령군", "함안군", "창녕군", "고성군(경남)", "남해군", "하동군", "산청군",
  "함양군", "거창군", "합천군",
  // 제주특별자치도
  "제주시", "서귀포시",
];

const VEHICLE_OPTIONS = ["승용차", "SUV", "트럭", "승합차", "전기차"];

// 30분 단위 시간 슬롯
function genTimeOptions(fromH = 8, toH = 20) {
  const opts: { label: string; value: string }[] = [];
  for (let h = fromH; h <= toH; h++) {
    opts.push({ label: `${String(h).padStart(2, "0")}:00`, value: `${String(h).padStart(2, "0")}:00` });
    if (h < toH) opts.push({ label: `${String(h).padStart(2, "0")}:30`, value: `${String(h).padStart(2, "0")}:30` });
  }
  return opts;
}
const TIME_OPTIONS = genTimeOptions();

interface Driver {
  id: number;
  name: string;
  phone: string;
  status: string;
  regions?: string[];
  availableDays?: number[];
  availableStartTime?: string;
  availableEndTime?: string;
  maxDailyBookings?: number;
  vehicleTypes?: string[];
}

const DriverSchedulePage: IDefaultLayoutPage = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Driver | null>(null);
  const [saving, setSaving] = useState(false);

  // form state
  const [regions, setRegions] = useState<string[]>([]);
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [maxDaily, setMaxDaily] = useState(5);
  const [vehicleTypes, setVehicleTypes] = useState<string[]>(["승용차", "SUV"]);

  const fetchDrivers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/drivers`);
      const data = await res.json();
      setDrivers(Array.isArray(data) ? data.filter((d: Driver) => d.status === "APPROVED") : []);
    } catch {
      message.error("진단사 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDrivers(); }, [fetchDrivers]);

  const selectDriver = (d: Driver) => {
    setSelected(d);
    setRegions(d.regions ?? []);
    setDays(d.availableDays ?? [1, 2, 3, 4, 5]);
    setStartTime(d.availableStartTime ?? "09:00");
    setEndTime(d.availableEndTime ?? "18:00");
    setMaxDaily(d.maxDailyBookings ?? 5);
    setVehicleTypes(d.vehicleTypes ?? ["승용차", "SUV"]);
  };

  const handleSave = async () => {
    if (!selected) return;
    if (regions.length === 0) { message.warning("가능 지역을 1개 이상 선택해주세요."); return; }
    if (days.length === 0) { message.warning("가능 요일을 1개 이상 선택해주세요."); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/drivers/${selected.id}/availability`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regions, availableDays: days, availableStartTime: startTime, availableEndTime: endTime, maxDailyBookings: maxDaily, vehicleTypes }),
      });
      if (!res.ok) throw new Error();
      message.success(`${selected.name} 스케줄 저장 완료`);
      fetchDrivers();
    } catch {
      message.error("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (d: number) => {
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-2xl font-bold mb-6">진단 평가사 스케줄 관리</h1>

      <div className="flex gap-6">
        {/* 왼쪽: 진단사 목록 */}
        <div className="w-64 flex-shrink-0">
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <p className="text-xs font-bold text-gray-500">승인된 진단 평가사</p>
            </div>
            {loading ? (
              <div className="p-8 flex justify-center"><Spin /></div>
            ) : drivers.length === 0 ? (
              <p className="p-4 text-sm text-gray-400">승인된 진단사가 없습니다.</p>
            ) : (
              <ul>
                {drivers.map(d => (
                  <li
                    key={d.id}
                    onClick={() => selectDriver(d)}
                    className={`px-4 py-3 cursor-pointer border-b border-gray-50 hover:bg-violet-50 transition-colors ${selected?.id === d.id ? "bg-violet-100" : ""}`}
                  >
                    <p className="font-semibold text-sm text-gray-900">{d.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{d.phone}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(d.regions ?? []).slice(0, 3).map(r => (
                        <Tag key={r} color="purple" className="text-[10px] m-0">{r}</Tag>
                      ))}
                      {(d.regions ?? []).length > 3 && (
                        <Tag className="text-[10px] m-0">+{d.regions!.length - 3}</Tag>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* 오른쪽: 스케줄 편집 */}
        {selected ? (
          <div className="flex-1 space-y-5">
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <p className="text-base font-bold text-gray-800 mb-1">{selected.name}</p>
              <p className="text-xs text-gray-400">{selected.phone}</p>
            </div>

            {/* 가능 요일 */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <p className="text-sm font-bold text-gray-700 mb-3">가능 요일</p>
              <div className="flex gap-2 flex-wrap">
                {DAY_LABELS.map((label, idx) => {
                  const on = days.includes(idx);
                  return (
                    <button
                      key={idx}
                      onClick={() => toggleDay(idx)}
                      className={`w-10 h-10 rounded-full text-sm font-bold border transition-colors ${
                        on
                          ? "bg-violet-600 text-white border-violet-600"
                          : "bg-gray-50 text-gray-500 border-gray-200 hover:border-violet-300"
                      } ${idx === 0 ? "!text-red-500" : ""} ${idx === 6 ? "!text-blue-500" : ""} ${on ? "!text-white" : ""}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 가능 시간 */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <p className="text-sm font-bold text-gray-700 mb-3">가능 시간대</p>
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-xs text-gray-400 mb-1">시작</p>
                  <Select
                    value={startTime}
                    onChange={v => setStartTime(v)}
                    options={TIME_OPTIONS}
                    style={{ width: 110 }}
                  />
                </div>
                <span className="text-gray-400 mt-5">~</span>
                <div>
                  <p className="text-xs text-gray-400 mb-1">종료</p>
                  <Select
                    value={endTime}
                    onChange={v => setEndTime(v)}
                    options={TIME_OPTIONS.filter(t => t.value > startTime)}
                    style={{ width: 110 }}
                  />
                </div>
              </div>
            </div>

            {/* 하루 최대 배정 수 */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <p className="text-sm font-bold text-gray-700 mb-3">하루 최대 배정 수</p>
              <InputNumber
                min={1} max={20}
                value={maxDaily}
                onChange={v => setMaxDaily(v ?? 5)}
                addonAfter="건"
                style={{ width: 120 }}
              />
            </div>

            {/* 가능 지역 */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <p className="text-sm font-bold text-gray-700 mb-3">가능 지역</p>
              <div className="flex flex-wrap gap-2">
                {REGION_OPTIONS.map(r => {
                  const on = regions.includes(r);
                  return (
                    <button
                      key={r}
                      onClick={() => setRegions(prev => on ? prev.filter(x => x !== r) : [...prev, r])}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                        on ? "bg-violet-600 text-white border-violet-600" : "bg-gray-50 text-gray-600 border-gray-200 hover:border-violet-300"
                      }`}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 가능 차량 유형 */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <p className="text-sm font-bold text-gray-700 mb-3">가능 차량 유형</p>
              <div className="flex flex-wrap gap-2">
                {VEHICLE_OPTIONS.map(v => {
                  const on = vehicleTypes.includes(v);
                  return (
                    <button
                      key={v}
                      onClick={() => setVehicleTypes(prev => on ? prev.filter(x => x !== v) : [...prev, v])}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                        on ? "bg-violet-600 text-white border-violet-600" : "bg-gray-50 text-gray-600 border-gray-200 hover:border-violet-300"
                      }`}
                    >
                      {v}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 저장 */}
            <Button
              type="primary"
              size="large"
              loading={saving}
              onClick={handleSave}
              style={{ width: "100%", height: 48, background: "#7c3aed", border: "none" }}
            >
              스케줄 저장
            </Button>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 bg-white rounded-xl border border-gray-100">
            <p className="text-sm">왼쪽에서 진단 평가사를 선택하세요</p>
          </div>
        )}
      </div>
    </div>
  );
};

DriverSchedulePage.getLayout = getDefaultLayout;
export default DriverSchedulePage;
