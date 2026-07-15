import { getDefaultLayout, IDefaultLayoutPage, IPageHeader } from "@/components/layout/default-layout";
import { useAuth } from "@/lib/auth/auth-provider";
import { Divider, Skeleton, Tag } from "antd";
import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Car,
  CheckCircle2,
  ClipboardList,
  Clock,
  MessageSquare,
  RefreshCw,
  Users,
  UserCheck,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_ENDPOINT;

interface Stats {
  booking: {
    total: number;
    today: number;
    week: number;
    month: number;
    byStatus: { PENDING: number; ASSIGNED: number; COMPLETED: number; CANCELLED: number };
    recent: {
      id: number;
      carNumber: string;
      dealerName: string;
      status: string;
      address: string;
      createdAt: string;
      source: string;
    }[];
  };
  consultation: { total: number; today: number; week: number; pendingCount: number };
  user: { total: number; today: number; week: number };
  driver: { approved: number; pending: number };
  generatedAt: string;
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  PENDING:   { color: "orange",  label: "대기중"   },
  ASSIGNED:  { color: "blue",    label: "배정됨"   },
  COMPLETED: { color: "green",   label: "완료"     },
  CANCELLED: { color: "red",     label: "취소"     },
};

const SOURCE_LABEL: Record<string, string> = {
  SNS_PROMOTION:   "SNS",
  SIMPLE_FORM:     "B2B",
  KARROT:          "당근",
  CARVIOR_INSPECTION: "카비어",
  PRIVATE_DEAL_FORM: "직거래",
};

