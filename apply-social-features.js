const fs = require('fs');
const path = require('path');

const root = process.env.SHASHI_APP_ROOT || 'F:\\shashi app';
const backend = path.join(root, 'backend');
const frontend = path.join(root, 'frontend');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

function replaceBetween(text, startPattern, endPattern, replacement) {
  const start = text.search(startPattern);
  if (start === -1) return text;
  const rest = text.slice(start);
  const endMatch = rest.match(endPattern);
  if (!endMatch || typeof endMatch.index !== 'number') return text;
  const end = start + endMatch.index + endMatch[0].length;
  return text.slice(0, start) + replacement + text.slice(end);
}

function ensure(text, needle, insert) {
  return text.includes(needle) ? text : text + insert;
}

write(path.join(backend, 'models', 'Message.js'), `const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: String,
  receiver: String,
  text: {
    type: String,
    default: ''
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'video', 'file'],
    default: 'text'
  },
  mediaUrl: {
    type: String,
    default: ''
  },
  mediaType: {
    type: String,
    default: ''
  },
  fileName: {
    type: String,
    default: ''
  },
  emoji: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Message', messageSchema);
`);

write(path.join(backend, 'models', 'Reel.js'), `const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  username: String,
  text: String
}, {
  timestamps: true
});

const reelSchema = new mongoose.Schema({
  username: String,
  caption: {
    type: String,
    default: ''
  },
  videoUrl: String,
  videoType: {
    type: String,
    default: 'video/webm'
  },
  likes: {
    type: [String],
    default: []
  },
  comments: {
    type: [commentSchema],
    default: []
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Reel', reelSchema);
`);

write(path.join(backend, 'models', 'Notification.js'), `const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: String,
  sender: String,
  type: {
    type: String,
    enum: ['message', 'friend_request', 'reel_like', 'reel_comment'],
    default: 'message'
  },
  text: String,
  read: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Notification', notificationSchema);
`);

write(path.join(backend, 'controllers', 'reelController.js'), `const Reel = require('../models/Reel');
const Notification = require('../models/Notification');

exports.createReel = async (req, res) => {
  try {
    const { username, caption, videoUrl, videoType } = req.body;

    if(!username || !videoUrl){
      return res.status(400).json({ message: 'Username and video are required' });
    }

    const reel = await Reel.create({
      username,
      caption,
      videoUrl,
      videoType
    });

    res.status(201).json(reel);
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getReels = async (req, res) => {
  try {
    const reels = await Reel.find().sort({ createdAt: -1 });
    res.json(reels);
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.likeReel = async (req, res) => {
  try {
    const { username } = req.body;
    const reel = await Reel.findById(req.params.id);

    if(!reel){
      return res.status(404).json({ message: 'Reel not found' });
    }

    const alreadyLiked = reel.likes.includes(username);
    reel.likes = alreadyLiked
      ? reel.likes.filter((name) => name !== username)
      : [...reel.likes, username];

    await reel.save();

    if(!alreadyLiked && username !== reel.username){
      await Notification.create({
        recipient: reel.username,
        sender: username,
        type: 'reel_like',
        text: \`\${username} liked your reel\`
      });
    }

    res.json(reel);
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.commentReel = async (req, res) => {
  try {
    const { username, text } = req.body;
    const reel = await Reel.findById(req.params.id);

    if(!reel){
      return res.status(404).json({ message: 'Reel not found' });
    }

    reel.comments.push({ username, text });
    await reel.save();

    if(username !== reel.username){
      await Notification.create({
        recipient: reel.username,
        sender: username,
        type: 'reel_comment',
        text: \`\${username} commented on your reel\`
      });
    }

    res.json(reel);
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};
`);

write(path.join(backend, 'controllers', 'notificationController.js'), `const Notification = require('../models/Notification');

exports.createNotification = async (req, res) => {
  try {
    const notification = await Notification.create(req.body);
    res.status(201).json(notification);
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      recipient: req.params.username
    }).sort({ createdAt: -1 }).limit(50);

    res.json(notifications);
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.markNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.params.username },
      { read: true }
    );

    res.json({ message: 'Notifications marked as read' });
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};
`);

