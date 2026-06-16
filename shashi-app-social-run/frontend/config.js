const isLocalBrowser = ['127.0.0.1', 'localhost'].includes(window.location.hostname);
window.SHASHI_API_BASE_URL = isLocalBrowser
  ? `http://${window.location.hostname}:5000`
  : 'https://shashi-backend.onrender.com';
window.SHASHI_FIREBASE_VAPID_KEY = 'BFn-qvfJ0Bd1Tvvo7jkXC0qAvJdE6NVELrU7-Kumds9LMY2SugYEvOQ8fSq9XU9mnTp5U4-iIas-mtc5Kxo-v44';
