/**
 * 관리자 대시보드 브라우저 푸시(FCM Web).
 *
 * 매입가·구전이 확정되면 백엔드가 같은 발주사 관리자들에게 알림을 쏜다(bookings.service.ts의
 * notifyPurchaseConfirmed 참고). 여기서는 브라우저 알림 권한을 받고, 발급된 FCM 토큰을
 * 로그인한 계정에 저장하는 것까지만 담당한다.
 *
 * 제약(사용자에게 미리 안내해야 하는 것):
 *  - HTTPS에서만 동작한다(운영은 carvior.store라 문제 없고, 로컬은 localhost 예외로 동작).
 *  - 브라우저를 완전히 종료하면 알림이 오지 않는다. 최소화·다른 탭은 정상 수신.
 *  - 토큰은 브라우저·기기마다 다르다. users.webPushToken이 단일 컬럼이라 마지막에 허용한
 *    곳 하나만 유지된다 — 회사 PC와 노트북에서 동시에 받아야 하면 별도 테이블이 필요하다.
 */
import { getApps, initializeApp } from 'firebase/app';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: 'AIzaSyAAzp459dG9jIxY0bWCvXwb7LFKwlusL7w',
  authDomain: 'carvior-57443.firebaseapp.com',
  projectId: 'carvior-57443',
  storageBucket: 'carvior-57443.firebasestorage.app',
  messagingSenderId: '909758654495',
  appId: '1:909758654495:web:537555e37e234fffeb8d2a',
};

// 웹 푸시 인증서(VAPID) 공개키 — 공개용 값이라 코드에 둬도 된다.
const VAPID_KEY =
  'BGZjhet37RmJu0M4rVfHqkUClt9M1wr3L7Ngq_bHKfutvQzGVWyjq3mbQ5GnQHWSTlR2lG0_MCR1bmKRirWJhLM';

// 서비스워커는 public/에 있고 basePath가 /admin이라 실제 주소는 /admin/firebase-messaging-sw.js다.
const SW_PATH = '/admin/firebase-messaging-sw.js';
const SW_SCOPE = '/admin/';

export type WebPushState = 'unsupported' | 'default' | 'granted' | 'denied';

export function getWebPushState(): WebPushState {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return 'unsupported';
  }
  return Notification.permission as WebPushState;
}

/**
 * 알림 권한을 요청하고 FCM 토큰을 받아 계정에 저장한다.
 * 이미 권한이 허용된 상태면 권한창 없이 토큰만 갱신하므로, 로그인할 때마다 불러도 된다
 * (브라우저 데이터 삭제 등으로 토큰이 바뀌면 그때 새 값으로 덮어써야 알림이 계속 온다).
 */
export async function enableWebPush(userId: string | number): Promise<
  { ok: true; token: string } | { ok: false; reason: WebPushState | 'error'; message?: string }
