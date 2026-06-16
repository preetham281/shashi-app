const isLocalBrowser = ['127.0.0.1', 'localhost'].includes(window.location.hostname);
window.SHASHI_API_BASE_URL = isLocalBrowser
  ? `http://${window.location.hostname}:5000`
  : 'https://shashi-backend.onrender.com';
window.SHASHI_FIREBASE_VAPID_KEY = window.SHASHI_FIREBASE_VAPID_KEY || '';
