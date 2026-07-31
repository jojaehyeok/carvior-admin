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
    } & DefaultSession["user"];
  }
}