> {
  try {
    if (!(await isSupported())) return { ok: false, reason: 'unsupported' };

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: permission as WebPushState };

    const registration = await navigator.serviceWorker.register(SW_PATH, { scope: SW_SCOPE });
    // 워커가 활성화되기 전에 getToken을 부르면 실패할 수 있어 준비될 때까지 기다린다.
    await navigator.serviceWorker.ready;

    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    const token = await getToken(getMessaging(app), {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (!token) return { ok: false, reason: 'error', message: '토큰을 발급받지 못했습니다.' };

    const API = process.env.NEXT_PUBLIC_API_ENDPOINT || 'http://localhost:4000/api/v1';
    const res = await fetch(`${API}/users/${userId}/web-push-token`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webPushToken: token }),
    });
    if (!res.ok) return { ok: false, reason: 'error', message: '토큰 저장에 실패했습니다.' };

    return { ok: true, token };
  } catch (e) {
    return { ok: false, reason: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * 포그라운드 수신 처리 + "가짜 백그라운드" 보정.
 *
 * FCM 서비스워커는 clients.matchAll({ includeUncontrolled: true })로 **같은 도메인의 모든 탭**을
 * 훑어서, 그중 하나라도 화면에 떠 있으면 브라우저 알림을 그리지 않고 각 탭으로 메시지만 넘긴다.
 * 그래서 관리자가 대시보드를 뒤에 두고 같은 carvior.store의 다른 탭(카비오 홈페이지 등)을 보고
 * 있으면, SDK는 포그라운드로 판단하는데 정작 대시보드 화면은 안 보여서 아무것도 안 뜬다
 * (현장 신고: "알림은 오는데 백그라운드가 안 온다").
 *
 * 그래서 이 탭이 실제로 숨겨져 있으면 여기서 직접 알림을 띄운다. 브라우저가 그리는 진짜 알림이라
 * 다른 탭을 보고 있어도 뜨고, 클릭하면 서비스워커의 notificationclick이 대시보드를 살린다.
 */
export async function listenForegroundPush(onPush: (title: string, body: string) => void) {
  if (!(await isSupported())) return () => {};
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  return onMessage(getMessaging(app), async (payload) => {
    // 서버가 data-only로 보내므로 제목·본문도 data에서 읽는다(notification 필드는 없다).
    const title = (payload.data?.title as string) ?? payload.notification?.title ?? '알림';
    const body = (payload.data?.body as string) ?? payload.notification?.body ?? '';

    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      // 이 탭은 화면에 안 보이므로 브라우저 알림으로 띄운다.
      //
      // 예전엔 reg?.showNotification(...) 한 줄이었는데, getRegistration이 undefined를
      // 돌려주면 옵셔널 체이닝이라 아무 일도 안 일어나고 조용히 return 돼서 알림이 통째로
      // 사라졌다(에러도 안 남아 원인 찾기가 어려웠다). 등록을 여러 경로로 찾고, 그래도
      // 없으면 Notification 생성자로, 그것도 안 되면 화면 안 안내로 반드시 폴백한다.
      const reg =
        (await navigator.serviceWorker.getRegistration(SW_SCOPE).catch(() => undefined)) ??
        (await navigator.serviceWorker.getRegistration().catch(() => undefined)) ??
        (await navigator.serviceWorker.ready.catch(() => undefined));

      // 여러 탭이 동시에 이 코드를 타면 알림이 탭 수만큼 뜬다. localStorage는 같은 도메인의
      // 모든 탭이 공유하고 동기라 "먼저 기록한 탭만 그린다"는 잠금으로 쓸 수 있다.
      // 잠금은 실제로 띄울 수 있다고 확인한 뒤에 건다 — 못 띄우는 탭이 잠금만 가져가면
      // 띄울 수 있는 다른 탭까지 막혀서 아무것도 안 뜬다.
      const dedupeKey = `cavior-push-${payload.data?.bookingId ?? title}`;
      const takeLock = () => {
        try {
          const last = Number(window.localStorage.getItem(dedupeKey) ?? 0);
          if (Date.now() - last < 5000) return false; // 다른 탭이 방금 띄웠다
          window.localStorage.setItem(dedupeKey, String(Date.now()));
        } catch {
          // 시크릿 모드 등으로 못 쓰면 잠금 없이 진행한다(안 뜨는 것보단 낫다)
        }
        return true;
      };

      // 옵션을 얹을수록 배너가 안 뜨는 사고가 났다(tag는 조용히 교체, requireInteraction은
      // 그 자리를 계속 점유). 알림이 뜨는 게 먼저라 제목·본문·아이콘만 남긴다.
      // 여러 탭 중복은 아래 localStorage 잠금이 막으므로 tag가 없어도 된다.
      const options = {
        body,
        icon: (payload.data?.icon as string) || '/admin/android-chrome-192x192.png',
        data: {
          bookingId: payload.data?.bookingId,
          link: payload.data?.link ?? 'https://carvior.store/admin',
        },
      };

      if (reg) {
        if (!takeLock()) return;
        try {
          // 서비스워커로 띄우는 알림만 [확인] 같은 버튼을 달 수 있다.
          await reg.showNotification(title, options as NotificationOptions);
          return;
        } catch (e) {
          console.warn('[webPush] 서비스워커 알림 실패, 기본 알림으로 대체', e);
        }
      }

      try {
        if (!takeLock()) return;
        new Notification(title, options);
        return;
      } catch (e) {
        console.warn('[webPush] 브라우저 알림 실패, 화면 안 안내로 대체', e);
      }
    }

    onPush(title, body);
  });
}
