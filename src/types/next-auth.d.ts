/* @see https://authjs.dev/getting-started/typescript#extend-default-interface-properties */
/**
 * name, email, image 외에 추가 속성을 정의
 */
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      login: string;
      /** 'SUPER_ADMIN' | 'COMPANY_ADMIN' */
      role: string;
      /** 발주사 ID (예: 'anyone-motors'). SUPER_ADMIN이면 null */
      company: string | null;
      /** 발주사 화이트라벨 로고 URL. 없으면 카비어 기본 로고 */
      logoUrl: string | null;
      /** 같은 회사 다른 관리자와 달리 매입가/구전 확인·미확인 토글 권한이 있는 계정인지 */
      canConfirmBilling: boolean;
      // 매입팀 전용 화면(진단 목록 컬럼 축소) 여부 — users.isPurchaseTeam
      isPurchaseTeam: boolean;
      /**
       * carvior-back이 로그인할 때 발급한 JWT. 백엔드의 관리자 전용 엔드포인트
       * (AdminGuard)에 Authorization: Bearer로 보낸다 — NextAuth 세션 토큰은
       * 대시보드 시크릿으로 서명돼서 백엔드가 검증할 수 없다.
       *
       * 하드코딩 슈퍼관리자(admin 계정)로 로그인하면 백엔드를 거치지 않아서 null이다.
       * 그 경우 관리자 전용 엔드포인트를 쓸 수 없다 — DB 계정으로 로그인해야 한다.
       */
      apiToken: string | null;
    } & DefaultSession["user"];
  }
}
