import { getDefaultLayout, IDefaultLayoutPage } from "@/components/layout/default-layout";
import { Button, Form, Input, message, Modal, Popconfirm, Spin, Table, Tag } from "antd";
import { useCallback, useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_ENDPOINT;

interface AdminUser {
  id: number;
  email: string;
  name: string;
  phone?: string;
  role: string;
  createdAt: string;
}

const AdminAccountPage: IDefaultLayoutPage = () => {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState<AdminUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [createForm] = Form.useForm();
  const [pwForm] = Form.useForm();

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/users/admins`);
      const data = await res.json();
      setAdmins(Array.isArray(data) ? data : []);
    } catch {
      message.error("관리자 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAdmins(); }, [fetchAdmins]);

  const handleCreate = async (values: { email: string; password: string; name: string; phone?: string }) => {
    setCreating(true);
    try {
      const res = await fetch(`${API}/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, role: "admin" }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "생성 실패");
      }
      message.success("관리자 계정이 생성되었습니다.");
      setCreateOpen(false);
      createForm.resetFields();
      fetchAdmins();
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleChangePassword = async (values: { password: string }) => {
    if (!pwOpen) return;
    setChangingPw(true);
    try {
      const res = await fetch(`${API}/users/${pwOpen.id}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: values.password }),
      });
      if (!res.ok) throw new Error("비밀번호 변경 실패");
      message.success("비밀번호가 변경되었습니다.");
      setPwOpen(null);
      pwForm.resetFields();
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setChangingPw(false);
    }
  };

  const handleRevokeAdmin = async (id: number, name: string) => {
    try {
      const res = await fetch(`${API}/users/${id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "user" }),
      });
      if (!res.ok) throw new Error("권한 변경 실패");
      message.success(`${name}의 관리자 권한이 해제되었습니다.`);
      fetchAdmins();
    } catch (e: any) {
      message.error(e.message);
    }
  };

  const columns = [
    {
      title: "이름",
      dataIndex: "name",
      render: (v: string) => <span className="font-semibold">{v}</span>,
    },
    {
      title: "이메일",
      dataIndex: "email",
      render: (v: string) => <span className="text-gray-500">{v}</span>,
    },
    {
      title: "연락처",
      dataIndex: "phone",
      render: (v?: string) => v ?? <span className="text-gray-300">-</span>,
    },
    {
      title: "역할",
      dataIndex: "role",
      render: () => <Tag color="purple">관리자</Tag>,
    },
    {
      title: "생성일",
      dataIndex: "createdAt",
      render: (v: string) => new Date(v).toLocaleDateString("ko-KR"),
    },
    {
      title: "작업",
      render: (_: any, record: AdminUser) => (
        <div className="flex gap-2">
          <Button
            size="small"
            onClick={() => { setPwOpen(record); pwForm.resetFields(); }}
          >
            비밀번호 변경
          </Button>
          <Popconfirm
            title={`${record.name}의 관리자 권한을 해제하시겠습니까?`}
            okText="해제"
            okButtonProps={{ danger: true }}
            cancelText="취소"
            onConfirm={() => handleRevokeAdmin(record.id, record.name)}
          >
            <Button size="small" danger>권한 해제</Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">관리자 계정 관리</h1>
        <Button
          type="primary"
          onClick={() => { setCreateOpen(true); createForm.resetFields(); }}
          style={{ background: "#7c3aed", border: "none" }}
        >
          + 관리자 추가
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spin /></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <Table
            dataSource={admins}
            columns={columns}
            rowKey="id"
            pagination={false}
            locale={{ emptyText: "등록된 관리자가 없습니다." }}
          />
        </div>
      )}

      {/* 관리자 생성 모달 */}
      <Modal
        title="관리자 계정 추가"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate} className="pt-2">
          <Form.Item name="name" label="이름" rules={[{ required: true, message: "이름을 입력하세요." }]}>
            <Input placeholder="홍길동" />
          </Form.Item>
          <Form.Item
            name="email"
            label="이메일"
            rules={[
              { required: true, message: "이메일을 입력하세요." },
              { type: "email", message: "올바른 이메일 형식이 아닙니다." },
            ]}
          >
            <Input placeholder="admin@carvior.com" />
          </Form.Item>
          <Form.Item name="phone" label="연락처">
            <Input placeholder="01012345678" />
          </Form.Item>
          <Form.Item
            name="password"
            label="비밀번호"
            rules={[
              { required: true, message: "비밀번호를 입력하세요." },
              { min: 8, message: "8자 이상 입력하세요." },
            ]}
          >
            <Input.Password placeholder="8자 이상" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="비밀번호 확인"
            dependencies={["password"]}
            rules={[
              { required: true, message: "비밀번호를 한 번 더 입력하세요." },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("password") === value) return Promise.resolve();
                  return Promise.reject("비밀번호가 일치하지 않습니다.");
                },
              }),
            ]}
          >
            <Input.Password placeholder="비밀번호 재입력" />
          </Form.Item>
          <div className="flex gap-2 justify-end mt-4">
            <Button onClick={() => setCreateOpen(false)}>취소</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={creating}
              style={{ background: "#7c3aed", border: "none" }}
            >
              생성
            </Button>
          </div>
        </Form>
      </Modal>

      {/* 비밀번호 변경 모달 */}
      <Modal
        title={`비밀번호 변경 — ${pwOpen?.name}`}
        open={!!pwOpen}
        onCancel={() => setPwOpen(null)}
        footer={null}
        destroyOnClose
      >
        <Form form={pwForm} layout="vertical" onFinish={handleChangePassword} className="pt-2">
          <Form.Item
            name="password"
            label="새 비밀번호"
            rules={[
              { required: true, message: "새 비밀번호를 입력하세요." },
              { min: 8, message: "8자 이상 입력하세요." },
            ]}
          >
            <Input.Password placeholder="8자 이상" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="새 비밀번호 확인"
            dependencies={["password"]}
            rules={[
              { required: true, message: "비밀번호를 한 번 더 입력하세요." },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("password") === value) return Promise.resolve();
                  return Promise.reject("비밀번호가 일치하지 않습니다.");
                },
              }),
            ]}
          >
            <Input.Password placeholder="비밀번호 재입력" />
          </Form.Item>
          <div className="flex gap-2 justify-end mt-4">
            <Button onClick={() => setPwOpen(null)}>취소</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={changingPw}
              style={{ background: "#7c3aed", border: "none" }}
            >
              변경
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

AdminAccountPage.getLayout = getDefaultLayout;
export default AdminAccountPage;
