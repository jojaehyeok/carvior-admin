import { getDefaultLayout, IDefaultLayoutPage, IPageHeader } from "@/components/layout/default-layout";
import RequireSuperAdmin from "@/components/shared/require-super-admin";
import { Button, Input, Modal, Select, Table, Tag, message } from "antd";
import { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_ENDPOINT;
const INTERNAL_KEY = process.env.NEXT_PUBLIC_STORE_ITEMS_INTERNAL_KEY ?? "";
const INTERNAL_HEADERS = { "x-internal-key": INTERNAL_KEY };

interface IReport {
  id: number;
  reporterUserId: number;
  targetType: "listing" | "chat";
  targetId: number;
  storeItemId: number | null;
  targetUserId: number | null;
  reason: string;
  reasonLabel: string;
  detail: string | null;
  status: "pending" | "resolved" | "dismissed";
  adminNote: string | null;
  handledBy: string | null;
  handledAt: string | null;
  createdAt: string;
  reporterName: string;
  reporterPhone: string | null;
  targetName: string | null;
  targetPhone: string | null;
  storeItemTitle: string | null;
  storeItemStatus: string | null;
}

const STATUS = {
  pending: { color: "red", label: "접수" },
  resolved: { color: "green", label: "조치함" },
  dismissed: { color: "default", label: "문제없음" },
} as const;

const ReportsPage: IDefaultLayoutPage = () => {
  const { data: session } = useSession();
  const [rows, setRows] = useState<IReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [target, setTarget] = useState<IReport | null>(null);
  const [note, setNote] = useState("");
  const [hideListing, setHideListing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = statusFilter === "all" ? "" : `?status=${statusFilter}`;
      const res = await fetch(`${API}/admin/reports${query}`, { headers: INTERNAL_HEADERS });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch {
      message.error("신고 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const openHandle = (row: IReport) => {
    setTarget(row);
    setNote(row.adminNote ?? "");
    // 허위매물·사기 신고는 매물을 내리는 게 기본 조치라 체크를 미리 켜둔다
    setHideListing(row.reason === "fake" || row.reason === "fraud");
  };

  const handle = async (status: "resolved" | "dismissed") => {
    if (!target) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/admin/reports/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...INTERNAL_HEADERS },
        body: JSON.stringify({
          status,
          adminNote: note,
          adminLogin: session?.user?.login,
          // 문제없음으로 닫을 때는 매물을 내리지 않는다
          hideListing: status === "resolved" ? hideListing : false,
        }),
      });
      if (!res.ok) throw new Error();
      message.success(status === "resolved" ? "조치 처리했습니다." : "문제없음으로 닫았습니다.");
      setTarget(null);
      load();
    } catch {
      message.error("처리하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnsType<IReport> = [
    {
      title: "접수일시",
      dataIndex: "createdAt",
      width: 140,
      render: (v: string) => <span className="text-xs">{dayjs(v).format("YYYY-MM-DD HH:mm")}</span>,
    },
    {
      title: "상태",
      dataIndex: "status",
      width: 90,
      render: (v: IReport["status"]) => <Tag color={STATUS[v].color}>{STATUS[v].label}</Tag>,
    },
    {
      title: "구분",
      dataIndex: "targetType",
      width: 80,
      render: (v: IReport["targetType"]) => (
        <span className="text-xs">{v === "listing" ? "매물" : "대화"}</span>
      ),
    },
    {
      title: "사유",
      dataIndex: "reasonLabel",
      width: 170,
      render: (v: string, row) => (
        <div>
          <p className="text-xs font-semibold">{v}</p>
          {row.detail && <p className="text-xs text-gray-400 whitespace-pre-wrap">{row.detail}</p>}
        </div>
      ),
    },
    {
      title: "대상 매물",
      key: "item",
      render: (_, row) => (
        <div>
          <p className="text-xs">{row.storeItemTitle ?? "-"}</p>
          <p className="text-xs text-gray-400">
            #{row.storeItemId ?? "-"} {row.storeItemStatus ? `· ${row.storeItemStatus}` : ""}
          </p>
        </div>
      ),
    },
    {
      title: "신고자",
      key: "reporter",
      width: 130,
      render: (_, row) => (
        <div>
          <p className="text-xs">{row.reporterName}</p>
          <p className="text-xs text-gray-400">{row.reporterPhone ?? "-"}</p>
        </div>
      ),
    },
    {
      title: "피신고자",
      key: "target",
      width: 130,
      render: (_, row) => (
        <div>
          <p className="text-xs">{row.targetName ?? "-"}</p>
          <p className="text-xs text-gray-400">{row.targetPhone ?? "-"}</p>
        </div>
      ),
    },
    {
      title: "처리",
      key: "action",
      width: 150,
      render: (_, row) =>
        row.status === "pending" ? (
          <Button size="small" type="primary" onClick={() => openHandle(row)}>
            처리하기
          </Button>
        ) : (
          <div>
            <p className="text-xs text-gray-500">{row.handledBy ?? "-"}</p>
            <p className="text-xs text-gray-400">
              {row.handledAt ? dayjs(row.handledAt).format("MM-DD HH:mm") : ""}
            </p>
            {row.adminNote && <p className="text-xs text-gray-400">{row.adminNote}</p>}
          </div>
        ),
    },
  ];

  return (
    <RequireSuperAdmin>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-400">
          개인 직거래(카비어 홈페이지)에서 올라온 신고입니다. 신고만으로 매물이 내려가지는 않으니
          내용을 확인한 뒤 직접 조치해주세요.
        </p>

        <div className="flex items-center gap-2">
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 140 }}
            options={[
              { value: "pending", label: "접수" },
              { value: "resolved", label: "조치함" },
              { value: "dismissed", label: "문제없음" },
              { value: "all", label: "전체" },
            ]}
          />
          <Button onClick={load} loading={loading}>
            새로고침
          </Button>
          <span className="text-xs text-gray-400">{rows.length}건</span>
        </div>

        <Table
          rowKey="id"
          size="small"
          loading={loading}
          columns={columns}
          dataSource={rows}
          pagination={{ pageSize: 30 }}
          scroll={{ x: 1100 }}
        />
      </div>

      <Modal
        open={!!target}
        title={`신고 #${target?.id} 처리`}
        onCancel={() => setTarget(null)}
        footer={null}
        width={520}
      >
        {target && (
          <div className="flex flex-col gap-3">
            <div className="rounded-lg bg-gray-50 px-4 py-3">
              <p className="text-xs text-gray-400">{target.targetType === "listing" ? "매물 신고" : "대화 신고"}</p>
              <p className="text-sm font-semibold">{target.reasonLabel}</p>
              {target.detail && <p className="text-xs text-gray-500 whitespace-pre-wrap mt-1">{target.detail}</p>}
              <p className="text-xs text-gray-400 mt-2">
                매물 #{target.storeItemId ?? "-"} {target.storeItemTitle ?? ""}
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={hideListing} onChange={(e) => setHideListing(e.target.checked)} />
              매물을 내린다(hidden) — 지우지 않고 숨기므로 기록은 남습니다
            </label>

            <Input.TextArea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="처리 내용 (예: 판매자 통화 확인, 사진 도용 확인되어 매물 내림)"
            />

            <div className="flex gap-2">
              <Button block loading={saving} onClick={() => handle("dismissed")}>
                문제없음으로 닫기
              </Button>
              <Button block type="primary" danger loading={saving} onClick={() => handle("resolved")}>
                조치 완료
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </RequireSuperAdmin>
  );
};

const pageHeader: IPageHeader = {
  title: "신고 관리",
};

ReportsPage.getLayout = getDefaultLayout;
ReportsPage.pageHeader = pageHeader;

export default ReportsPage;