function StatCard({
  icon,
  label,
  today,
  week,
  total,
  accent,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  today: number;
  week: number;
  total: number;
  accent: string;
  sub?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent}`}>
          {icon}
        </div>
        <span className="text-xs text-gray-400 font-semibold">누적 {total.toLocaleString()}</span>
      </div>
      <p className="text-sm font-bold text-gray-500">{label}</p>
      <div className="flex items-end gap-3">
        <div>
          <p className="text-[10px] text-gray-400 mb-0.5">오늘</p>
          <p className="text-2xl font-extrabold text-gray-900">{today}</p>
        </div>
        <div className="pb-1">
          <p className="text-[10px] text-gray-400 mb-0.5">이번 주</p>
          <p className="text-lg font-bold text-gray-600">{week}</p>
        </div>
      </div>
      {sub}
    </div>
  );
}

const pageHeader: IPageHeader = { title: "모니터링" };

const IndexPage: IDefaultLayoutPage = () => {
  const { session } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API}/dashboard/stats`);
      const data = await res.json();
      setStats(data);
      setLastUpdated(new Date());
    } catch {
      // silently fail on auto-refresh
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    timerRef.current = setInterval(fetchStats, 60_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const s = stats;

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900">
            👋 {session.user.name || "관리자"}님 안녕하세요
          </h2>
          {lastUpdated && (
            <p className="text-xs text-gray-400 mt-1">
              마지막 갱신: {lastUpdated.toLocaleTimeString("ko-KR")} · 1분마다 자동 갱신
            </p>
          )}
        </div>
        <button
          onClick={() => { setLoading(true); fetchStats(); }}
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-violet-600 px-3 py-2 rounded-lg hover:bg-violet-50 transition-colors border border-gray-200"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          새로고침
        </button>
      </div>

      {loading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <>
          {/* 스탯 카드 4개 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              icon={<Car className="w-5 h-5 text-violet-600" />}
              accent="bg-violet-50"
              label="진단 신청"
              today={s?.booking.today ?? 0}
              week={s?.booking.week ?? 0}
              total={s?.booking.total ?? 0}
              sub={
                <div className="flex gap-1 flex-wrap">
                  {Object.entries(s?.booking.byStatus ?? {}).map(([k, v]) => (
                    <Tag key={k} color={STATUS_CONFIG[k]?.color} className="text-[10px] m-0">
                      {STATUS_CONFIG[k]?.label} {v}
                    </Tag>
                  ))}
                </div>
              }
            />
            <StatCard
              icon={<MessageSquare className="w-5 h-5 text-blue-600" />}
              accent="bg-blue-50"
              label="상담 신청"
              today={s?.consultation.today ?? 0}
              week={s?.consultation.week ?? 0}
              total={s?.consultation.total ?? 0}
              sub={
                <p className="text-[11px] text-orange-500 font-semibold">
                  <AlertCircle className="w-3 h-3 inline mr-0.5" />
                  미처리 {s?.consultation.pendingCount ?? 0}건
                </p>
              }
            />
            <StatCard
              icon={<Users className="w-5 h-5 text-emerald-600" />}
              accent="bg-emerald-50"
              label="신규 회원"
              today={s?.user.today ?? 0}
              week={s?.user.week ?? 0}
              total={s?.user.total ?? 0}
            />
            <StatCard
              icon={<UserCheck className="w-5 h-5 text-amber-600" />}
              accent="bg-amber-50"
              label="진단 평가사"
              today={0}
              week={0}
              total={s?.driver.approved ?? 0}
              sub={
                s?.driver.pending ? (
                  <p className="text-[11px] text-orange-500 font-semibold">
                    <Clock className="w-3 h-3 inline mr-0.5" />
                    승인 대기 {s.driver.pending}명
                  </p>
                ) : undefined
              }
            />
          </div>

          {/* 이번 달 진단 신청 현황 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {/* 상태 진행 바 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <p className="text-sm font-bold text-gray-700 mb-4">진단 신청 상태 현황</p>
              <div className="space-y-3">
                {[
                  { key: "PENDING",   icon: <Clock className="w-4 h-4" />,        color: "bg-orange-400" },
                  { key: "ASSIGNED",  icon: <ClipboardList className="w-4 h-4" />, color: "bg-blue-500"   },
                  { key: "COMPLETED", icon: <CheckCircle2 className="w-4 h-4" />,  color: "bg-emerald-500"},
                  { key: "CANCELLED", icon: <AlertCircle className="w-4 h-4" />,   color: "bg-red-400"    },
                ].map(({ key, icon, color }) => {
                  const val = s?.booking.byStatus[key as keyof typeof s.booking.byStatus] ?? 0;
                  const total = s?.booking.total || 1;
                  const pct = Math.round((val / total) * 100);
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                          {icon}
                          {STATUS_CONFIG[key].label}
                        </div>
                        <span className="text-xs font-bold text-gray-800">{val}건 ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${color} rounded-full transition-all duration-700`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 유입 경로 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <p className="text-sm font-bold text-gray-700 mb-4">이번 달 주요 지표</p>
              <div className="space-y-3">
                {[
                  {
                    label: "이번 달 진단 신청",
                    value: `${s?.booking.month ?? 0}건`,
                    color: "text-violet-700",
                    bg: "bg-violet-50",
                  },
                  {
                    label: "이번 달 상담 신청",
                    value: `${s?.consultation.week ?? 0}건`,
                    color: "text-blue-700",
                    bg: "bg-blue-50",
                  },
                  {
                    label: "이번 주 신규 회원",
                    value: `${s?.user.week ?? 0}명`,
                    color: "text-emerald-700",
                    bg: "bg-emerald-50",
                  },
                  {
                    label: "승인된 평가사",
                    value: `${s?.driver.approved ?? 0}명`,
                    color: "text-amber-700",
                    bg: "bg-amber-50",
                  },
                ].map((item) => (
                  <div key={item.label} className={`flex items-center justify-between px-3 py-2.5 rounded-xl ${item.bg}`}>
                    <span className="text-xs font-semibold text-gray-600">{item.label}</span>
                    <span className={`text-sm font-extrabold ${item.color}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Divider />

          {/* 최근 진단 신청 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm font-bold text-gray-700">최근 진단 신청</p>
              <a href="/diagnosis/bookings" className="text-xs text-violet-600 font-semibold hover:underline">
                전체 보기 →
              </a>
            </div>
            <div className="divide-y divide-gray-50">
              {(s?.booking.recent ?? []).length === 0 ? (
                <p className="p-6 text-center text-sm text-gray-400">신청 내역이 없습니다.</p>
              ) : (
                (s?.booking.recent ?? []).map((b) => (
                  <div key={b.id} className="px-5 py-3 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                      <Car className="w-4 h-4 text-violet-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900">{b.carNumber}</span>
                        {b.source && (
                          <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-semibold">
                            {SOURCE_LABEL[b.source] ?? b.source}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 truncate">{b.address}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Tag color={STATUS_CONFIG[b.status]?.color} className="text-[10px] m-0">
                        {STATUS_CONFIG[b.status]?.label ?? b.status}
                      </Tag>
                      <span className="text-[10px] text-gray-400">
                        {new Date(b.createdAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

IndexPage.getLayout = getDefaultLayout;
IndexPage.pageHeader = pageHeader;

export default IndexPage;