write(path.join(backend, 'routes', 'reelRoutes.js'), `const express = require('express');
const router = express.Router();
const {
  createReel,
  getReels,
  likeReel,
  commentReel
} = require('../controllers/reelController');

router.post('/', createReel);
router.get('/', getReels);
router.post('/:id/like', likeReel);
router.post('/:id/comment', commentReel);

module.exports = router;
`);

write(path.join(backend, 'routes', 'notificationRoutes.js'), `const express = require('express');
const router = express.Router();
const {
  createNotification,
  getNotifications,
  markNotificationsRead
} = require('../controllers/notificationController');

router.post('/', createNotification);
router.get('/:username', getNotifications);
router.put('/:username/read', markNotificationsRead);

module.exports = router;
`);

let server = read(path.join(backend, 'server.js'));
server = server.replace(
  "const messageRoutes = require('./routes/messageRoutes');",
  "const messageRoutes = require('./routes/messageRoutes');\nconst reelRoutes = require('./routes/reelRoutes');\nconst notificationRoutes = require('./routes/notificationRoutes');"
);
server = server.replace(
  "app.use('/api/messages', messageRoutes);",
  "app.use('/api/messages', messageRoutes);\napp.use('/api/reels', reelRoutes);\napp.use('/api/notifications', notificationRoutes);"
);
server = server.replace(
  "  socket.on('send_message', (data) => {\n    io.emit('receive_message', data);\n  });",
  `  socket.on('send_message', (data) => {
    io.emit('receive_message', data);
    io.emit('new_notification', {
      recipient: data.receiver,
      sender: data.sender,
      type: 'message',
      text: \`\${data.sender} sent you a message\`
    });
  });

  socket.on('send_notification', (data) => {
    io.emit('new_notification', data);
  });

  socket.on('reel_update', (data) => {
    io.emit('reel_updated', data);
  });`
);
write(path.join(backend, 'server.js'), server);

let html = read(path.join(frontend, 'index.html'));
html = html.replace(
  `<section id="homePage" class="page-section hidden">`,
  `<section id="homePage" class="page-section hidden reel-page">`
);
html = replaceBetween(
  html,
  /<section id="homePage" class="page-section hidden reel-page">/,
  /<\/section>/,
  `<section id="homePage" class="page-section hidden reel-page">
<div class="reel-layout">
<div class="card reel-upload-card">
<div class="section-title">
<h2>Upload Reel</h2>
<div class="status">Video</div>
</div>
<input id="reelVideoInput" type="file" accept="video/*" />
<textarea id="reelCaptionInput" placeholder="Write a caption..."></textarea>
<button class="primary-btn" onclick="uploadReel()">Upload reel</button>
<p id="reelMessage" class="form-message"></p>
</div>
<div id="reelsFeed" class="reels-feed"></div>
</div>
</section>`
);

html = html.replace(
  `<div class="header-right">`,
  `<div class="header-right">
<button type="button" class="notification-btn" onclick="toggleNotifications()" title="Notifications">
<i class="fa-solid fa-bell"></i>
<span id="notificationBadge" class="notification-badge hidden">0</span>
</button>
<div id="notificationPanel" class="notification-panel hidden">
<div class="section-title">
<h2>Notifications</h2>
<button class="ghost-btn small" onclick="markNotificationsRead()">Read</button>
</div>
<div id="notificationList" class="notification-list"></div>
</div>`
);

html = html.replace(
  `<div class="message-input">`,
  `<div class="emoji-picker hidden" id="emojiPicker">
<button onclick="insertEmoji('😀')">😀</button>
<button onclick="insertEmoji('😂')">😂</button>
<button onclick="insertEmoji('😍')">😍</button>
<button onclick="insertEmoji('🔥')">🔥</button>
<button onclick="insertEmoji('👍')">👍</button>
<button onclick="insertEmoji('❤️')">❤️</button>
</div>
<div class="message-input">
<input id="chatMediaInput" class="hidden" type="file" accept="image/*,video/*,.pdf,.doc,.docx,.txt,.zip" />
<button type="button" class="icon-btn" onclick="toggleEmojiPicker()" title="Emoji">
<i class="fa-regular fa-face-smile"></i>
</button>
<button type="button" class="icon-btn" onclick="chooseChatMedia()" title="Send file">
<i class="fa-solid fa-paperclip"></i>
</button>`
);
write(path.join(frontend, 'index.html'), html);

