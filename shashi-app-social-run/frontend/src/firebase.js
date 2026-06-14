import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { getMessaging, getToken, onMessage } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging.js';

const firebaseConfig = {
  apiKey: "AIzaSyBrg-EddLLyPpjDUKRjGR21ROx-Vu-iexc",
  authDomain: "shashi-5cf78.firebaseapp.com",
  projectId: "shashi-5cf78",
  storageBucket: "shashi-5cf78.firebasestorage.app",
  messagingSenderId: "726337100943",
  appId: "1:726337100943:web:222a0948ee654149e924fa",
  measurementId: "G-C1DCZES2CT",
};

const firebaseReady = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
);

let firebaseApp = null;
let auth = null;
let db = null;
let firebaseMessaging = null;

if(firebaseReady){
  firebaseApp = initializeApp(firebaseConfig);
  auth = getAuth(firebaseApp);
  db = getFirestore(firebaseApp);
  firebaseMessaging = getMessaging(firebaseApp);
}

async function requestShashiPushToken(vapidKey = ''){
  if(!firebaseMessaging || !vapidKey || !('Notification' in window)){
    return '';
  }

  const permission = await Notification.requestPermission();
  if(permission !== 'granted'){
    return '';
  }

  return getToken(firebaseMessaging, { vapidKey });
}

function listenForShashiPushMessages(callback){
  if(!firebaseMessaging || typeof callback !== 'function'){
    return;
  }

  onMessage(firebaseMessaging, callback);
}

window.shashiFirebase = {
  app: firebaseApp,
  auth,
  db,
  messaging: firebaseMessaging,
  ready: firebaseReady,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  requestPushToken: requestShashiPushToken,
  onMessage: listenForShashiPushMessages
};

export {
  firebaseApp,
  auth,
  db,
  firebaseMessaging,
  firebaseReady,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  requestShashiPushToken,
  listenForShashiPushMessages
};
