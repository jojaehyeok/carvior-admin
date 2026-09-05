import { Button, Tooltip, message } from "antd";
import { Bell, BellOff, BellRing } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import { enableWebPush, getWebPushState, listenForegroundPush, WebPushState } from "@/lib/webPush";

/**
 * 브라우저 알림 켜기 버튼.
 *
 * 기존 NewBookingAnnouncer는 탭이 열려 있을 때만 소리로 알려준다 — 이 버튼으로 권한을 켜두면
 * 대시보드를 안 보고 있어도(다른 탭·최소화) 매입 확정 알림이 뜬다.
 *
 * 알림 권한은 사용자가 직접 눌러야만 요청할 수 있다(브라우저가 자동 요청을 막는다). 그래서
 * 화면에 들어오자마자 권한창을 띄우지 않고, 이미 허용한 사람만 조용히 토큰을 갱신한다.
 */
export default function WebPushToggle() {
  const { data: session } = useSession();
  const router = useRouter();
  const userId = (session?.user as { id?: string | number } | undefined)?.id;

  // 서비스워커가 알림 클릭을 알려주면 그 차량이 검색된 화면으로 이동한다.
  // (basePath가 /admin이라 라우터에는 그 앞부분을 뺀 경로를 넘겨야 한다)
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.serviceWorker) return;
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type !== "CAVIOR_NAVIGATE" || !e.data.link) return;
      try {
        const url = new URL(e.data.link);
        router.push(url.pathname.replace(/^\/admin/, "") + url.search);
      } catch { /* 링크가 깨져 있으면 무시 */ }
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, [router]);
  const [state, setState] = useState<WebPushState>("unsupported");
  const [busy, setBusy] = useState(false);

  useEffect(() => setState(getWebPushState()), []);

  // 이미 허용해둔 브라우저는 토큰이 조용히 바뀌는 경우가 있어(브라우저 데이터 정리 등)
  // 로그인 상태로 대시보드가 뜰 때마다 최신 토큰으로 다시 저장해둔다 — 안 그러면 어느 날부터
  // 조용히 알림만 안 오게 된다.
  useEffect(() => {
    if (!userId || getWebPushState() !== "granted") return;
    enableWebPush(userId);
  }, [userId]);

  // 대시보드를 보고 있는 동안 온 알림은 브라우저가 안 띄우므로 화면 안에서 직접 보여준다.
  useEffect(() => {
    let unsub: (() => void) | undefined;
    listenForegroundPush((title, body) => {
      message.info({ content: `${title} — ${body}`, duration: 6 });
    }).then((fn) => { unsub = fn; });
    return () => unsub?.();
  }, []);

  const handleClick = useCallback(async () => {
    if (!userId) {
      message.warning("로그인 후 사용할 수 있습니다.");
      return;
    }
    setBusy(true);
    const res = await enableWebPush(userId);
    setBusy(false);
    setState(getWebPushState());

    if (res.ok) {
      message.success("브라우저 알림이 켜졌습니다. 매입가·구전이 확정되면 알려드립니다.");
      return;
    }
    if (res.reason === "denied") {
      message.error("브라우저에서 알림이 차단돼 있습니다. 주소창 왼쪽 자물쇠 → 알림 → 허용으로 바꿔주세요.");
      return;
    }
    if (res.reason === "unsupported") {
      message.error("이 브라우저에서는 알림을 지원하지 않습니다.");
      return;
    }
    message.error(res.message || "알림을 켜지 못했습니다.");
  }, [userId]);

  if (state === "unsupported") return null;

  const label =
    state === "granted" ? "알림 켜짐" : state === "denied" ? "알림 차단됨" : "알림 켜기";
  const Icon = state === "granted" ? BellRing : state === "denied" ? BellOff : Bell;

  return (
    <Tooltip
      title={
        state === "granted"
          ? "매입가·구전이 확정되면 이 브라우저로 알림이 옵니다. (브라우저를 완전히 종료하면 오지 않습니다)"
          : "켜두면 대시보드를 보고 있지 않아도 매입 확정 알림을 받습니다."
      }
    >
      <Button
        size="small"
        type={state === "granted" ? "primary" : "default"}
        danger={state === "denied"}
        loading={busy}
        icon={<Icon size={14} />}
        onClick={handleClick}
      >
        {label}
      </Button>
    </Tooltip>
  );
}