let app = read(path.join(frontend, 'app.js'));
app = ensure(app, '/* SHASHI_SOCIAL_FEATURES */', `

/* SHASHI_SOCIAL_FEATURES */
let notifications = [];

function renderRichMessage(message, type){
  const msg = document.createElement('div');
  msg.classList.add('message', type);

  if(message.messageType === 'image'){
    msg.classList.add('media-message');
    msg.innerHTML = \`<img src="\${message.mediaUrl}" alt="\${message.fileName || 'Image'}"><small>\${message.text || message.fileName || 'Image'}</small>\`;
  }else if(message.messageType === 'video'){
    msg.classList.add('media-message');
    msg.innerHTML = \`<video src="\${message.mediaUrl}" controls></video><small>\${message.text || message.fileName || 'Video'}</small>\`;
  }else if(message.messageType === 'file'){
    msg.classList.add('file-message');
    msg.innerHTML = \`<a href="\${message.mediaUrl}" download="\${message.fileName || 'file'}"><i class="fa-solid fa-file"></i> \${message.fileName || 'Download file'}</a>\`;
  }else{
    msg.innerText = message.text || message;
  }

  return msg;
}

createMessageElement = function(message, type){
  return renderRichMessage(message, type);
};

function toggleEmojiPicker(){
  byId('emojiPicker').classList.toggle('hidden');
}

function insertEmoji(emoji){
  const input = byId('chatInput');
  input.value += emoji;
  input.focus();
}

function chooseChatMedia(){
  if(!currentUser){
    alert('Please login or signup first.');
    return;
  }
  byId('chatMediaInput').click();
}

function sendMediaPayload(payload){
  if(!currentUser){
    alert('Please login or signup first.');
    return;
  }

  const chatMessage = {
    sender: currentUser.username,
    receiver: currentChatUser,
    ...payload
  };

  appendMessage(chatMessage, 'sent');

  fetch(\`\${API_BASE_URL}/api/messages\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(chatMessage)
  }).then((response)=>{
    if(!response.ok) throw new Error('Unable to save media');
    if(socket) socket.emit('send_message', chatMessage);
    setStatus('Backend online', true);
  }).catch((error)=>{
    console.error(error);
    setStatus('Backend offline', false);
    alert('Media was shown here, but could not be saved.');
  });
}

function handleChatMedia(event){
  const file = event.target.files[0];
  event.target.value = '';
  if(!file) return;

  if(file.size > 10 * 1024 * 1024){
    alert('Please choose a file below 10 MB.');
    return;
  }

  const reader = new FileReader();
  reader.onload = ()=>{
    const messageType = file.type.startsWith('image/')
      ? 'image'
      : file.type.startsWith('video/')
        ? 'video'
        : 'file';

    sendMediaPayload({
      text: '',
      messageType,
      mediaUrl: reader.result,
      mediaType: file.type || 'application/octet-stream',
      fileName: file.name
    });
  };
  reader.readAsDataURL(file);
}

async function uploadReel(){
  if(!currentUser){
    byId('reelMessage').innerText = 'Login first.';
    return;
  }

  const file = byId('reelVideoInput').files[0];
  const caption = byId('reelCaptionInput').value.trim();

  if(!file || !file.type.startsWith('video/')){
    byId('reelMessage').innerText = 'Choose a video file.';
    return;
  }

  if(file.size > 20 * 1024 * 1024){
    byId('reelMessage').innerText = 'Choose a video below 20 MB.';
    return;
  }

  const reader = new FileReader();
  reader.onload = async ()=>{
    try{
      const response = await fetch(\`\${API_BASE_URL}/api/reels\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser.username,
          caption,
          videoUrl: reader.result,
          videoType: file.type
        })
      });

      if(!response.ok) throw new Error('Unable to upload reel');
      byId('reelMessage').innerText = 'Reel uploaded.';
      byId('reelVideoInput').value = '';
      byId('reelCaptionInput').value = '';
      loadReels();
      if(socket) socket.emit('reel_update', { type: 'created' });
    }catch(error){
      byId('reelMessage').innerText = error.message;
    }
  };
  reader.readAsDataURL(file);
}

async function loadReels(){
  const feed = byId('reelsFeed');
  if(!feed) return;

  try{
    const response = await fetch(\`\${API_BASE_URL}/api/reels\`);
    if(!response.ok) throw new Error('Unable to load reels');
    const reels = await response.json();
    feed.innerHTML = reels.length ? '' : '<div class="empty-state compact">No reels yet.</div>';
    reels.forEach((reel)=>feed.appendChild(createReelCard(reel)));
  }catch(error){
    feed.innerHTML = '<div class="empty-state compact">Could not load reels.</div>';
  }
}

function createReelCard(reel){
  const card = document.createElement('article');
  card.className = 'reel-feed-card';
  const liked = currentUser && reel.likes.includes(currentUser.username);
  card.innerHTML = \`
    <video src="\${reel.videoUrl}" controls loop playsinline></video>
    <div class="reel-meta">
      <strong>@\${reel.username}</strong>
      <p>\${reel.caption || ''}</p>
      <div class="reel-stats">
        <button onclick="likeReel('\${reel._id}')"><i class="fa-solid fa-heart"></i> \${liked ? 'Liked' : 'Like'} (\${reel.likes.length})</button>
        <span>\${reel.comments.length} comments</span>
      </div>
      <div class="reel-comment-box">
        <input id="comment-\${reel._id}" placeholder="Add comment..." />
        <button onclick="commentReel('\${reel._id}')">Post</button>
      </div>
      <div class="reel-comments">
        \${reel.comments.slice(-3).map((comment)=>\`<small><b>@\${comment.username}</b> \${comment.text}</small>\`).join('')}
      </div>
    </div>
  \`;
  return card;
}

async function likeReel(id){
  if(!currentUser){
    alert('Login first.');
    return;
  }

  await fetch(\`\${API_BASE_URL}/api/reels/\${id}/like\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: currentUser.username })
  });
  loadReels();
  loadNotifications();
}

async function commentReel(id){
  if(!currentUser){
    alert('Login first.');
    return;
  }

  const input = byId(\`comment-\${id}\`);
  const text = input.value.trim();
  if(!text) return;

  await fetch(\`\${API_BASE_URL}/api/reels/\${id}/comment\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: currentUser.username, text })
  });
  input.value = '';
  loadReels();
  loadNotifications();
}

function toggleNotifications(){
  byId('notificationPanel').classList.toggle('hidden');
  loadNotifications();
}

async function loadNotifications(){
  if(!currentUser) return;
  const response = await fetch(\`\${API_BASE_URL}/api/notifications/\${currentUser.username}\`);
  if(!response.ok) return;
  notifications = await response.json();
  renderNotifications();
}

function renderNotifications(){
  const list = byId('notificationList');
  const badge = byId('notificationBadge');
  if(!list || !badge) return;
  const unread = notifications.filter((item)=>!item.read).length;
  badge.innerText = unread;
  badge.classList.toggle('hidden', unread === 0);
  list.innerHTML = notifications.length
    ? notifications.map((item)=>\`<div class="notification-item \${item.read ? '' : 'unread'}"><strong>\${item.type.replace('_', ' ')}</strong><small>\${item.text}</small></div>\`).join('')
    : '<div class="empty-state compact">No notifications yet.</div>';
}

async function markNotificationsRead(){
  if(!currentUser) return;
  await fetch(\`\${API_BASE_URL}/api/notifications/\${currentUser.username}/read\`, { method: 'PUT' });
  loadNotifications();
}

function sendFriendRequest(username){
  if(!currentUser) return;
  const notification = {
    recipient: username,
    sender: currentUser.username,
    type: 'friend_request',
    text: \`\${currentUser.username} sent you a friend request\`
  };
  fetch(\`\${API_BASE_URL}/api/notifications\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(notification)
  });
  if(socket) socket.emit('send_notification', notification);
}

document.addEventListener('DOMContentLoaded', ()=>{
  const mediaInput = byId('chatMediaInput');
  if(mediaInput) mediaInput.addEventListener('change', handleChatMedia);
  loadReels();
  loadNotifications();
  if(socket){
    socket.on('new_notification', (notification)=>{
      if(currentUser && notification.recipient === currentUser.username){
        notifications = [notification, ...notifications];
        renderNotifications();
        if(Notification && Notification.permission === 'granted'){
          new Notification('SHASHI', { body: notification.text });
        }
      }
    });
    socket.on('reel_updated', loadReels);
  }
  if('Notification' in window && Notification.permission === 'default'){
    Notification.requestPermission();
  }
});
`);
write(path.join(frontend, 'app.js'), app);

