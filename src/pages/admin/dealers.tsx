import { getDefaultLayout, IDefaultLayoutPage } from "@/components/layout/default-layout";
import RequireSuperAdmin from "@/components/shared/require-super-admin";
import { Button, message, Popconfirm, Spin, Table, Tag } from "antd";
import { useCallback, useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_ENDPOINT;
const INTERNAL_KEY = process.env.NEXT_PUBLIC_STORE_ITEMS_INTERNAL_KEY ?? "";

interface Dealer {
  id: number;
  email: string;
  name: string;
  phone?: string;
  companyName?: string;
  businessNumber?: string;
  dealerLicenseUrl?: string;
  businessRegUrl?: string;
  dealerStatus: "none" | "pending" | "approved" | "rejected";
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { color: string; text: string }> = {
  pending: { color: "blue", text: "승인대기" },
  approved: { color: "green", text: "승인됨" },
  rejected: { color: "red", text: "거절됨" },
  none: { color: "default", text: "-" },
};

const DealerApprovalPage: IDefaultLayoutPage = () => {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const fetchDealers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/users/dealers`);
      const data = await res.json();
      const list: Dealer[] = Array.isArray(data) ? data : [];
      // 승인대기를 상단으로 정렬
      list.sort((a, b) => (a.dealerStatus === "pending" ? -1 : 0) - (b.dealerStatus === "pending" ? -1 : 0));
      setDealers(list);
    } catch {
      message.error("딜러 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDealers(); }, [fetchDealers]);

  const handleUpdateStatus = async (id: number, name: string, status: "approved" | "rejected") => {
    setUpdatingId(id);
    try {
      const res = await fetch(`${API}/users/${id}/dealer-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-internal-key": INTERNAL_KEY },
        body: JSON.stringify({ dealerStatus: status }),
      });
      if (!res.ok) throw new Error("상태 변경 실패");
      message.success(`${name} 딜러를 ${status === "approved" ? "승인" : "거절"}했습니다.`);
      fetchDealers();
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const columns = [
    { title: "이름", dataIndex: "name", render: (v: string) => <span className="font-semibold">{v}</span> },
    { title: "이메일", dataIndex: "email", render: (v: string) => <span className="text-gray-500">{v}</span> },
    { title: "연락처", dataIndex: "phone", render: (v?: string) => v ?? <span className="text-gray-300">-</span> },
    { title: "상호명", dataIndex: "companyName", render: (v?: string) => v ?? <span className="text-gray-300">-</span> },
    { title: "사업자번호", dataIndex: "businessNumber", render: (v?: string) => v ?? <span className="text-gray-300">-</span> },
    {
      title: "매매종사원증",
      dataIndex: "dealerLicenseUrl",
      render: (v?: string) =>
        v ? <a href={v} target="_blank" rel="noreferrer" className="text-blue-600 underline">보기</a> : <span className="text-gray-300">-</span>,
    },
    {
      title: "사업자등록증",
      dataIndex: "businessRegUrl",
      render: (v?: string) =>
        v ? <a href={v} target="_blank" rel="noreferrer" className="text-blue-600 underline">보기</a> : <span className="text-gray-300">-</span>,
    },
    {
      title: "상태",
      dataIndex: "dealerStatus",
      render: (v: string) => {
        const sc = STATUS_CONFIG[v] ?? { color: "default", text: v };
        return <Tag color={sc.color}>{sc.text}</Tag>;
      },
    },
    {
      title: "가입일",
      dataIndex: "createdAt",
      render: (v: string) => new Date(v).toLocaleDateString("ko-KR"),
    },
    {
      title: "작업",
      render: (_: any, record: Dealer) =>
        record.dealerStatus === "pending" ? (
          <div className="flex gap-2">
            <Popconfirm
              title={`${record.name}을(를) 승인하시겠습니까?`}
              okText="승인"
              cancelText="취소"
              onConfirm={() => handleUpdateStatus(record.id, record.name, "approved")}
            >
              <Button size="small" type="primary" loading={updatingId === record.id} style={{ background: "#16a34a", border: "none" }}>
                승인
              </Button>
            </Popconfirm>
            <Popconfirm
              title={`${record.name}을(를) 거절하시겠습니까?`}
              okText="거절"
              okButtonProps={{ danger: true }}
              cancelText="취소"
              onConfirm={() => handleUpdateStatus(record.id, record.name, "rejected")}
            >
              <Button size="small" danger loading={updatingId === record.id}>거절</Button>
            </Popconfirm>
          </div>
        ) : (
          <span className="text-gray-300 text-xs">-</span>
        ),
    },
  ];

  return (
    <RequireSuperAdmin>
      <div className="p-6 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">딜러 승인 관리</h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spin /></div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <Table
              dataSource={dealers}
              columns={columns}
              rowKey="id"
              pagination={false}
              locale={{ emptyText: "가입한 딜러가 없습니다." }}
            />
          </div>
        )}
      </div>
    </RequireSuperAdmin>
  );
};

DealerApprovalPage.getLayout = getDefaultLayout;
export default DealerApprovalPage;
