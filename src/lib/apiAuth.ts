import { getSession } from "next-auth/react";

/**
 * 백엔드 호출에 로그인 토큰을 자동으로 실어 보낸다.
 *
 * 왜 전역 패치냐 — 대시보드는 **39개 파일에서 생 `fetch()`**로 백엔드를 부른다.
 * 공통 클라이언트(`@/client/base`)를 쓰는 곳은 한 군데뿐이라, 헤더를 붙일 지점이 없다.
 * 호출마다 손으로 넣으면 한두 군데는 반드시 빠지고, 빠진 곳이 바로 뚫린 곳이 된다.
 * 그래서 입구를 하나로 만든다 — 앞으로 추가되는 호출도 자동으로 실린다.
 *
 * ⚠ 우리 API 주소로 나가는 요청에만 붙인다. 카카오 지도처럼 외부로 나가는 요청에
 * 토큰이 섞이면 그 자체가 유출이다. 주소 검사를 **토큰을 읽기 전에** 먼저 한다.
 *
 * getSession()도 내부에서 fetch를 쓰는데, 그 주소는 대시보드 자기 도메인이라 위 검사에
 * 걸러져서 무한 재귀가 생기지 않는다.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_ENDPOINT || "";

/** 세션을 매 요청마다 묻지 않는다 — getSession()은 그 자체로 왕복 한 번이다 */
let cached: { token: string | null; at: number } = { token: null, at: 0 };
const TTL_MS = 60_000;

async function apiToken(): Promise<string | null> {
  if (cached.token && Date.now() - cached.at < TTL_MS) return cached.token;
  try {
    const session = await getSession();
    cached = { token: session?.user?.apiToken ?? null, at: Date.now() };
  } catch {
    // 로그인 전이거나 세션이 끊긴 상태. 토큰 없이 보내고 서버 판단에 맡긴다.
  }
  return cached.token;
}

/** 로그아웃·계정 전환 때 남은 토큰을 쓰지 않게 */
export function clearApiTokenCache(): void {
  cached = { token: null, at: 0 };
}

let installed = false;

export function installApiAuth(): void {
  if (installed || typeof window === "undefined" || !API_BASE) return;
  installed = true;

  const original = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;

    // 우리 API가 아니면 손대지 않는다
    if (!url.startsWith(API_BASE)) return original(input, init);

    const token = await apiToken();
    if (!token) return original(input, init);

    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    // 이미 직접 넣어둔 곳이 있으면 그걸 존중한다
    if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);

    return original(input, { ...init, headers });
  };
}
