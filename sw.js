// 안드로이드 PWA 설치 요건을 충족하기 위한 기본 서비스 워커
self.addEventListener('install', (e) => {
    console.log('[Service Worker] 설치 완료');
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    console.log('[Service Worker] 활성화 완료');
});

self.addEventListener('fetch', (e) => {
    // 앱이 켜져 있을 때 인터넷 통신을 방해하지 않고 그대로 통과시킴
});