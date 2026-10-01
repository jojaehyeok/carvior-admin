import DefaultModal from "@/components/shared/ui/default-modal";
import { Alert, Button, Form, Input } from "antd";
import { useForm } from "antd/lib/form/Form";
import { signIn } from "next-auth/react";
import { useRouter } from "next/router";
import React, { useCallback, useState } from "react";

interface ILoginFormValue {
  username: string;
  password: string;
}

const LoginForm = () => {
  const router = useRouter();
  const [form] = useForm<ILoginFormValue>();
  const [isLoading, setIsLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const handleFinish = useCallback(async (value: ILoginFormValue) => {
    setIsLoading(true);

    try {
      // 전엔 여기서 value를 console.log로 찍어 비밀번호가 브라우저 콘솔에 그대로 남았다
      await signIn("login-credentials", { username: value.username, password: value.password });
    } catch (error) {
      setIsLoading(false);
    }
  }, []);

  return (
    <>
      {router?.query.error && router?.query.error !== "CredentialsSignin" ? (
        <div className="mb-3">
          <Alert message={`로그인 중 오류가 발생했습니다. ${router?.query.error}`} type="warning" />
        </div>
      ) : null}
      {/* 구글·깃허브 로그인 버튼은 템플릿에 딸려온 것으로 실제로 쓰지 않아 제거했다 */}
      <Form<ILoginFormValue>
        form={form}
        layout="vertical"
        /* 템플릿 기본값(admin/admin)이 아이디·비밀번호 칸에 미리 채워져 있었다 —
           실제 계정으로 로그인하는 화면이라 빈 칸에서 시작한다 */
        onFinish={handleFinish}
      >
        <div className="mb-3">
          {router?.query.error === "CredentialsSignin" ? (
            <>
              <Alert message="로그인을 실패했습니다. 아이디 또는 비밀번호를 다시 확인해주세요." type="error" />
            </>
          ) : (
            <></>
          )}
        </div>
        <Form.Item name="username" rules={[{ required: true, message: "아이디를 입력해주세요" }]}>
          <Input size="large" placeholder="아이디" />
        </Form.Item>

        <Form.Item name="password" rules={[{ required: true, message: "비밀번호를 입력해주세요" }]}>
          <Input placeholder="비밀번호" type="password" size="large" />
        </Form.Item>

        <Button size="large" type="primary" htmlType="submit" className="w-full" loading={isLoading}>
          로그인
        </Button>

        <a className="inline-block mt-2 text-gray-400" onClick={() => setShowPasswordModal(true)}>
          비밀번호 찾기
        </a>
      </Form>

      <DefaultModal title="비밀번호 찾기" open={showPasswordModal} handleHide={() => setShowPasswordModal(false)}>
        비밀번호는 화면에서 직접 바꿀 수 없습니다. 카비어 관리자에게 요청해주세요.
      </DefaultModal>
    </>
  );
};

export default React.memo(LoginForm);
