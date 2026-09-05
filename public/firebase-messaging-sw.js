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

const messaging = firebase.messaging();

// 서버가 notification 필드를 담아 보내면 브라우저가 알림을 자동으로 띄우기 때문에
// 여기서 또 showNotification을 하면 알림이 두 번 뜬다 — 클릭 시 열 주소만 챙겨두고
// 표시는 브라우저에 맡긴다.
messaging.onBackgroundMessage((payload) => {
  console.log('[FCM-SW] 백그라운드 메시지 수신', payload);
});

// 알림 클릭 → 이미 열려 있는 대시보드 탭이 있으면 그 탭을 살리고, 없으면 새로 연다.
// (서버가 fcmOptions.link로 넘긴 주소를 우선 사용)
self.addEventListener('notificationclick', (event) => {
  const link =
    event.notification?.data?.FCM_MSG?.notification?.click_action ||
    event.notification?.data?.link ||
    'https://carvior.store/admin';
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/admin') && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(link);
    }),
  );
});
