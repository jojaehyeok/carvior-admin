import NextAuth from "next-auth";
import { OAuthUserConfig } from "next-auth/providers";
import CredentialsProvider, { CredentialsConfig } from "next-auth/providers/credentials";
import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";

/**
 * 슈퍼 관리자 하드코딩 계정 (발주사 계정은 전부 DB 계정으로 전환 완료 —
 * "관리자 계정 관리" 화면에서 발급, authorize()의 DB 폴백으로 로그인됨)
 * - role: 'SUPER_ADMIN' → 전체 의뢰 조회 가능 (carvior-inspection 포함)
 */
const ADMIN_ACCOUNTS: Record<string, { password: string; name: string; role: string; company: string | null }> = {
  admin: {
    password: process.env.SUPER_ADMIN_PW || "1234",
    name: "슈퍼 관리자",
    role: "SUPER_ADMIN",
    company: null,
  },
};

/**
 * 하드코딩 슈퍼관리자용 백엔드 토큰.
 *
 * carvior-back의 관리자 전용 엔드포인트(AdminGuard)는 "DB의 users 레코드 + role=admin"으로
 * 신원을 확인한다. 하드코딩 계정에는 그 레코드가 없어서 로그인 응답에 토큰이 없다.
 *
 * 그래서 비밀번호 없이 토큰만 받아오는 내부 경로(POST /users/issue-token, InternalKeyGuard)로
 * 대신 받아 온다. 어느 계정으로 받을지는 env로 정한다 — 코드에 이메일을 박으면
 * 계정을 바꿀 때 배포가 필요하다.
 *
 * ⚠ 둘 중 하나라도 env에 없으면 null이다. 그 상태에서 ADMIN_API_STRICT를 켜면
 * 하드코딩 계정으로 로그인한 사람은 진단 목록 같은 화면이 막힌다 —
 * 켜기 전에 DASHBOARD_SUPER_ADMIN_EMAIL / CARVIOR_INTERNAL_KEY를 먼저 채울 것.
 */
async function fetchSuperAdminToken(): Promise<string | null> {
  const email = process.env.DASHBOARD_SUPER_ADMIN_EMAIL;
  const internalKey = process.env.CARVIOR_INTERNAL_KEY;
  if (!email || !internalKey) return null;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_ENDPOINT}/users/issue-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-key": internalKey },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) return null;
    const body = await res.json();
    return typeof body?.token === "string" && body.token ? body.token : null;
  } catch {
    return null;
  }
}

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
        logoUrl: null,
        // 이 계정은 백엔드를 거치지 않으므로 로그인 응답에서 토큰을 받을 수 없다.
        // carvior-back의 내부 발급 경로로 따로 받아 온다(이 코드는 서버에서만 돌아서
        // 내부키를 들고 있어도 안전하다). 받을 수 없으면 null이고, 그 상태로는
        // 관리자 전용 엔드포인트를 쓸 수 없다 — DB 계정으로 로그인해야 한다.
        apiToken: await fetchSuperAdminToken(),
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
        logoUrl: user.logoUrl ?? null,
        canConfirmBilling: !!user.canConfirmBilling,
        isPurchaseTeam: !!user.isPurchaseTeam,
        // 백엔드가 로그인 응답에 같이 주는 JWT(users.service.ts의 issueToken).
        // 지금까지는 버리고 있었는데, carvior-back의 관리자 전용 엔드포인트(AdminGuard)가
        // 이걸로 신원을 확인한다. NextAuth 세션 토큰은 대시보드 자기 시크릿으로 서명돼서
        // 백엔드가 검증할 수 없으므로, 백엔드 토큰을 따로 들고 있어야 한다.
        apiToken: typeof user.token === 'string' ? user.token : null,
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
        token.logoUrl = (user as any).logoUrl ?? null;
        token.canConfirmBilling = !!(user as any).canConfirmBilling;
        token.isPurchaseTeam = !!(user as any).isPurchaseTeam;
        token.apiToken = (user as any).apiToken ?? null;
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
        logoUrl: (token.logoUrl as string | null) ?? null,
        canConfirmBilling: !!token.canConfirmBilling,
        isPurchaseTeam: !!token.isPurchaseTeam,
        apiToken: (token.apiToken as string | null) ?? null,
      };
      return session;
    },
  },
});
