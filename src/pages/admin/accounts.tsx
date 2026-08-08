import { getDefaultLayout, IDefaultLayoutPage } from "@/components/layout/default-layout";
import RequireSuperAdmin from "@/components/shared/require-super-admin";
import { Button, Form, Input, message, Modal, Popconfirm, Spin, Switch, Table, Tag, Upload } from "antd";
import { Upload as UploadIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_ENDPOINT;
const INTERNAL_KEY = process.env.NEXT_PUBLIC_STORE_ITEMS_INTERNAL_KEY ?? '';

interface AdminUser {
  id: number;
  email: string;
  name: string;
  phone?: string;
  role: string;
  company?: string | null;
  logoUrl?: string | null;
  isExportOnly?: boolean;
  canConfirmBilling?: boolean;
  createdAt: string;
}

interface PartnerApplication {
  id: number;
  name: string;
  phone: string;
  email?: string;
  companyName?: string;
  message?: string;
  qualifyingCount: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

async function uploadLogoFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API}/users/upload-logo`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error('로고 업로드 실패');
  const data = await res.json();
  return data.url as string;
}

const AdminAccountPage: IDefaultLayoutPage = () => {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState<AdminUser | null>(null);
  const [editOpen, setEditOpen] = useState<AdminUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [editing, setEditing] = useState(false);
  const [createForm] = Form.useForm();
  const [pwForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [createLogoUrl, setCreateLogoUrl] = useState<string | null>(null);
  const [editLogoUrl, setEditLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

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

  // 파트너패널(/marketing/partner-panel) 제휴신청 접수 목록
  const [partnerApps, setPartnerApps] = useState<PartnerApplication[]>([]);
  const [partnerAppsLoading, setPartnerAppsLoading] = useState(false);

  const fetchPartnerApps = useCallback(async () => {
    setPartnerAppsLoading(true);
    try {
      const res = await fetch(`${API}/admin/partner-applications`, { headers: { 'x-internal-key': INTERNAL_KEY } });
      const data = await res.json();
      setPartnerApps(Array.isArray(data) ? data : []);
    } catch {
      message.error("제휴신청 목록을 불러오지 못했습니다.");
    } finally {
      setPartnerAppsLoading(false);
    }
  }, []);

  useEffect(() => { fetchPartnerApps(); }, [fetchPartnerApps]);

  // 제휴신청에서 "계정 생성"으로 들어온 경우, 계정이 실제로 만들어지면 그 신청서
  // status도 자동으로 approved로 넘겨주기 위해 어떤 신청서에서 왔는지 기억해둠.
  const [creatingFromApp, setCreatingFromApp] = useState<PartnerApplication | null>(null);

  const handleCreateFromApplication = (app: PartnerApplication) => {
    createForm.resetFields();
    createForm.setFieldsValue({ name: app.name, phone: app.phone });
    setCreatingFromApp(app);
    setCreateOpen(true);
  };

  const handleUpdateApplicationStatus = async (app: PartnerApplication, status: 'approved' | 'rejected') => {
    try {
      await fetch(`${API}/admin/partner-applications/${app.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-internal-key': INTERNAL_KEY },
        body: JSON.stringify({ status }),
      });
      message.success(status === 'approved' ? '처리완료로 표시했습니다.' : '거절 처리했습니다.');
      fetchPartnerApps();
    } catch {
      message.error('상태 변경에 실패했습니다.');
    }
  };

  const handleCreate = async (values: { username: string; password: string; name: string; phone?: string; company?: string; isExportOnly?: boolean; canConfirmBilling?: boolean }) => {
    setCreating(true);
    try {
      const { username, ...rest } = values;
      const res = await fetch(`${API}/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...rest, email: `${username}@carvior.store`, role: "admin", company: values.company || null, logoUrl: createLogoUrl }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "생성 실패");
      }
      message.success("관리자 계정이 생성되었습니다.");
      setCreateOpen(false);
      createForm.resetFields();
      setCreateLogoUrl(null);
      fetchAdmins();

      if (creatingFromApp) {
        await handleUpdateApplicationStatus(creatingFromApp, 'approved');
        setCreatingFromApp(null);
      }
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

  const handleEditInfo = async (values: { name: string; phone?: string; company?: string; isExportOnly?: boolean; canConfirmBilling?: boolean }) => {
    if (!editOpen) return;
    setEditing(true);
    try {
      const res = await fetch(`${API}/users/${editOpen.id}/admin-info`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, company: values.company || null, logoUrl: editLogoUrl }),
      });
      if (!res.ok) throw new Error("수정 실패");
      message.success("계정 정보가 수정되었습니다.");
      setEditOpen(null);
      editForm.resetFields();
      setEditLogoUrl(null);
      fetchAdmins();
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setEditing(false);
    }
  };

  const handleLogoPick = async (file: File, apply: (url: string) => void) => {
    setUploadingLogo(true);
    try {
      const url = await uploadLogoFile(file);
      apply(url);
      message.success("로고가 업로드되었습니다.");
    } catch {
      message.error("로고 업로드 실패");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRevokeAdmin = async (id: number, name: string) => {
    try {
      const res = await fetch(`${API}/users/${id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-internal-key": INTERNAL_KEY },
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
      width: 140,
      render: (v: string, record: AdminUser) => (
        <div className="flex items-center gap-2">
          {record.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={record.logoUrl} alt="" className="w-6 h-6 rounded object-contain border border-gray-100" />
          ) : null}
          <span className="font-semibold whitespace-nowrap">{v}</span>
        </div>
      ),
    },
    {
      title: "이메일",
      dataIndex: "email",
      width: 220,
      render: (v: string) => <span className="text-gray-500 whitespace-nowrap">{v}</span>,
    },
    {
      title: "연락처",
      dataIndex: "phone",
      width: 140,
      render: (v?: string) => v ?? <span className="text-gray-300">-</span>,
    },
    {
      title: "역할",
      dataIndex: "role",
      width: 260,
      render: (_: string, record: AdminUser) => (
        <div className="flex flex-wrap gap-1">
          {record.company ? (
            <Tag color="blue" className="whitespace-nowrap">발주사 관리자 · {record.company}</Tag>
          ) : (
            <Tag color="purple">슈퍼 관리자</Tag>
          )}
          {record.isExportOnly && <Tag color="gold">수출전용</Tag>}
          {record.canConfirmBilling && <Tag color="green">매입가/구전 확인권한</Tag>}
        </div>
      ),
    },
    {
      title: "생성일",
      dataIndex: "createdAt",
      width: 110,
      render: (v: string) => new Date(v).toLocaleDateString("ko-KR"),
    },
    {
      title: "작업",
      width: 280,
      render: (_: any, record: AdminUser) => (
        <div className="flex gap-2">
          <Button
            size="small"
            onClick={() => {
              setEditOpen(record);
              setEditLogoUrl(record.logoUrl ?? null);
              editForm.setFieldsValue({ name: record.name, phone: record.phone, company: record.company ?? "", isExportOnly: !!record.isExportOnly, canConfirmBilling: !!record.canConfirmBilling });
            }}
          >
            정보 수정
          </Button>
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
    <RequireSuperAdmin>
    <div className="p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">관리자 계정 관리</h1>
        <Button
          type="primary"
          onClick={() => { setCreateOpen(true); createForm.resetFields(); setCreatingFromApp(null); }}
          style={{ background: "#7c3aed", border: "none" }}
        >
          + 관리자 추가
        </Button>
      </div>

      {/* 파트너패널(/marketing/partner-panel) 제휴신청 접수 */}
      <div className="mb-8">
        <h2 className="text-sm font-black text-gray-700 mb-3">파트너패널 제휴신청</h2>
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <Table
            dataSource={partnerApps}
            loading={partnerAppsLoading}
            rowKey="id"
            pagination={false}
            locale={{ emptyText: "제휴신청 내역이 없습니다." }}
            columns={[
              { title: "이름", dataIndex: "name" },
              { title: "연락처", dataIndex: "phone" },
              { title: "이메일", dataIndex: "email", render: (v?: string) => v ?? <span className="text-gray-300">-</span> },
              { title: "회사명", dataIndex: "companyName", render: (v?: string) => v ?? <span className="text-gray-300">-</span> },
              { title: "개별건수", dataIndex: "qualifyingCount", render: (v: number) => `${v}회` },
              { title: "메모", dataIndex: "message", render: (v?: string) => v ?? <span className="text-gray-300">-</span> },
              {
                title: "상태", dataIndex: "status",
                render: (v: string) => (
                  <Tag color={v === "approved" ? "green" : v === "rejected" ? "red" : "blue"}>
                    {v === "approved" ? "처리완료" : v === "rejected" ? "거절됨" : "대기중"}
                  </Tag>
                ),
              },
              {
                title: "작업", render: (_: any, app: PartnerApplication) =>
                  app.status === "pending" ? (
                    <div className="flex gap-2">
                      <Button size="small" type="primary" onClick={() => handleCreateFromApplication(app)}>계정 생성</Button>
                      <Popconfirm title="처리완료로 표시할까요?" onConfirm={() => handleUpdateApplicationStatus(app, "approved")}>
                        <Button size="small">완료 표시</Button>
                      </Popconfirm>
                      <Popconfirm title="거절할까요?" onConfirm={() => handleUpdateApplicationStatus(app, "rejected")}>
                        <Button size="small" danger>거절</Button>
                      </Popconfirm>
                    </div>
                  ) : (
                    <span className="text-gray-300 text-xs">-</span>
                  ),
              },
            ]}
          />
        </div>
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
        onCancel={() => { setCreateOpen(false); setCreateLogoUrl(null); setCreatingFromApp(null); }}
        footer={null}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate} className="pt-2">
          {creatingFromApp && (
            <p className="text-xs text-violet-600 bg-violet-50 rounded-lg px-3 py-2 mb-4">
              #{creatingFromApp.id} 제휴신청에서 생성 — 계정이 만들어지면 그 신청서도 자동으로 처리완료 처리됩니다.
            </p>
          )}
          <Form.Item label="로고 (선택 — 발주사 화이트라벨용, 대시보드 사이드바에 표시)">
            <div className="flex items-center gap-3">
              {createLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={createLogoUrl} alt="" className="w-10 h-10 rounded object-contain border border-gray-100" />
              ) : null}
              <Upload
                accept="image/*"
                showUploadList={false}
                beforeUpload={(file) => { handleLogoPick(file, setCreateLogoUrl); return false; }}
              >
                <Button size="small" loading={uploadingLogo} icon={<UploadIcon width={14} height={14} />}>
                  {createLogoUrl ? "로고 다시 선택" : "로고 업로드"}
                </Button>
              </Upload>
            </div>
          </Form.Item>
          <Form.Item name="name" label="이름" rules={[{ required: true, message: "이름을 입력하세요." }]}>
            <Input placeholder="홍길동" />
          </Form.Item>
          <Form.Item
            name="username"
            label="아이디"
            rules={[
              { required: true, message: "아이디를 입력하세요." },
              { pattern: /^[a-zA-Z0-9._-]+$/, message: "영문/숫자/._- 만 입력하세요." },
            ]}
          >
            <Input placeholder="anyone" addonAfter="@carvior.store" />
          </Form.Item>
          <Form.Item name="phone" label="연락처">
            <Input placeholder="01012345678" />
          </Form.Item>
          <Form.Item
            name="company"
            label="발주사 코드 (선택 — 비우면 슈퍼 관리자, 입력하면 그 발주사 의뢰만 조회 가능)"
          >
            <Input placeholder="예: gwangmyeong-motors (비워두면 전체 조회 슈퍼 관리자)" />
          </Form.Item>
          <Form.Item
            name="isExportOnly"
            label="수출전용 발주사 (datrade처럼 수출용 차량만 다룸)"
            valuePropName="checked"
            initialValue={false}
          >
            <Switch />
          </Form.Item>
          <Form.Item
            name="canConfirmBilling"
            label="매입가/구전 확인 권한 (같은 회사 다른 관리자는 조회만 가능, 이 계정만 확인·미확인 토글 가능)"
            valuePropName="checked"
            initialValue={false}
          >
            <Switch />
          </Form.Item>
          <Form.Item
            name="password"
            label="비밀번호"
            rules={[
              { required: true, message: "비밀번호를 입력하세요." },
              { min: 4, message: "4자 이상 입력하세요." },
            ]}
          >
            <Input.Password placeholder="4자 이상" />
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
            <Button onClick={() => { setCreateOpen(false); setCreatingFromApp(null); }}>취소</Button>
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

      {/* 계정 정보 수정 모달 */}
      <Modal
        title={`정보 수정 — ${editOpen?.email}`}
        open={!!editOpen}
        onCancel={() => { setEditOpen(null); setEditLogoUrl(null); }}
        footer={null}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" onFinish={handleEditInfo} className="pt-2">
          <Form.Item label="로고 (선택 — 발주사 화이트라벨용, 대시보드 사이드바에 표시)">
            <div className="flex items-center gap-3">
              {editLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={editLogoUrl} alt="" className="w-10 h-10 rounded object-contain border border-gray-100" />
              ) : null}
              <Upload
                accept="image/*"
                showUploadList={false}
                beforeUpload={(file) => { handleLogoPick(file, setEditLogoUrl); return false; }}
              >
                <Button size="small" loading={uploadingLogo} icon={<UploadIcon width={14} height={14} />}>
                  {editLogoUrl ? "로고 다시 선택" : "로고 업로드"}
                </Button>
              </Upload>
              {editLogoUrl ? (
                <Button size="small" danger type="text" onClick={() => setEditLogoUrl(null)}>제거</Button>
              ) : null}
            </div>
          </Form.Item>
          <Form.Item name="name" label="이름" rules={[{ required: true, message: "이름을 입력하세요." }]}>
            <Input placeholder="홍길동" />
          </Form.Item>
          <Form.Item name="phone" label="연락처">
            <Input placeholder="01012345678" />
          </Form.Item>
          <Form.Item
            name="company"
            label="발주사 코드 (선택 — 비우면 슈퍼 관리자, 입력하면 그 발주사 의뢰만 조회 가능)"
          >
            <Input placeholder="예: gwanghyun (비워두면 전체 조회 슈퍼 관리자)" />
          </Form.Item>
          <Form.Item
            name="isExportOnly"
            label="수출전용 발주사 (datrade처럼 수출용 차량만 다룸)"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            name="canConfirmBilling"
            label="매입가/구전 확인 권한 (같은 회사 다른 관리자는 조회만 가능, 이 계정만 확인·미확인 토글 가능)"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <div className="flex gap-2 justify-end mt-4">
            <Button onClick={() => setEditOpen(null)}>취소</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={editing}
              style={{ background: "#7c3aed", border: "none" }}
            >
              저장
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
              { min: 4, message: "4자 이상 입력하세요." },
            ]}
          >
            <Input.Password placeholder="4자 이상" />
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
    </RequireSuperAdmin>
  );
};

AdminAccountPage.getLayout = getDefaultLayout;
export default AdminAccountPage;
