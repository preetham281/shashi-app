const User = require('../models/User');

let firebaseApp = null;

function firebaseCredential(admin){
  if(process.env.FIREBASE_CONFIG){
    return admin.credential.cert(JSON.parse(process.env.FIREBASE_CONFIG));
  }

  return admin.credential.applicationDefault();
}

function getFirebaseAdmin(){
  try {
    const admin = require('firebase-admin');
    if(!firebaseApp && !admin.apps.length){
      firebaseApp = admin.initializeApp({
        credential: firebaseCredential(admin)
      });
    }
    return admin;
  } catch(error) {
    return null;
  }
}

async function sendPushToUser(username, payload){
  const user = await User.findOne({ username }).select('pushTokens');
  if(!user || user.pushTokens.length === 0){
    return { sent: 0, reason: 'No push tokens registered' };
  }

  const admin = getFirebaseAdmin();
  if(!admin){
    return { sent: 0, reason: 'firebase-admin is not installed or Firebase credentials are missing' };
  }

  const response = await admin.messaging().sendEachForMulticast({
    tokens: user.pushTokens,
    notification: {
      title: payload.title || 'shashi',
      body: payload.body || payload.text || 'New notification'
    },
    data: {
      type: payload.type || 'system',
      sender: payload.sender || ''
    }
  });

  return { sent: response.successCount, failed: response.failureCount };
}

module.exports = {
  sendPushToUser,
  getFirebaseAdmin
};
