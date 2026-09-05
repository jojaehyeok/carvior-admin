import { getDefaultLayout, IDefaultLayoutPage, IPageHeader } from "@/components/layout/default-layout";
import RequireSuperAdmin from "@/components/shared/require-super-admin";
import { Image, Select, Table, Tag, message } from "antd";
import { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_ENDPOINT;

interface INoshowShot {
  url: string;
  takenAt: string;
  lat?: number | null;
  lng?: number | null;
}

interface ICancelLog {
  id: number;
  driverId: string;
  driverName: string;
  bookingId: number;
  carNumber?: string;
  carOwner?: string;
  cancelReason?: string;
  createdAt: string;
  noshowProof?: INoshowShot[] | null;
  proofVerdict?: "verified" | "suspect" | "unknown" | null;
  proofMinutesDiff?: number | null;
  proofDistanceKm?: number | null;
}

// 판정은 "보상해도 되는지"를 관리자가 빨리 훑기 위한 표시다 — 시스템이 보상을 막지는 않는다.
const VERDICT = {
  verified: { color: "green", label: "검증됨", hint: "촬영 시각·위치가 기준 안" },
  suspect: { color: "red", label: "확인 필요", hint: "시각이나 위치가 기준 밖" },
  unknown: { color: "default", label: "판정 불가", hint: "GPS 미수신 등으로 대조 불가" },
} as const;

const CancelLogPage: IDefaultLayoutPage = () => {
  const [logs, setLogs] = useState<ICancelLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [reasonFilter, setReasonFilter] = useState<string | undefined>();
  const [monthFilter, setMonthFilter] = useState<string | undefined>();

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/external/request/cancel-logs`);
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch {
      message.error("취소 로그를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const months = useMemo(
    () => Array.from(new Set(logs.map((l) => dayjs(l.createdAt).format("YYYY-MM")))).sort().reverse(),
    [logs],
  );
  const reasons = useMemo(
    () => Array.from(new Set(logs.map((l) => l.cancelReason).filter(Boolean))) as string[],
    [logs],
  );

  const rows = useMemo(
    () =>
      logs.filter((l) => {
        if (reasonFilter && l.cancelReason !== reasonFilter) return false;
        if (monthFilter && dayjs(l.createdAt).format("YYYY-MM") !== monthFilter) return false;
        return true;
      }),
    [logs, reasonFilter, monthFilter],
  );

  // 같은 사유로 몇 번째 취소인지 — 페널티는 "판매자의 예약 취소" 3회 누적부터 붙어서,
  // 관리자가 그 임계에 가까운 진단사를 미리 알아볼 수 있어야 한다.
  const countByDriverReason = useMemo(() => {
    const map = new Map<string, number>();
    logs.forEach((l) => {
      const key = `${l.driverId}|${l.cancelReason}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return map;
  }, [logs]);

  const columns: ColumnsType<ICancelLog> = [
    {
      title: "취소일시",
      dataIndex: "createdAt",
      width: 150,
      render: (v: string) => dayjs(v).format("YYYY-MM-DD HH:mm"),
    },
    { title: "차량번호", dataIndex: "carNumber", width: 120 },
    { title: "차주", dataIndex: "carOwner", width: 100, render: (v?: string) => v || <span className="text-gray-300">-</span> },
    { title: "진단사", dataIndex: "driverName", width: 100 },
    {
      title: "취소 사유",
      dataIndex: "cancelReason",
      width: 180,
      render: (v: string, r) => {
        const n = countByDriverReason.get(`${r.driverId}|${v}`) ?? 0;
        const color = v === "진단사 사정" ? "red" : v === "판매자 노쇼" ? "blue" : "orange";
        return (
          <div className="flex items-center gap-1">
            <Tag color={color}>{v || "-"}</Tag>
            {n > 1 && <span className="text-xs text-gray-400">누적 {n}회</span>}
          </div>
        );
      },
    },
    {
      title: "노쇼 증빙",
      key: "proof",
      width: 260,
      render: (_: unknown, r) => {
        if (r.cancelReason !== "판매자 노쇼") return <span className="text-gray-300">-</span>;
        if (!r.noshowProof?.length) {
          return <Tag>사진 없음</Tag>;
        }
        const v = VERDICT[r.proofVerdict ?? "unknown"];
        return (
          <div className="flex items-center gap-2">
            <Image.PreviewGroup>
              {r.noshowProof.map((shot, i) => (
                <Image key={i} src={shot.url} width={44} height={44} style={{ objectFit: "cover", borderRadius: 4 }} />
              ))}
            </Image.PreviewGroup>
            <div className="flex flex-col gap-0.5">
              <Tag color={v.color} title={v.hint} className="w-fit">
                {v.label}
              </Tag>
              <span className="text-xs text-gray-500">
                {r.proofMinutesDiff != null
                  ? `예약시각 ${r.proofMinutesDiff >= 0 ? "+" : ""}${r.proofMinutesDiff}분`
                  : "시각 불명"}
                {" · "}
                {r.proofDistanceKm != null ? `${r.proofDistanceKm}km` : "위치 불명"}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      title: "예약번호",
      dataIndex: "bookingId",
      width: 90,
      render: (v: number) => <span className="text-gray-400">#{v}</span>,
    },
  ];

  const noshowCount = rows.filter((r) => r.cancelReason === "판매자 노쇼").length;
  const suspectCount = rows.filter((r) => r.proofVerdict === "suspect").length;

  return (
    <RequireSuperAdmin>
      <div className="p-4 bg-white rounded-lg shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Select
            allowClear
            placeholder="취소 사유"
            style={{ width: 180 }}
            value={reasonFilter}
            onChange={setReasonFilter}
            options={reasons.map((r) => ({ label: r, value: r }))}
          />
          <Select
            allowClear
            placeholder="취소 월"
            style={{ width: 140 }}
            value={monthFilter}
            onChange={setMonthFilter}
            options={months.map((m) => ({ label: m, value: m }))}
          />
          <span className="ml-2 text-sm text-gray-500">
            총 {rows.length}건 · 노쇼 {noshowCount}건
            {suspectCount > 0 && <span className="ml-1 text-red-500">· 확인 필요 {suspectCount}건</span>}
          </span>
        </div>

        <p className="mb-3 text-xs text-gray-400">
          노쇼 증빙은 앱에서 즉석 촬영한 사진의 시각·GPS를 예약 시각(−15분~+90분)과 방문 주소(5km)와 대조한 결과입니다.
          시스템이 보상을 막지는 않으니 판정은 참고만 하시고 최종 결정은 직접 하세요.
          지하주차장 등에서는 GPS가 잡히지 않아 &quot;판정 불가&quot;로 나올 수 있습니다.
        </p>

        <Table
          rowKey="id"
          size="small"
          loading={loading}
          columns={columns}
          dataSource={rows}
          scroll={{ x: 1000 }}
          pagination={{ pageSize: 30, showSizeChanger: false }}
        />
      </div>
    </RequireSuperAdmin>
  );
};

CancelLogPage.getLayout = getDefaultLayout;
CancelLogPage.pageHeader = { title: "취소 로그" } as IPageHeader;

export default CancelLogPage;
