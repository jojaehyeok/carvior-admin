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
 * 대시보드를 보고 있는 동안(포그라운드) 도착한 메시지는 브라우저가 알림을 자동으로 띄우지
 * 않는다 — 화면 안에서 직접 처리해야 해서 콜백으로 넘겨준다.
 */
export async function listenForegroundPush(onPush: (title: string, body: string) => void) {
  if (!(await isSupported())) return () => {};
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  return onMessage(getMessaging(app), (payload) => {
    onPush(payload.notification?.title ?? '알림', payload.notification?.body ?? '');
  });
}