let css = read(path.join(frontend, 'style.css'));
css = ensure(css, '/* SHASHI_SOCIAL_STYLES */', `

/* SHASHI_SOCIAL_STYLES */
.icon-btn,.notification-btn{
  width:44px;
  height:44px;
  border:none;
  border-radius:10px;
  background:#eef2ff;
  color:var(--secondary);
  font-size:18px;
  cursor:pointer;
  position:relative;
}
.notification-badge{
  position:absolute;
  top:-6px;
  right:-6px;
  min-width:20px;
  height:20px;
  border-radius:999px;
  background:#ef4444;
  color:white;
  font-size:12px;
  display:flex;
  align-items:center;
  justify-content:center;
}
.notification-panel{
  position:absolute;
  top:70px;
  right:74px;
  width:min(360px,90vw);
  max-height:430px;
  overflow:auto;
  background:white;
  border-radius:14px;
  padding:16px;
  box-shadow:var(--shadow);
  z-index:1000;
}
.notification-list{
  display:grid;
  gap:10px;
}
.notification-item{
  display:grid;
  gap:4px;
  padding:12px;
  border:1px solid var(--line);
  border-radius:10px;
  background:#f8fafc;
}
.notification-item.unread{
  border-color:var(--primary);
  background:#ecfeff;
}
.notification-item small{
  color:var(--gray);
}
.ghost-btn.small{
  padding:8px 10px;
  font-size:12px;
}
.emoji-picker{
  display:flex;
  flex-wrap:wrap;
  gap:8px;
  margin-top:14px;
  padding:10px;
  border:1px solid var(--line);
  border-radius:12px;
  background:#f8fafc;
}
.emoji-picker button{
  border:none;
  background:white;
  border-radius:8px;
  padding:8px;
  cursor:pointer;
}
.media-message{
  display:grid;
  gap:8px;
  padding:8px;
}
.media-message img,.media-message video{
  width:min(340px,72vw);
  max-height:360px;
  border-radius:10px;
  object-fit:cover;
}
.file-message a{
  color:inherit;
  text-decoration:none;
  display:flex;
  gap:8px;
  align-items:center;
}
.reel-layout{
  display:grid;
  grid-template-columns:330px 1fr;
  gap:20px;
}
.reel-upload-card textarea{
  width:100%;
  min-height:90px;
  resize:vertical;
  border:1px solid #cbd5e1;
  border-radius:10px;
  padding:12px;
  margin:12px 0;
}
.reels-feed{
  height:calc(100vh - 160px);
  overflow-y:auto;
  scroll-snap-type:y mandatory;
  display:grid;
  gap:18px;
  padding-right:4px;
}
.reel-feed-card{
  min-height:calc(100vh - 180px);
  scroll-snap-align:start;
  background:white;
  border-radius:14px;
  overflow:hidden;
  box-shadow:var(--shadow);
  display:grid;
  grid-template-columns:minmax(260px,420px) 1fr;
}
.reel-feed-card video{
  width:100%;
  height:100%;
  min-height:520px;
  object-fit:cover;
  background:#020617;
}
.reel-meta{
  padding:20px;
  display:flex;
  flex-direction:column;
  gap:12px;
}
.reel-stats,.reel-comment-box{
  display:flex;
  gap:10px;
  align-items:center;
}
.reel-stats button,.reel-comment-box button{
  border:none;
  border-radius:10px;
  padding:10px 12px;
  background:#eef2ff;
  color:var(--secondary);
  font-weight:bold;
  cursor:pointer;
}
.reel-comment-box input{
  flex:1;
  border:1px solid #cbd5e1;
  border-radius:10px;
  padding:10px;
}
.reel-comments{
  display:grid;
  gap:6px;
  color:var(--gray);
}
@media(max-width:900px){
  .reel-layout,.reel-feed-card{
    grid-template-columns:1fr;
  }
  .reels-feed{
    height:auto;
  }
}
`);
write(path.join(frontend, 'style.css'), css);

console.log('Reels, chat media sharing, emoji support, and notifications were applied.');
