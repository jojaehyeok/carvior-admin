import { useAuth } from "@/lib/auth/auth-provider";
import { getDefaultLayout, IDefaultLayoutPage } from "@/components/layout/default-layout";
import { Button, Form, Input, message, Spin, Tag } from "antd";
import { useCallback, useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_ENDPOINT;

interface AdminUser {
  id: number;
  email: string;
  name: string;
  phone?: string;
  company?: string | null;
}

const ProfilePage: IDefaultLayoutPage = () => {
  const { session } = useAuth();
  const { id, login, role, company, name } = session.user;

  // 하드코딩 계정(admin/anyone/gwangmyeong 등)은 id가 숫자가 아닌 계정 키 문자열이고,
  // DB 계정(관리자 계정 관리에서 생성)은 id가 실제 users 테이블의 숫자 PK다.
  const isDbAccount = /^\d+$/.test(id);

  const [loading, setLoading] = useState(isDbAccount);
  const [me, setMe] = useState<AdminUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [infoForm] = Form.useForm();
  const [pwForm] = Form.useForm();

  const fetchMe = useCallback(async () => {
    if (!isDbAccount) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/users/admins`);
      const data: AdminUser[] = await res.json();
      const mine = Array.isArray(data) ? data.find(u => String(u.id) === id) : null;
      if (mine) {
        setMe(mine);
        infoForm.setFieldsValue({ name: mine.name, phone: mine.phone });
      }
    } catch {
      message.error("내 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [id, isDbAccount, infoForm]);

  useEffect(() => { fetchMe(); }, [fetchMe]);

  const handleSaveInfo = async (values: { name: string; phone?: string }) => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/users/${id}/admin-info`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("수정 실패");
      message.success("정보가 수정되었습니다.");
      fetchMe();
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (values: { password: string }) => {
    setChangingPw(true);
    try {
      const res = await fetch(`${API}/users/${id}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: values.password }),
      });
      if (!res.ok) throw new Error("비밀번호 변경 실패");
      message.success("비밀번호가 변경되었습니다.");
      pwForm.resetFields();
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setChangingPw(false);
    }
  };

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-2xl font-bold mb-1">내 프로필</h1>
      <p className="text-gray-400 text-sm mb-6">{login}</p>

      <div className="mb-6">
        {company ? (
          <Tag color="blue">발주사 관리자 · {company}</Tag>
        ) : (
          <Tag color="purple">슈퍼 관리자</Tag>
        )}
      </div>

      {!isDbAccount ? (
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <p className="font-semibold mb-2">{name}</p>
          <p className="text-sm text-gray-500 leading-relaxed">
            이 계정은 코드에 등록된 계정이라 이름·연락처·비밀번호를 여기서 직접 수정할 수 없습니다.<br />
            관리자 계정 관리 화면에서 DB 계정으로 새로 발급받으면 이 페이지에서 직접 수정할 수 있습니다.
          </p>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-16"><Spin /></div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
            <h2 className="font-semibold mb-4">내 정보</h2>
            <Form form={infoForm} layout="vertical" onFinish={handleSaveInfo}>
              <Form.Item name="name" label="이름" rules={[{ required: true, message: "이름을 입력하세요." }]}>
                <Input placeholder="홍길동" />
              </Form.Item>
              <Form.Item name="phone" label="연락처">
                <Input placeholder="01012345678" />
              </Form.Item>
              <div className="flex justify-end">
                <Button type="primary" htmlType="submit" loading={saving} style={{ background: "#7c3aed", border: "none" }}>
                  저장
                </Button>
              </div>
            </Form>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h2 className="font-semibold mb-4">비밀번호 변경</h2>
            <Form form={pwForm} layout="vertical" onFinish={handleChangePassword}>
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
              <div className="flex justify-end">
                <Button type="primary" htmlType="submit" loading={changingPw} style={{ background: "#7c3aed", border: "none" }}>
                  변경
                </Button>
              </div>
            </Form>
          </div>
        </>
      )}
    </div>
  );
};

ProfilePage.getLayout = getDefaultLayout;
export default ProfilePage;
