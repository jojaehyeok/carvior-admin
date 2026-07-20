import { useAuth } from "@/lib/auth/auth-provider";
import { useRouter } from "next/router";
import { PropsWithChildren, useEffect } from "react";
import Spinner from "./spinner";

/**
 * 스마트옥션 매물 관리 등 슈퍼 관리자 전용 화면을 감싸는 가드.
 * 메뉴에는 이미 발주사 계정에서 안 보이게 되어 있지만, URL을 직접 입력하면
 * 그동안 그대로 접근·조작이 가능했다 — 페이지 레벨에서도 막는다.
 */
const RequireSuperAdmin = ({ children }: PropsWithChildren) => {
  const { session } = useAuth();
  const router = useRouter();
  const isSuperAdmin = session.user.role === "SUPER_ADMIN";

  useEffect(() => {
    if (!isSuperAdmin) router.replace("/");
  }, [isSuperAdmin, router]);

  if (!isSuperAdmin) return <Spinner />;
  return <>{children}</>;
};

export default RequireSuperAdmin;
