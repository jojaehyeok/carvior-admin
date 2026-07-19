import NextAuth from "next-auth";
import { OAuthUserConfig } from "next-auth/providers";
import CredentialsProvider, { CredentialsConfig } from "next-auth/providers/credentials";
import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";

/**
 * 발주사별 관리자 계정 목록
 * - role: 'SUPER_ADMIN' → 전체 의뢰 조회 가능 (carvior-inspection 포함)
 * - role: 'COMPANY_ADMIN' → company에 해당하는 의뢰만 조회 가능
 *
 * 운영 시: 비밀번호는 환경변수로 관리하세요 (예: ANYONE_MOTORS_PW)
 */
const ADMIN_ACCOUNTS: Record<string, { password: string; name: string; role: string; company: string | null }> = {
  admin: {
    password: process.env.SUPER_ADMIN_PW || "1234",
    name: "슈퍼 관리자",
    role: "SUPER_ADMIN",
    company: null,
  },
  anyone: {
    password: process.env.ANYONE_MOTORS_PW || "1234",
    name: "애니원 모터스",
    role: "COMPANY_ADMIN",
    company: "anyone-motors",
  },
  gwangmyeong: {
    password: process.env.GWANGMYEONG_MOTORS_PW || "1234",
    name: "광명모터스",
    role: "COMPANY_ADMIN",
    company: "gwangmyeong-motors",
  },
  // 새 발주사 추가 시 여기에 추가:
  // "new-company": {
  //   password: process.env.NEW_COMPANY_PW || "password",
  //   name: "새 발주사명",
  //   role: "COMPANY_ADMIN",
  //   company: "new-company",
  // },
};

const credentialsProviderOption: CredentialsConfig<{}> = {
  type: "credentials",
  id: "login-credentials",
  name: "login-credentials",
  credentials: {
    username: { label: "Username", type: "text" },
    password: { label: "Password", type: "password" },
  },
  async authorize(credentials: Record<string, unknown> | undefined) {
    if (!credentials) return null;

    const username = credentials.username as string;
    const password = credentials.password as string;
    const account = ADMIN_ACCOUNTS[username];

    if (account && account.password === password) {
      return {
        id: username,
        login: username,
        name: account.name,
        email: "",
        image: "",
        role: account.role,
        company: account.company,
      };
    }

    // 하드코딩 계정에 없으면 DB(관리자 계정 관리에서 생성한 users.role='admin')로 확인.
    // 이렇게 해야 "관리자 계정 관리" 화면에서 새 발주사 계정을 만들면 코드 배포 없이 바로 로그인된다.
    // 로그인 화면은 아이디만 입력받고, 실제 저장은 @carvior.store 붙은 이메일로 되어 있다.
    const email = username.includes("@") ? username : `${username}@carvior.store`;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_ENDPOINT}/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) return null;
      const user = await res.json();
      if (user?.role !== "admin") return null; // 관리자 권한이 아니면 대시보드 로그인 불가

      return {
        id: String(user.id),
        login: user.email,
        name: user.name,
        email: user.email,
        image: "",
        role: user.company ? "COMPANY_ADMIN" : "SUPER_ADMIN",
        company: user.company ?? null,
      };
    } catch {
      return null;
    }
  },
};

const googleProviderOption: OAuthUserConfig<{}> = {
  clientId: process.env.GOOGLE_CLIENT_ID || "",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  profile: (profile: any) => ({ ...profile, id: profile.sub, login: profile.email, image: profile.picture, role: "SUPER_ADMIN", company: null }),
};

const githubProviderOption: OAuthUserConfig<{}> = {
  clientId: process.env.GITHUB_CLIENT_ID || "",
  clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
  profile: (profile: any) => ({ ...profile, image: profile.avatar_url, role: "SUPER_ADMIN", company: null }),
};

export default NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  jwt:     { maxAge: 30 * 24 * 60 * 60 },
  cookies: {
    sessionToken: {
      name: 'admin.session-token',
      options: { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: process.env.NODE_ENV === 'production' },
    },
  },
  pages: {
    signIn: "/login",
    verifyRequest: "/login?verify=1",
    error: "/login",
  },
  providers: [
    CredentialsProvider(credentialsProviderOption),
    GoogleProvider(googleProviderOption),
    GithubProvider(githubProviderOption),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.login = (user as any).login;
        token.role = (user as any).role ?? "SUPER_ADMIN";
        token.company = (user as any).company ?? null;
      }
      return token;
    },
    session({ session, token }) {
      session.user = {
        ...session.user,
        id: token.id as string,
        login: token.login as string,
        role: token.role as string,
        company: (token.company as string | null) ?? null,
      };
      return session;
    },
  },
});
