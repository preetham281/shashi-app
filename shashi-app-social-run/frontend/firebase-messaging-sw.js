importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBrg-EddLLyPpjDUKRjGR21ROx-Vu-iexc',
  authDomain: 'shashi-5cf78.firebaseapp.com',
  projectId: 'shashi-5cf78',
  storageBucket: 'shashi-5cf78.firebasestorage.app',
  messagingSenderId: '726337100943',
  appId: '1:726337100943:web:222a0948ee654149e924fa',
  measurementId: 'G-C1DCZES2CT'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification && payload.notification.title
    ? payload.notification.title
    : 'shashi';
  const options = {
    body: payload.notification && payload.notification.body
      ? payload.notification.body
      : 'New message',
    icon: '/vercel.svg',
    badge: '/vercel.svg',
    data: payload.data || {}
  };

  self.registration.showNotification(title, options);
});
