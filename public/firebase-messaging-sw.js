/*
 * 브라우저 백그라운드 푸시용 서비스워커.
 *
 * 이 파일은 public/에 있어서 /admin/firebase-messaging-sw.js 로 서빙된다(next.config.js의 basePath).
 * 서비스워커는 "자기 경로 이하"만 제어할 수 있어서 스코프가 /admin/ 으로 잡히는데, 대시보드가
 * 전부 그 아래라 문제 없다.
 *
 * 주의: 서비스워커에서는 번들러도 환경변수도 못 쓴다. 그래서 firebase SDK를 CDN(compat)에서
 * 직접 불러오고 설정값도 여기에 그대로 박는다 — Firebase 웹 config는 원래 공개값이라
 * 노출돼도 무방하다(권한은 Firebase 보안 규칙과 서버 키로 통제됨).
 *
 * 브라우저를 완전히 종료하면 이 워커도 안 돌아서 알림이 오지 않는다. 최소화하거나 다른 탭을
 * 보고 있는 상태에서는 정상 수신된다(카카오톡 PC버전과 같은 제약).
 */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAAzp459dG9jIxY0bWCvXwb7LFKwlusL7w',
  authDomain: 'carvior-57443.firebaseapp.com',
  projectId: 'carvior-57443',
  storageBucket: 'carvior-57443.firebasestorage.app',
  messagingSenderId: '909758654495',
  appId: '1:909758654495:web:537555e37e234fffeb8d2a',
});

const API_BASE = 'https://carvior.store/api/v1';

firebase.messaging().onBackgroundMessage((payload) => {
  // 서버가 notification 필드를 담아 보내면 SDK가 알림을 자동으로 띄운다 —
  // 여기서 또 showNotification을 하면 두 번 뜨므로 로그만 남긴다.
  console.log('[FCM-SW] 백그라운드 메시지 수신', payload);
});

// 알림에 담긴 값 꺼내기. SDK가 띄운 알림은 payload 전체가 data.FCM_MSG 아래로 들어가고,
// 대시보드 탭이 직접 띄운 알림(webPush.ts)은 data에 그대로 들어 있어서 양쪽을 다 본다.
function readNotificationData(notification) {
  const data = notification?.data ?? {};
  const fcm = data.FCM_MSG ?? {};
  return {
    bookingId: data.bookingId ?? fcm.data?.bookingId,
    link:
      data.link ??
      fcm.data?.link ??
      fcm.notification?.click_action ??
      'https://carvior.store/admin',
  };
}

self.addEventListener('notificationclick', (event) => {
  const { bookingId, link } = readNotificationData(event.notification);
  event.notification.close();

  // [확인] 버튼 — 대시보드를 열지 않고 그 자리에서 "확인함" 처리한다.
  // 목록에서 매입가/구전 숫자를 눌러 빨간색을 파란색으로 바꾸는 것과 같은 동작이다.
  if (event.action === 'confirm') {
    if (!bookingId) return;
    event.waitUntil(
      fetch(`${API_BASE}/external/request/${bookingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchasePriceSeen: true, oldDealerFeeSeen: true }),
      }).catch((e) => console.error('[FCM-SW] 확인 처리 실패', e)),
    );
    return;
  }

  // 알림 본문 클릭 — 이미 열려 있는 대시보드 탭이 있으면 그 탭을 그 차량 검색 화면으로 보내고,
  // 없으면 새로 연다. (탭을 계속 새로 띄우면 관리자 화면이 금방 지저분해진다)
  //
  // client.navigate()는 서비스워커가 "제어 중인" 탭에서만 동작한다 — 워커를 등록하기 전에 이미
  // 열려 있던 탭은 제어 대상이 아니라서 조용히 실패하고, 결과적으로 탭이 앞으로 나오기만 하고
  // 검색 화면으로는 안 넘어갔다. 그래서 탭에 메시지를 보내 Next 라우터로 직접 이동시킨다.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/admin') && 'focus' in client) {
          client.postMessage({ type: 'CAVIOR_NAVIGATE', link });
          return client.focus();
        }
      }
      return self.clients.openWindow(link);
    }),
  );
});
