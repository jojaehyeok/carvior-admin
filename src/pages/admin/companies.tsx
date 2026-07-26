import { getDefaultLayout, IDefaultLayoutPage } from "@/components/layout/default-layout";
import RequireSuperAdmin from "@/components/shared/require-super-admin";
import { Button, Form, Input, message, Modal, Spin, Table, Tag } from "antd";
import { useCallback, useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_ENDPOINT;

interface UnregisteredSource {
  source: string;
  count: number;
}

interface IssuedCredentials {
  company: string;
  username: string;
  password: string;
}

// 승인 시 1회성 임시 비밀번호를 자동 발급 — 헷갈리기 쉬운 0/O, 1/l/I는 빼서
// 화면에 한 번 보여주고 담당자에게 전달할 때 오타 위험을 줄인다.
function generatePassword(length = 10): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let pw = "";
  for (let i = 0; i < length; i++) {
    pw += chars[Math.floor(Math.random() * chars.length)];
  }
  return pw;
}

const CompanyApprovalPage: IDefaultLayoutPage = () => {
  const [sources, setSources] = useState<UnregisteredSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [approveTarget, setApproveTarget] = useState<UnregisteredSource | null>(null);
  const [approving, setApproving] = useState(false);
  const [issuedCreds, setIssuedCreds] = useState<IssuedCredentials | null>(null);
  const [form] = Form.useForm();

  const fetchSources = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/external/request/unregistered-sources`);
      const data = await res.json();
      setSources(Array.isArray(data) ? data : []);
    } catch {
      message.error("발주사 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSources(); }, [fetchSources]);

  const openApprove = (row: UnregisteredSource) => {
    setApproveTarget(row);
    form.resetFields();
    form.setFieldsValue({ username: row.source.replace(/[^a-zA-Z0-9._-]/g, "") });
  };

  const handleApprove = async (values: { username: string; name: string; phone?: string }) => {
    if (!approveTarget) return;
    setApproving(true);
    try {
      const password = generatePassword();
      const res = await fetch(`${API}/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          phone: values.phone,
          password,
          email: `${values.username}@carvior.store`,
          role: "admin",
          company: approveTarget.source,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "계정 생성 실패");
      }
      message.success(`${approveTarget.source} 관리자 계정이 생성되었습니다.`);
      setIssuedCreds({ company: approveTarget.source, username: values.username, password });
      setApproveTarget(null);
      fetchSources();
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setApproving(false);
    }
  };

  const columns = [
    {
      title: "발주사 코드",
      dataIndex: "source",
      render: (v: string) => <span className="font-semibold whitespace-nowrap">{v}</span>,
    },
    {
      title: "누적 접수 건수",
      dataIndex: "count",
      width: 140,
      render: (v: number) => <Tag color="orange">{v}건</Tag>,
    },
    {
      title: "작업",
      width: 160,
      render: (_: unknown, record: UnregisteredSource) => (
        <Button
          type="primary"
          size="small"
          style={{ background: "#7c3aed", border: "none" }}
          onClick={() => openApprove(record)}
        >
          승인 (계정 생성)
        </Button>
      ),
    },
  ];

  return (
    <RequireSuperAdmin>
      <div className="p-6 max-w-7xl">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold">발주사 관리</h1>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          접수는 들어오고 있지만 아직 로그인 계정이 없는 발주사 코드 목록입니다. 승인하면 그 발주사 전용 관리자 계정이 바로 생성됩니다.
        </p>

        {loading ? (
          <div className="flex justify-center py-16"><Spin /></div>
        ) : (
          // 발주사 코드가 길거나 목록이 많아지는 경우를 대비해 테이블만 가로 스크롤되도록
          // 감싸서, 페이지 전체가 우측으로 밀리지 않게 한다.
          <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
            <Table
              dataSource={sources}
              columns={columns}
              rowKey="source"
              pagination={false}
              scroll={{ x: "max-content" }}
              locale={{ emptyText: "승인 대기 중인 발주사가 없습니다." }}
            />
          </div>
        )}

        {/* 승인 모달 */}
        <Modal
          title={`발주사 승인 — ${approveTarget?.source}`}
          open={!!approveTarget}
          onCancel={() => setApproveTarget(null)}
          footer={null}
          destroyOnClose
        >
          <Form form={form} layout="vertical" onFinish={handleApprove} className="pt-2">
            <Form.Item name="name" label="담당자 이름" rules={[{ required: true, message: "이름을 입력하세요." }]}>
              <Input placeholder="홍길동" />
            </Form.Item>
            <Form.Item name="phone" label="연락처 (진단완료 알림 발송용)">
              <Input placeholder="01012345678" />
            </Form.Item>
            <Form.Item
              name="username"
              label="아이디"
              rules={[
                { required: true, message: "아이디를 입력하세요." },
                { pattern: /^[a-zA-Z0-9._-]+$/, message: "영문/숫자/._- 만 입력하세요." },
              ]}
            >
              <Input addonAfter="@carvior.store" />
            </Form.Item>
            <p className="text-xs text-gray-400 mb-2">비밀번호는 승인 시 자동 생성되어 다음 화면에 한 번만 표시됩니다.</p>
            <div className="flex gap-2 justify-end mt-4">
              <Button onClick={() => setApproveTarget(null)}>취소</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={approving}
                style={{ background: "#7c3aed", border: "none" }}
              >
                승인 및 계정 생성
              </Button>
            </div>
          </Form>
        </Modal>

        {/* 발급된 계정 정보 확인 모달 */}
        <Modal
          title="계정 생성 완료"
          open={!!issuedCreds}
          onCancel={() => setIssuedCreds(null)}
          footer={[
            <Button
              key="close"
              type="primary"
              style={{ background: "#7c3aed", border: "none" }}
              onClick={() => setIssuedCreds(null)}
            >
              확인
            </Button>,
          ]}
        >
          <p className="text-sm text-gray-600 mb-4">
            아래 계정 정보를 <b>{issuedCreds?.company}</b> 담당자에게 전달해주세요. 비밀번호는 다시 확인할 수 없으니 지금 복사해두세요.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2 font-mono text-sm break-all">
            <div>아이디: {issuedCreds?.username}@carvior.store</div>
            <div>비밀번호: {issuedCreds?.password}</div>
          </div>
        </Modal>
      </div>
    </RequireSuperAdmin>
  );
};

CompanyApprovalPage.getLayout = getDefaultLayout;
export default CompanyApprovalPage;
