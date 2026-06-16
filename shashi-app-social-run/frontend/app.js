let firebaseAuth = null;
let firebaseDb = null;
let firebaseAuthTools = null;

const firebaseReadyPromise = import('./src/firebase.js')
  .then((firebase) => {
    firebaseAuth = firebase.auth;
    firebaseDb = firebase.db;
    firebaseAuthTools = {
      createUserWithEmailAndPassword: firebase.createUserWithEmailAndPassword,
      signInWithEmailAndPassword: firebase.signInWithEmailAndPassword,
      signOut: firebase.signOut
    };
    window.shashiFirebaseModule = firebase;
    console.log('Firebase Auth:', firebaseAuth);
    console.log('Firestore DB:', firebaseDb);
    return firebase;
  })
  .catch((error) => {
    console.warn('Firebase was not loaded:', error.message);
    return null;
  });
window.shashiFirebaseReadyPromise = firebaseReadyPromise;

const isAndroidApp =
  window.location.protocol === 'capacitor:' ||
  window.location.protocol === 'https:' && window.location.hostname === 'localhost';
if(new URLSearchParams(window.location.search).get('clearLogin') === '1'){
  ['shashiUser', 'shashiToken'].forEach((key) => localStorage.removeItem(key));
  window.history.replaceState({}, document.title, window.location.pathname);
}
if(new URLSearchParams(window.location.search).get('resetBackend') === '1'){
  localStorage.removeItem('shashiApiBase');
  window.history.replaceState({}, document.title, window.location.pathname);
}
function isWrongLocalBackendUrl(value){
  try{
    const url = new URL(value);
    const isLocal = ['127.0.0.1', 'localhost'].includes(url.hostname);
    return isLocal && url.port && url.port !== '5000';
  }catch(error){
    return false;
  }
}

function forceBackendPort(value){
  try{
    const url = new URL(value);
    if(url.port && url.port !== '5000'){
      url.port = '5000';
      return url.toString().replace(/\/$/, '');
    }
  }catch(error){
    return value;
  }

  return value;
}

const rawSavedApiBase = (localStorage.getItem('shashiApiBase') || '').trim();
if(isWrongLocalBackendUrl(rawSavedApiBase)){
  localStorage.removeItem('shashiApiBase');
}
const savedApiBase = isWrongLocalBackendUrl(rawSavedApiBase) ? '' : rawSavedApiBase;
const configuredApiBase = (window.SHASHI_API_BASE_URL || '').trim();
const localBrowserApiBase = ['127.0.0.1', 'localhost'].includes(window.location.hostname)
  ? `http://${window.location.hostname}:5000`
  : '';
const sameOriginApiBase = window.location.protocol === 'http:' || window.location.protocol === 'https:'
  ? window.location.origin
  : '';
const API_BASE_URL = (
  isAndroidApp
    ? savedApiBase || configuredApiBase || 'http://10.0.2.2:5000'
    : savedApiBase || configuredApiBase || localBrowserApiBase || sameOriginApiBase || 'http://127.0.0.1:5000'
).replace(/\/$/, '');
const socket = window.io ? io(API_BASE_URL, {
  transports: ['websocket', 'polling'],
  auth: { token: localStorage.getItem('shashiToken') || '' }
}) : null;
document.body.classList.add('main-chat-mode');

let appUsers = [];
let friendState = { friends: [], followers: [], following: [], friendRequests: [] };
let contactUsers = [];
let storyItems = [];
let advancedGroups = [];
let appGroups = [];
let appReels = [];
let appPosts = [];
let currentChatUser = 'Aarav';
let activeReelCollection = '';
let selectedStoryMusic = null;
let selectedTextStoryMusic = null;
let selectedTextStoryColor = '#ffffff';
let liveStoryState = { active:false, stream:null, recorder:null, chunks:[], startedAt:null, url:'' };
let storyCameraStream = null;
let callPermissionState = { audio: 'unknown', video: 'unknown' };
let mutedChats = JSON.parse(localStorage.getItem('shashiMutedChats') || '[]');
let userAccountReturnPage = 'profilePage';
let currentConversationMessages = [];
let selectedChatMessages = [];
let selectedChatText = '';
let viewedProfileUser = null;
let selectedChatMessage = null;
let selectedChatMessageElement = null;
let messageLongPressTimer = null;
let messageLongPressJustSelected = false;
let currentPageId = '';
let pageHistoryStack = [];
let swipeBackStart = null;
let pendingChatAttachments = [];
let sendingPendingAttachments = false;
const MESSAGE_LONG_PRESS_MS = 1500;
const chatThemeOptions = [
{ id:'plain-white', name:'Plain White', background:'#ffffff' },
{ id:'soft-blue', name:'Soft Blue', background:'linear-gradient(135deg,#ffffff 0%,#eff6ff 100%)' },
{ id:'soft-green', name:'Soft Green', background:'linear-gradient(135deg,#ffffff 0%,#ecfdf5 100%)' },
{ id:'soft-pink', name:'Soft Pink', background:'linear-gradient(135deg,#ffffff 0%,#fff1f2 100%)' },
{ id:'soft-yellow', name:'Soft Yellow', background:'linear-gradient(135deg,#ffffff 0%,#fffbeb 100%)' },
{ id:'soft-purple', name:'Soft Purple', background:'linear-gradient(135deg,#ffffff 0%,#f5f3ff 100%)' },
{ id:'soft-gray', name:'Soft Gray', background:'linear-gradient(135deg,#ffffff 0%,#f8fafc 100%)' },
{ id:'sky-blue', name:'Sky Blue', background:'linear-gradient(135deg,#e0f2fe 0%,#ffffff 100%)' },
{ id:'mint', name:'Mint', background:'linear-gradient(135deg,#dcfce7 0%,#ffffff 100%)' },
{ id:'cream', name:'Cream', background:'linear-gradient(135deg,#fef3c7 0%,#ffffff 100%)' },
{ id:'light-rose', name:'Light Rose', background:'linear-gradient(135deg,#ffe4e6 0%,#ffffff 100%)' },
{ id:'light-lavender', name:'Light Lavender', background:'linear-gradient(135deg,#ede9fe 0%,#ffffff 100%)' }
];
let currentUser = JSON.parse(localStorage.getItem('shashiUser') || 'null');
let authToken = localStorage.getItem('shashiToken') || '';
let authMode = 'login';
let authChallengeMode = '';
let authChallengeUserId = '';
const MAX_CHAT_FILE_BYTES = 100 * 1024 * 1024;
const MAX_CHAT_VIDEO_SECONDS = 15 * 60;

function byId(id){
return document.getElementById(id);
}

function saveApiBase(){
const input = byId('apiBaseInput');
const settingsInput = byId('settingsApiBaseInput');
const source = input && document.activeElement !== settingsInput ? input : settingsInput || input;
if(!source) return;

let nextUrl = forceBackendPort(source.value.trim().replace(/\/$/, ''));
if(!/^https?:\/\/.+/i.test(nextUrl)){
alert('Please enter a backend URL like http://192.168.1.10:5000');
return;
}

localStorage.setItem('shashiApiBase', nextUrl);
alert('Backend URL saved. The app will restart now.');
window.location.reload();
}

function saveApiBaseFromSettings(){
const settingsInput = byId('settingsApiBaseInput');
const menuInput = byId('apiBaseInput');
if(menuInput && settingsInput){
menuInput.value = settingsInput.value;
}
saveApiBase();
}

function syncSettingsInputs(){
const apiBaseInput = byId('apiBaseInput');
const settingsApiBaseInput = byId('settingsApiBaseInput');
if(apiBaseInput){
apiBaseInput.value = API_BASE_URL;
}
if(settingsApiBaseInput){
settingsApiBaseInput.value = API_BASE_URL;
}
}

function setStatus(text, isOnline){
const status = byId('apiStatus');
if(!status) return;
status.innerText = text;
status.classList.toggle('offline', !isOnline);
}

function fetchWithTimeout(url, options = {}, timeoutMs = 6000){
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), timeoutMs);
return fetch(url, {
...options,
signal: controller.signal
}).finally(() => clearTimeout(timeout));
}

function keepBackendWarm(){
if(document.visibilityState !== 'visible') return;
fetchWithTimeout(`${API_BASE_URL}/api/health`, { cache:'no-store' }, 4000).catch(() => {});
}

function authHeaders(){
return authToken
? { Authorization: `Bearer ${authToken}` }
: {};
}

function photoUrl(path){
if(!path) return '';
return path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
}

function isSelfChatUser(username = currentChatUser){
return Boolean(currentUser && username === currentUser.username);
}

function chatDisplayName(username){
return isSelfChatUser(username) ? 'You' : username;
}

function toggleProfileMenu(){
const menu = byId('profileMenu');
menu.style.display =
menu.style.display === 'block'
? 'none'
: 'block';
}

function toggleProfileLocalMenu(){
const menu = byId('profileLocalMenu');
if(menu) menu.classList.toggle('hidden');
}

function closeProfileLocalMenu(){
const menu = byId('profileLocalMenu');
if(menu) menu.classList.add('hidden');
}

function closeProfileAdvancedPanel(){
const panel = byId('profileAdvancedPanel');
if(panel) panel.classList.add('hidden');
}

function showProfileAdvancedPanel(title, content){
closeProfileLocalMenu();
const panel = byId('profileAdvancedPanel');
if(!panel) return;
panel.innerHTML = `
<div class="section-title">
<h2>${escapeHtml(title)}</h2>
<button type="button" class="ghost-btn small" onclick="closeProfileAdvancedPanel()">Close</button>
</div>
${content}
`;
panel.classList.remove('hidden');
}

function openProfileEditFromMenu(){
closeProfileLocalMenu();
closeProfileAdvancedPanel();
showPage('profileEditPage');
setTimeout(() => {
const input = byId('profileUsername');
if(input) input.focus();
}, 150);
}

async function shareMyProfile(){
closeProfileLocalMenu();
closeProfileAdvancedPanel();
if(!currentUser){
alert('Login first to share your profile.');
return;
}
const text = `shashi profile: @${currentUser.username}`;
try{
if(navigator.share){
await navigator.share({ title:'shashi Profile', text });
return;
}
if(navigator.clipboard){
await navigator.clipboard.writeText(text);
alert('Profile copied.');
return;
}
alert(text);
}catch(error){}
}

function openProfileNotificationsFromMenu(){
closeProfileLocalMenu();
closeProfileAdvancedPanel();
showPage('settingsPage');
setTimeout(() => {
const card = byId('settingsNotificationsCard');
if(card) card.scrollIntoView({ behavior:'smooth', block:'start' });
refreshSettingsStatus();
}, 120);
}

function openProfileAccountPrivacy(){
closeProfileLocalMenu();
closeProfileAdvancedPanel();
showPage('settingsPage');
setTimeout(() => {
applyAccountSecurityView();
const card = byId('settingsPrivacyCard');
if(card) card.scrollIntoView({ behavior:'smooth', block:'start' });
}, 120);
}

function openProfileTimeManagement(){
closeProfileLocalMenu();
closeProfileAdvancedPanel();
const saved = JSON.parse(localStorage.getItem('shashiTimeManagement') || '{}');
const dailyLimit = prompt('Daily app time limit in minutes:', saved.dailyLimit || '60');
if(dailyLimit === null) return;
const quietHours = prompt('Quiet hours, example 10 PM - 7 AM:', saved.quietHours || '10 PM - 7 AM');
if(quietHours === null) return;
localStorage.setItem('shashiTimeManagement', JSON.stringify({
dailyLimit: dailyLimit.trim(),
quietHours: quietHours.trim(),
updatedAt: new Date().toISOString()
}));
alert('Time management saved.');
}

function openProfileCloseFriends(){
closeProfileLocalMenu();
closeProfileAdvancedPanel();
const saved = JSON.parse(localStorage.getItem('shashiCloseFriends') || '[]');
const value = prompt('Close friends usernames, comma separated:', saved.join(', '));
if(value === null) return;
const closeFriends = value
.split(',')
.map((name) => name.trim().replace('@', ''))
.filter(Boolean);
localStorage.setItem('shashiCloseFriends', JSON.stringify([...new Set(closeFriends)]));
alert(`${closeFriends.length} close friends saved.`);
}

async function openProfileBlockedUsers(){
closeProfileLocalMenu();
closeProfileAdvancedPanel();
if(!currentUser){
alert('Login first to manage blocked users.');
return;
}
const blocked = currentUser.blockedUsers || [];
const value = prompt(
`Blocked users: ${blocked.length ? blocked.map((name) => `@${name}`).join(', ') : 'none'}\n\nType username to block. Type -username to unblock.`
);
if(!value) return;
const isUnblock = value.trim().startsWith('-');
const blockedUser = value.trim().replace('-', '').replace('@', '');
if(!blockedUser) return;
try{
const user = await advancedFetch(isUnblock ? '/unblock' : '/block', {
method:'POST',
headers:{ 'Content-Type':'application/json' },
body:JSON.stringify({ blockedUser })
});
currentUser = user;
localStorage.setItem('shashiUser', JSON.stringify(currentUser));
alert(isUnblock ? `@${blockedUser} unblocked.` : `@${blockedUser} blocked.`);
}catch(error){
alert(error.message);
}
}

function openProfileQrPanel(){
if(!currentUser){
alert('Login first to view your profile QR.');
return;
}
const text = `shashi profile: @${currentUser.username}`;
showProfileAdvancedPanel('Profile QR', `
<strong>@${escapeHtml(currentUser.username)}</strong>
<div class="profile-qr">${profileQrPattern(currentUser.username)}</div>
<small>${escapeHtml(text)}</small>
<div class="settings-actions">
<button type="button" class="primary-btn" onclick="shareMyProfile()">Share profile</button>
</div>
`);
}

function openProfileSecurityCheck(){
if(!currentUser){
alert('Login first to check security.');
return;
}
const privacy = currentUser.privacy || {};
const blockedCount = (currentUser.blockedUsers || []).length;
showProfileAdvancedPanel('Security check', `
<div class="settings-pill-grid">
<div class="settings-pill"><strong>${currentUser.twoFactorEnabled ? 'On' : 'Off'}</strong><small>Two-factor</small></div>
<div class="settings-pill"><strong>${escapeHtml(privacy.profileVisibility || 'everyone')}</strong><small>Profile visibility</small></div>
<div class="settings-pill"><strong>${privacy.showOnlineStatus === false ? 'Hidden' : 'Visible'}</strong><small>Online status</small></div>
<div class="settings-pill"><strong>${blockedCount}</strong><small>Blocked users</small></div>
</div>
<div class="settings-actions">
<button type="button" class="primary-btn" onclick="openProfileAccountPrivacy()">Open privacy</button>
<button type="button" class="ghost-btn" onclick="openProfileBlockedUsers()">Blocked</button>
</div>
`);
}

function openProfileBackupFromMenu(){
closeProfileLocalMenu();
closeProfileAdvancedPanel();
showPage('settingsPage');
setTimeout(() => {
const card = byId('settingsBackupCard');
if(card) card.scrollIntoView({ behavior:'smooth', block:'start' });
}, 120);
}

function exportProfileDataFromMenu(){
closeProfileLocalMenu();
closeProfileAdvancedPanel();
exportLocalData();
}

function openProfileLoginActivity(){
closeProfileLocalMenu();
closeProfileAdvancedPanel();
showPage('settingsPage');
setTimeout(() => {
const card = byId('settingsMonitoringCard');
if(card) card.scrollIntoView({ behavior:'smooth', block:'start' });
loadMonitoring();
}, 120);
}

function updateProfileTopbar(){
const title = byId('profileTopUsername');
if(title){
title.innerText = currentUser ? currentUser.username : 'Profile';
}
}

function updateFriendsPostsTopbar(){
const title = byId('friendsPostsUsername');
const profileUsernameInput = byId('profileUsername');
const usernameText = currentUser && currentUser.username
  ? currentUser.username
  : profileUsernameInput && profileUsernameInput.value.trim()
    ? profileUsernameInput.value.trim()
    : 'Username';
if(title){
title.innerText = usernameText;
}
const photo = byId('friendsPostsProfilePhoto');
const fallback = byId('friendsPostsProfileFallback');
if(photo && fallback){
  const hasPhoto = Boolean(currentUser && currentUser.profilePhoto);
  photo.classList.toggle('hidden', !hasPhoto);
  fallback.classList.toggle('hidden', hasPhoto);
  if(hasPhoto){
    photo.src = photoUrl(currentUser.profilePhoto);
  }else{
    photo.removeAttribute('src');
    fallback.innerText = usernameText && usernameText !== 'Username' ? usernameText.charAt(0).toUpperCase() : 'S';
  }
}
}

function toggleFriendsPostCreateMenu(forceClose = false){
const menu = byId('friendsPostCreateMenu');
if(!menu) return;
const postsMenu = byId('friendsPostsMenu');
const notifications = byId('friendsPostsNotificationsPanel');
if(postsMenu) postsMenu.classList.add('hidden');
if(notifications) notifications.classList.add('hidden');
if(forceClose === true){
menu.classList.add('hidden');
return;
}
menu.classList.toggle('hidden');
}

function toggleFriendsPostsMenu(forceClose = false){
const menu = byId('friendsPostsMenu');
if(!menu) return;
const createMenu = byId('friendsPostCreateMenu');
const notifications = byId('friendsPostsNotificationsPanel');
if(createMenu) createMenu.classList.add('hidden');
if(notifications) notifications.classList.add('hidden');
if(forceClose === true){
menu.classList.add('hidden');
return;
}
menu.classList.toggle('hidden');
}

function toggleFriendsPostsNotifications(forceClose = false){
const panel = byId('friendsPostsNotificationsPanel');
if(!panel) return;
const createMenu = byId('friendsPostCreateMenu');
const postsMenu = byId('friendsPostsMenu');
if(createMenu) createMenu.classList.add('hidden');
if(postsMenu) postsMenu.classList.add('hidden');
if(forceClose === true){
panel.classList.add('hidden');
return;
}
panel.classList.toggle('hidden');
if(!panel.classList.contains('hidden')){
loadNotifications();
}
}

function openPostsGalleryUpload(){
toggleFriendsPostCreateMenu(true);
showPage('postsPage');
const input = byId('postMediaInput');
if(input){
input.value = '';
input.click();
}
}

function openReelsGalleryUpload(){
toggleFriendsPostCreateMenu(true);
showPage('homePage');
const panel = byId('reelUploadPanel');
if(panel) panel.classList.remove('hidden');
const input = byId('reelVideoInput');
if(input){
input.value = '';
input.click();
}
}

function openFriendsLiveCamera(){
toggleFriendsPostCreateMenu(true);
showPage('statusPage');
openStoryCamera();
}

function openNewGroupFromMenu(){
showPage('friendsPage');
const menu = byId('profileMenu');
if(menu) menu.style.display = 'none';
setTimeout(() => {
const input = byId('friendGroupNameInput');
if(input){
input.scrollIntoView({ behavior: 'smooth', block: 'center' });
input.focus();
}
}, 50);
}

function closeHiddenMenuOutside(e, menuId, triggerSelector){
const menu = byId(menuId);
if(
menu &&
!menu.classList.contains('hidden') &&
!e.target.closest(`#${menuId}`) &&
!e.target.closest(triggerSelector)
){
menu.classList.add('hidden');
}
}

window.addEventListener('click', function(e){
const menu = byId('profileMenu');
if(
menu &&
menu.style.display === 'block' &&
!e.target.closest('.profile-menu-btn') &&
!e.target.closest('#profileMenu')
){
menu.style.display = 'none';
}

closeHiddenMenuOutside(e, 'profileLocalMenu', '.profile-local-menu-btn');
closeHiddenMenuOutside(e, 'chatPersonMenu', '.chat-person-menu-btn');
closeHiddenMenuOutside(e, 'chatMoreMenu', '.chat-more-menu-btn');
closeHiddenMenuOutside(e, 'userProfileMenu', '.user-profile-menu-btn');
closeHiddenMenuOutside(e, 'callsMenu', '.calls-menu-btn');
closeHiddenMenuOutside(e, 'reelsMenu', '.reels-menu-btn');
closeHiddenMenuOutside(e, 'storyMenu', '.story-menu-btn');
closeHiddenMenuOutside(e, 'attachmentMenu', '.attachment-menu-btn');
closeHiddenMenuOutside(e, 'friendsPostCreateMenu', '.friends-posts-create-btn');
closeHiddenMenuOutside(e, 'friendsPostsMenu', '.friends-posts-menu-btn');
closeHiddenMenuOutside(e, 'friendsPostsNotificationsPanel', '.friends-posts-notification-btn');
});

async function openCamera(){
try{
await navigator.mediaDevices.getUserMedia({ video:true });
alert('Camera opened');
}catch(error){
alert('Camera permission denied');
}
}

function callHistory(){
try{
return JSON.parse(localStorage.getItem('shashiCallHistory') || '[]');
}catch(error){
return [];
}
}

function saveCallHistory(items){
localStorage.setItem('shashiCallHistory', JSON.stringify(items.slice(0, 80)));
}

function addCallHistory(name, type){
const items = callHistory();
items.unshift({
name,
type,
time: new Date().toISOString()
});
saveCallHistory(items);
renderCallHistory();
}

function toggleCallsMenu(){
const menu = byId('callsMenu');
if(menu) menu.classList.toggle('hidden');
}

function clearCallLog(){
saveCallHistory([]);
const menu = byId('callsMenu');
if(menu) menu.classList.add('hidden');
renderCallHistory();
}

function scheduleCall(){
const menu = byId('callsMenu');
if(menu) menu.classList.add('hidden');
alert('Call schedule saved for the next version. Choose a friend from Calls to start now.');
}

function renderCallsPage(){
renderCallsFriends();
renderCallHistory();
}

function filterCallsPage(value = ''){
const text = value.trim().toLowerCase();
renderCallsFriends(text);
renderCallHistory(text);
}

function renderCallsFriends(filterText = ''){
const list = byId('callsFriendsList');
if(!list) return;

if(!currentUser){
list.innerHTML = '<div class="empty-state compact">Login to call friends.</div>';
return;
}

const names = friendState.friends.length
? friendState.friends
: appUsers.map((user) => user.username);
const filteredNames = filterText
? names.filter((name) => String(name || '').toLowerCase().includes(filterText))
: names;

if(filteredNames.length === 0){
list.innerHTML = '<div class="empty-state compact">No friends yet.</div>';
return;
}

list.innerHTML = filteredNames.map((name) => {
const user = userByName(name);
const avatar = user.profilePhoto
? `<img src="${photoUrl(user.profilePhoto)}" alt="${escapeHtml(name)}">`
: `<span>${escapeHtml(name.charAt(0).toUpperCase())}</span>`;
return `
<div class="call-row friend-call-row">
<div class="user-avatar">${avatar}</div>
<div><strong>@${escapeHtml(name)}</strong><small>${user.online ? 'Online' : 'Tap phone or video'}</small></div>
<div class="call-actions">
<button onclick="startFriendCall('${escapeHtml(name)}','voice')" title="Voice call"><i class="fa-solid fa-phone"></i></button>
<button onclick="startFriendCall('${escapeHtml(name)}','video')" title="Video call"><i class="fa-solid fa-video"></i></button>
</div>
</div>
`;
}).join('');
}

function renderCallHistory(filterText = ''){
const list = byId('callHistoryList');
if(!list) return;
const items = callHistory().filter((item) => {
if(!filterText) return true;
return String(item.name || '').toLowerCase().includes(filterText) || String(item.type || '').toLowerCase().includes(filterText);
});
list.innerHTML = items.length
? items.map((item) => `
<div class="call-row">
<div class="call-icon"><i class="fa-solid fa-${item.type === 'video' ? 'video' : 'phone'}"></i></div>
<div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.type)} call · ${new Date(item.time).toLocaleString()}</small></div>
</div>
`).join('')
: '<div class="empty-state compact">No call history yet.</div>';
}

async function startFriendCall(name, type){
try{
await requestMediaPermissions(type === 'video');
addCallHistory(name, type);
alert(`${type === 'video' ? 'Video' : 'Voice'} call ready with ${name}.`);
}catch(error){
alert(`${type === 'video' ? 'Camera/mic' : 'Microphone'} permission denied.`);
}
}

async function requestMediaPermissions(includeVideo){
if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
throw new Error('Calling permissions are not supported on this browser.');
}

const stream = await navigator.mediaDevices.getUserMedia({
audio:true,
video:Boolean(includeVideo)
});

callPermissionState.audio = 'granted';
callPermissionState.video = includeVideo ? 'granted' : callPermissionState.video;
stream.getTracks().forEach((track) => track.stop());
updateChatCallPermissionView();
return true;
}

async function requestChatCallPermissions(){
try{
await requestMediaPermissions(true);
}catch(error){
callPermissionState.audio = 'denied';
callPermissionState.video = 'denied';
updateChatCallPermissionView();
alert('Please allow microphone and camera permissions for calls.');
}
}

function updateChatCallPermissionView(){
const panel = byId('chatPersonMenu');
const text = byId('chatCallPermissionText');
if(!panel || !text) return;

const isPersonChat = !String(currentChatUser).startsWith('group:');

if(!isPersonChat){
panel.classList.remove('ready');
const group = currentGroup();
text.innerText = group
? `${group.members.length} members - group actions ready.`
: 'Group actions ready.';
return;
}

const audioReady = callPermissionState.audio === 'granted';
const videoReady = callPermissionState.video === 'granted';
panel.classList.toggle('ready', audioReady && videoReady);
text.innerText = audioReady && videoReady
? 'Microphone and camera are ready for calls.'
: audioReady
? 'Microphone is ready. Allow camera for video calls.'
: 'Tap to allow mic/camera for calls.';
}

const chatGameOptions = [
{ id:'chess', name:'Chess', icon:'fa-chess-board' },
{ id:'carrom', name:'Carrom', icon:'fa-bullseye' },
{ id:'ticTacToe', name:'Tic Tac Toe', icon:'fa-table-cells-large' },
{ id:'checkers', name:'Checkers', icon:'fa-chess' },
{ id:'ludo', name:'Ludo', icon:'fa-dice' }
];
let activeChatGameState = null;
let selectedChatGameCell = null;

function chatGamePlayers(){
if(!currentUser || !currentUser.username || String(currentChatUser).startsWith('group:')) return [];
return [currentUser.username, currentChatUser].sort((a, b) => a.localeCompare(b));
}

function chatGameRoomId(gameId){
return `shashi:${gameId}:${chatGamePlayers().join(':')}`;
}

function chatGameStorageKey(roomId){
return `shashiChatGame:${roomId}`;
}

function hiddenChatGameBackgroundKey(){
return 'shashiHiddenChatGameBackgroundRooms';
}

function hiddenChatGameBackgroundRooms(){
try{
return JSON.parse(localStorage.getItem(hiddenChatGameBackgroundKey()) || '[]');
}catch(error){
return [];
}
}

function setChatGameBackgroundHidden(roomId, hidden){
if(!roomId) return;
const rooms = new Set(hiddenChatGameBackgroundRooms());
if(hidden){
rooms.add(roomId);
}else{
rooms.delete(roomId);
}
localStorage.setItem(hiddenChatGameBackgroundKey(), JSON.stringify([...rooms]));
}

function isChatGameBackgroundHidden(roomId){
return hiddenChatGameBackgroundRooms().includes(roomId);
}

function chatGameTitle(gameId){
const game = chatGameOptions.find((item) => item.id === gameId);
return game ? game.name : 'Game';
}

function chatFriendOnline(){
if(isSelfChatUser()) return true;
const friend = appUsers.find((user) => user.username === currentChatUser);
return Boolean(friend && friend.online);
}

function currentGamePlayerIndex(state = activeChatGameState){
return state && currentUser ? state.players.indexOf(currentUser.username) : -1;
}

function otherGamePlayer(state = activeChatGameState){
if(!state || !currentUser) return '';
return state.players.find((name) => name !== currentUser.username) || currentChatUser;
}

function isMyGameTurn(state = activeChatGameState){
return Boolean(state && currentUser && state.turn === currentUser.username && !state.winner);
}

function readChatGameState(roomId){
try{
return JSON.parse(localStorage.getItem(chatGameStorageKey(roomId)) || 'null');
}catch(error){
return null;
}
}

function saveChatGameState(state){
if(!state || !state.roomId) return;
localStorage.setItem(chatGameStorageKey(state.roomId), JSON.stringify(state));
}

function gameStateTimestamp(state){
const time = new Date(state && state.updatedAt || 0).getTime();
return Number.isFinite(time) ? time : 0;
}

function refreshActiveChatGameFromStorage(){
if(!activeChatGameState || !activeChatGameState.roomId) return false;
const saved = readChatGameState(activeChatGameState.roomId);
if(!saved || gameStateTimestamp(saved) <= gameStateTimestamp(activeChatGameState)) return false;
activeChatGameState = saved;
selectedChatGameCell = null;
renderChatGame();
return true;
}

window.addEventListener('storage', (event) => {
if(!activeChatGameState || event.key !== chatGameStorageKey(activeChatGameState.roomId)) return;
refreshActiveChatGameFromStorage();
});

function latestSavedChatGame(){
if(!currentUser || !currentChatUser || String(currentChatUser).startsWith('group:')) return null;
return chatGameOptions
.map((game) => readChatGameState(chatGameRoomId(game.id)))
.filter(Boolean)
.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))[0] || null;
}

function hideChatGamePanel(){
const panel = byId('chatGamePanel');
if(panel) panel.classList.add('hidden');
}

function clearChatGameView(){
hideChatGamePanel();
activeChatGameState = null;
selectedChatGameCell = null;
renderChatGameAmbient();
}

function resumeChatGameForCurrentChat(openPanel = false){
selectedChatGameCell = null;
if(!currentUser || !currentChatUser || String(currentChatUser).startsWith('group:')){
clearChatGameView();
return;
}
const friendName = byId('chatGameFriendName');
if(friendName) friendName.innerText = chatDisplayName(currentChatUser);
renderChatGameChoices();
activeChatGameState = latestSavedChatGame();
if(openPanel && activeChatGameState){
setChatGameBackgroundHidden(activeChatGameState.roomId, false);
}
if(openPanel){
const panel = byId('chatGamePanel');
if(panel) panel.classList.remove('hidden');
}else{
hideChatGamePanel();
}
renderChatGame();
renderChatGameAmbient();
}

function ambientGameBoard(state){
const renderer = {
ticTacToe:renderTicTacToeGame,
chess:renderChessGame,
checkers:renderCheckersGame,
ludo:renderLudoGame,
carrom:renderCarromGame
}[state.gameId] || renderTicTacToeGame;
return renderer(state);
}

function renderChatGameAmbient(){
const ambient = byId('chatGameAmbient');
if(!ambient) return;
const conversationBody = ambient.closest('.conversation-body');
if(!activeChatGameState || String(currentChatUser).startsWith('group:') || isChatGameBackgroundHidden(activeChatGameState.roomId)){
ambient.classList.add('hidden');
ambient.innerHTML = '';
if(conversationBody) conversationBody.classList.remove('game-play-active');
return;
}
if(conversationBody) conversationBody.classList.add('game-play-active');
ambient.classList.remove('hidden');
ambient.innerHTML = `
<div class="chat-game-ambient-card">
<div class="chat-game-ambient-title">
<strong>${escapeHtml(chatGameTitle(activeChatGameState.gameId))}</strong>
<small>${escapeHtml(gameTurnText(activeChatGameState))}</small>
</div>
<div class="chat-game-ambient-play">${ambientGameBoard(activeChatGameState)}</div>
</div>
`;
}

function pointInsideRect(event, rect){
return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
}

function clickAmbientElement(event, selector, callback){
const ambient = byId('chatGameAmbient');
if(!ambient) return false;
const elements = Array.from(ambient.querySelectorAll(selector));
const index = elements.findIndex((element) => pointInsideRect(event, element.getBoundingClientRect()));
if(index < 0) return false;
event.preventDefault();
callback(index, elements[index]);
return true;
}

function handleAmbientGameClick(event){
const ambient = byId('chatGameAmbient');
if(!ambient || ambient.classList.contains('hidden') || !activeChatGameState) return;
const body = ambient.closest('.conversation-body');
if(!body || !body.contains(event.target)) return;
const target = event.target && event.target.closest ? event.target : null;
if(!target) return;
if(target.closest('.message-bubble, .message-input, .emoji-picker, .chat-person-header, .chat-game-panel, .chat-person-menu, .chat-more-menu, a, button, input, textarea, select, video, audio')) return;
if(selectedChatMessages.length && target.closest('.message')) return;

const board = ambient.querySelector('.board-grid');
if(board && pointInsideRect(event, board.getBoundingClientRect())){
const rect = board.getBoundingClientRect();
const columns = board.classList.contains('tic-tac-toe') ? 3 : 8;
const col = Math.max(0, Math.min(columns - 1, Math.floor((event.clientX - rect.left) / (rect.width / columns))));
const row = Math.max(0, Math.min(columns - 1, Math.floor((event.clientY - rect.top) / (rect.height / columns))));
event.preventDefault();
handleChatGameCell(row * columns + col);
return;
}

if(activeChatGameState.gameId === 'ludo'){
if(clickAmbientElement(event, '.ludo-track .chat-game-action-btn', () => rollLudoDice())) return;
clickAmbientElement(event, '.ludo-token-row .ludo-token', (index) => handleChatGameCell(index));
return;
}

if(activeChatGameState.gameId === 'carrom'){
clickAmbientElement(event, '.chat-game-ambient-play .chat-game-action-btn', () => strikeCarrom());
}
}

document.addEventListener('click', handleAmbientGameClick);

function initialChessBoard(){
return [
'bR','bN','bB','bQ','bK','bB','bN','bR',
'bP','bP','bP','bP','bP','bP','bP','bP',
'','','','','','','','',
'','','','','','','','',
'','','','','','','','',
'','','','','','','','',
'wP','wP','wP','wP','wP','wP','wP','wP',
'wR','wN','wB','wQ','wK','wB','wN','wR'
];
}

function initialCheckersBoard(){
return Array.from({ length:64 }, (_, index) => {
const row = Math.floor(index / 8);
const col = index % 8;
if((row + col) % 2 === 0) return '';
if(row < 3) return 'b';
if(row > 4) return 'r';
return '';
});
}

function initialCarromCoins(){
return [
{ type:'queen', x:50, y:50 },
...Array.from({ length:9 }, (_, index) => ({ type:'white', x:50 + Math.cos(index * 0.7) * 16, y:50 + Math.sin(index * 0.7) * 16 })),
...Array.from({ length:9 }, (_, index) => ({ type:'black', x:50 + Math.cos(index * 0.7 + 0.35) * 28, y:50 + Math.sin(index * 0.7 + 0.35) * 28 }))
];
}

function defaultChatGameState(gameId){
const players = chatGamePlayers();
const base = {
roomId:chatGameRoomId(gameId),
gameId,
players,
turn:players[0],
winner:'',
updatedAt:new Date().toISOString()
};

if(gameId === 'ticTacToe'){
return { ...base, board:Array(9).fill(''), marks:{ [players[0]]:'X', [players[1]]:'O' } };
}
if(gameId === 'chess'){
return { ...base, board:initialChessBoard() };
}
if(gameId === 'checkers'){
return { ...base, board:initialCheckersBoard() };
}
if(gameId === 'ludo'){
return { ...base, positions:{ [players[0]]:[-1,-1,-1,-1], [players[1]]:[-1,-1,-1,-1] }, dice:0, rolled:false };
}
return { ...base, coins:initialCarromCoins(), scores:{ [players[0]]:0, [players[1]]:0 }, lastStrike:'' };
}

function openChatGames(){
if(!currentUser){
alert('Login first.');
return;
}
if(String(currentChatUser).startsWith('group:')){
alert('Group games will be added later.');
return;
}
resumeChatGameForCurrentChat(true);
}

function closeChatGames(){
hideChatGamePanel();
selectedChatGameCell = null;
renderChatGameAmbient();
}

function cancelChatGameBackground(){
const saved = activeChatGameState || latestSavedChatGame();
if(saved && saved.roomId){
setChatGameBackgroundHidden(saved.roomId, true);
}
hideChatGamePanel();
selectedChatGameCell = null;
renderChatGameAmbient();
}

function renderChatGameChoices(){
const choices = byId('chatGameChoices');
if(!choices) return;
choices.innerHTML = chatGameOptions.map((game) => `
<button type="button" onclick="startChatGame('${game.id}')">
<i class="fa-solid ${game.icon}"></i>
<span>${escapeHtml(game.name)}</span>
</button>
`).join('');
}

function startChatGame(gameId, reset = false){
if(!currentUser || String(currentChatUser).startsWith('group:')) return;
const roomId = chatGameRoomId(gameId);
activeChatGameState = reset ? null : readChatGameState(roomId);
if(!activeChatGameState){
activeChatGameState = defaultChatGameState(gameId);
}
setChatGameBackgroundHidden(roomId, false);
selectedChatGameCell = null;
saveChatGameState(activeChatGameState);
renderChatGame();
renderChatGameAmbient();
broadcastChatGameState('start');
}

function broadcastChatGameState(type = 'state'){
if(!socket || !activeChatGameState || !currentUser) return;
activeChatGameState.updatedAt = new Date().toISOString();
saveChatGameState(activeChatGameState);
socket.emit('game_action', {
type,
sender:currentUser.username,
roomId:activeChatGameState.roomId,
gameId:activeChatGameState.gameId,
players:activeChatGameState.players,
state:activeChatGameState
});
}

function applyChatGameSocket(data){
if(!data || !data.state || !currentUser) return;
if(!Array.isArray(data.players) || !data.players.includes(currentUser.username)) return;
saveChatGameState(data.state);
if(!data.players.includes(currentChatUser)) return;
activeChatGameState = data.state;
selectedChatGameCell = null;
const panel = byId('chatGamePanel');
if(panel && !panel.classList.contains('hidden')){
renderChatGame();
}else{
renderChatGameAmbient();
}
}

function gameTurnText(state){
if(state.winner === 'draw') return 'Game drawn';
if(state.winner) return `${state.winner} won`;
return state.turn === (currentUser && currentUser.username) ? 'Your turn' : `${state.turn}'s turn`;
}

function renderChatGame(){
const board = byId('chatGameBoard');
const status = byId('chatGameStatus');
if(!board || !status) return;
status.innerText = chatFriendOnline()
? 'Online game room ready. Moves sync live.'
: 'Friend is offline now. Moves sync when both are online.';

if(!activeChatGameState){
board.innerHTML = '<div class="empty-state compact">Choose a game to start with this friend.</div>';
renderChatGameAmbient();
return;
}

const state = activeChatGameState;
const gameTitle = chatGameTitle(state.gameId);
const resetButton = `<button type="button" class="chat-game-action-btn" onclick="startChatGame('${state.gameId}', true)">New</button>`;
const header = `<div class="game-header-line"><strong>${escapeHtml(gameTitle)}</strong><span class="chat-game-turn">${escapeHtml(gameTurnText(state))}</span>${resetButton}</div>`;
const renderer = {
ticTacToe:renderTicTacToeGame,
chess:renderChessGame,
checkers:renderCheckersGame,
ludo:renderLudoGame,
carrom:renderCarromGame
}[state.gameId] || renderTicTacToeGame;
board.innerHTML = `<div class="game-shell">${header}${renderer(state)}</div>`;
renderChatGameAmbient();
}

function finishGameIfNeeded(state, winner){
if(winner){
state.winner = winner;
}else{
state.turn = otherGamePlayer(state);
}
state.updatedAt = new Date().toISOString();
saveChatGameState(state);
renderChatGame();
broadcastChatGameState('move');
}

function handleChatGameCell(index){
if(!activeChatGameState) return;
refreshActiveChatGameFromStorage();
if(!isMyGameTurn()){
selectedChatGameCell = null;
renderChatGame();
return;
}
if(activeChatGameState.gameId === 'ticTacToe') return playTicTacToe(index);
if(activeChatGameState.gameId === 'chess') return playChess(index);
if(activeChatGameState.gameId === 'checkers') return playCheckers(index);
if(activeChatGameState.gameId === 'ludo') return playLudoToken(index);
}

function renderTicTacToeGame(state){
return `<div class="board-grid tic-tac-toe">${state.board.map((cell, index) => `
<button type="button" class="game-cell" onclick="handleChatGameCell(${index})">${escapeHtml(cell)}</button>
`).join('')}</div>`;
}

function playTicTacToe(index){
const state = activeChatGameState;
if(state.board[index] || state.winner) return;
state.board[index] = state.marks[currentUser.username];
const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const hasWin = wins.some((line) => line.every((cell) => state.board[cell] === state.board[index]));
finishGameIfNeeded(state, hasWin ? currentUser.username : state.board.every(Boolean) ? 'draw' : '');
}

const chessIcons = { wK:'♔', wQ:'♕', wR:'♖', wB:'♗', wN:'♘', wP:'♙', bK:'♚', bQ:'♛', bR:'♜', bB:'♝', bN:'♞', bP:'♟' };

function renderChessGame(state){
const moveHints = selectedChatGameCell !== null && state.board[selectedChatGameCell]
? legalChessDestinations(state.board, selectedChatGameCell, state.board[selectedChatGameCell])
: [];
return `<div class="board-grid board-8">${state.board.map((piece, index) => {
const row = Math.floor(index / 8);
const col = index % 8;
const selected = selectedChatGameCell === index ? ' selected' : '';
const moveOption = moveHints.includes(index) ? ' move-option' : '';
return `<button type="button" class="game-cell ${(row + col) % 2 ? 'dark' : 'light'}${selected}${moveOption}" onclick="handleChatGameCell(${index})"><span class="chess-piece">${piece ? chessIcons[piece] : ''}</span></button>`;
}).join('')}</div>`;
}

function clearPath(board, from, to){
const fromRow = Math.floor(from / 8);
const fromCol = from % 8;
const toRow = Math.floor(to / 8);
const toCol = to % 8;
const rowStep = Math.sign(toRow - fromRow);
const colStep = Math.sign(toCol - fromCol);
let row = fromRow + rowStep;
let col = fromCol + colStep;
while(row !== toRow || col !== toCol){
if(board[row * 8 + col]) return false;
row += rowStep;
col += colStep;
}
return true;
}

function legalChessMove(board, from, to, piece){
const fromRow = Math.floor(from / 8);
const fromCol = from % 8;
const toRow = Math.floor(to / 8);
const toCol = to % 8;
const dr = toRow - fromRow;
const dc = toCol - fromCol;
const absR = Math.abs(dr);
const absC = Math.abs(dc);
const type = piece[1];
const color = piece[0];
const target = board[to];
if(target && target[0] === color) return false;
if(type === 'P'){
const dir = color === 'w' ? -1 : 1;
const startRow = color === 'w' ? 6 : 1;
if(dc === 0 && !target && dr === dir) return true;
if(dc === 0 && !target && fromRow === startRow && dr === dir * 2 && !board[(fromRow + dir) * 8 + fromCol]) return true;
return absC === 1 && dr === dir && Boolean(target);
}
if(type === 'N') return absR * absC === 2;
if(type === 'B') return absR === absC && clearPath(board, from, to);
if(type === 'R') return (absR === 0 || absC === 0) && clearPath(board, from, to);
if(type === 'Q') return (absR === absC || absR === 0 || absC === 0) && clearPath(board, from, to);
return absR <= 1 && absC <= 1;
}

function legalChessDestinations(board, from, piece){
return board
.map((_, to) => to)
.filter((to) => to !== from && legalChessMove(board, from, to, piece));
}

function playChess(index){
const state = activeChatGameState;
const board = state.board;
const myColor = currentGamePlayerIndex(state) === 0 ? 'w' : 'b';
const piece = board[index];
if(selectedChatGameCell === null){
if(piece && piece[0] === myColor){
selectedChatGameCell = index;
renderChatGame();
}
return;
}
const from = selectedChatGameCell;
const moving = board[from];
if(index === from){
selectedChatGameCell = null;
renderChatGame();
return;
}
if(piece && piece[0] === myColor){
selectedChatGameCell = index;
renderChatGame();
return;
}
if(moving && legalChessMove(board, from, index, moving)){
const captured = board[index];
board[index] = moving;
board[from] = '';
selectedChatGameCell = null;
finishGameIfNeeded(state, captured && captured[1] === 'K' ? currentUser.username : '');
}
}

function renderCheckersGame(state){
return `<div class="board-grid board-8">${state.board.map((piece, index) => {
const row = Math.floor(index / 8);
const col = index % 8;
const selected = selectedChatGameCell === index ? ' selected' : '';
const color = piece && piece.toLowerCase() === 'r' ? 'red' : 'black';
const crown = piece && piece === piece.toUpperCase() ? '★' : '';
return `<button type="button" class="game-cell ${(row + col) % 2 ? 'dark' : 'light'}${selected}" onclick="handleChatGameCell(${index})">${piece ? `<span class="game-piece ${color}">${crown}</span>` : ''}</button>`;
}).join('')}</div>`;
}

function playCheckers(index){
const state = activeChatGameState;
const board = state.board;
const mine = currentGamePlayerIndex(state) === 0 ? 'r' : 'b';
const piece = board[index];
if(selectedChatGameCell === null){
if(piece && piece.toLowerCase() === mine){
selectedChatGameCell = index;
renderChatGame();
}
return;
}
const from = selectedChatGameCell;
const moving = board[from];
if(index === from){
selectedChatGameCell = null;
renderChatGame();
return;
}
if(piece && piece.toLowerCase() === mine){
selectedChatGameCell = index;
renderChatGame();
return;
}
if(piece || !moving) return;
const fromRow = Math.floor(from / 8);
const fromCol = from % 8;
const toRow = Math.floor(index / 8);
const toCol = index % 8;
const dr = toRow - fromRow;
const dc = toCol - fromCol;
const king = moving === moving.toUpperCase();
const dir = mine === 'r' ? -1 : 1;
const canMoveDir = king || dr === dir || dr === dir * 2;
if(!canMoveDir) return;
if(Math.abs(dr) === 1 && Math.abs(dc) === 1){
board[index] = promoteChecker(moving, toRow);
board[from] = '';
selectedChatGameCell = null;
return finishGameIfNeeded(state, checkersWinner(state));
}
if(Math.abs(dr) === 2 && Math.abs(dc) === 2){
const middle = (fromRow + dr / 2) * 8 + fromCol + dc / 2;
if(board[middle] && board[middle].toLowerCase() !== mine){
board[index] = promoteChecker(moving, toRow);
board[from] = '';
board[middle] = '';
selectedChatGameCell = null;
finishGameIfNeeded(state, checkersWinner(state));
}
}
}

function promoteChecker(piece, row){
if(piece === 'r' && row === 0) return 'R';
if(piece === 'b' && row === 7) return 'B';
return piece;
}

function checkersWinner(state){
const red = state.board.some((piece) => piece && piece.toLowerCase() === 'r');
const black = state.board.some((piece) => piece && piece.toLowerCase() === 'b');
if(!red) return state.players[1];
if(!black) return state.players[0];
return '';
}

function renderLudoGame(state){
const me = currentUser ? currentUser.username : '';
const currentDice = state.dice ? `Dice: ${state.dice}` : 'Roll first';
return `
<div class="ludo-track">
<button type="button" class="chat-game-action-btn" onclick="rollLudoDice()" ${isMyGameTurn(state) && !state.rolled ? '' : 'disabled'}>${escapeHtml(currentDice)}</button>
<div class="ludo-token-row">${state.positions[me].map((pos, index) => `<button type="button" class="ludo-token" onclick="handleChatGameCell(${index})">Token ${index + 1}<br>${pos < 0 ? 'Home' : pos >= 20 ? 'Done' : `Step ${pos}`}</button>`).join('')}</div>
<small class="chat-game-turn">Finish all four tokens at step 20.</small>
</div>`;
}

function rollLudoDice(){
const state = activeChatGameState;
if(!state || !isMyGameTurn(state) || state.rolled) return;
state.dice = Math.floor(Math.random() * 6) + 1;
state.rolled = true;
saveChatGameState(state);
renderChatGame();
broadcastChatGameState('move');
}

function playLudoToken(index){
const state = activeChatGameState;
if(!state.rolled) return;
const positions = state.positions[currentUser.username];
if(!positions || positions[index] >= 20) return;
positions[index] = positions[index] < 0 ? state.dice : Math.min(20, positions[index] + state.dice);
state.dice = 0;
state.rolled = false;
const winner = positions.every((pos) => pos >= 20) ? currentUser.username : '';
finishGameIfNeeded(state, winner);
}

function renderCarromGame(state){
const coins = state.coins.map((coin, index) => `<span class="carrom-coin ${coin.type}" style="left:${coin.x}%;top:${coin.y}%"></span>`).join('');
return `
<div class="carrom-board"><span class="carrom-pocket"></span><span class="carrom-pocket"></span><span class="carrom-pocket"></span><span class="carrom-pocket"></span>${coins}</div>
<button type="button" class="chat-game-action-btn" onclick="strikeCarrom()" ${isMyGameTurn(state) ? '' : 'disabled'}>Strike</button>
<div class="carrom-score-row">${state.players.map((name) => `<span>${escapeHtml(name)}: ${state.scores[name] || 0}</span>`).join('')}</div>
<small class="chat-game-turn">${escapeHtml(state.lastStrike || 'Pocket coins to score. Queen gives 3 points.')}</small>`;
}

function strikeCarrom(){
const state = activeChatGameState;
if(!state || !isMyGameTurn(state) || state.winner) return;
const roll = Math.random();
let message = `${currentUser.username} missed.`;
if(state.coins.length && roll > 0.28){
const queenIndex = state.coins.findIndex((coin) => coin.type === 'queen');
const coinIndex = roll > 0.82 && queenIndex >= 0 ? queenIndex : Math.floor(Math.random() * state.coins.length);
const coin = state.coins.splice(coinIndex, 1)[0];
const points = coin.type === 'queen' ? 3 : 1;
state.scores[currentUser.username] = (state.scores[currentUser.username] || 0) + points;
message = `${currentUser.username} pocketed ${coin.type} (+${points}).`;
}
state.lastStrike = message;
const winner = state.coins.length === 0
? state.players.reduce((best, name) => (state.scores[name] || 0) > (state.scores[best] || 0) ? name : best, state.players[0])
: '';
if(winner) state.winner = winner;
if(!winner && message.includes('missed')) state.turn = otherGamePlayer(state);
state.updatedAt = new Date().toISOString();
saveChatGameState(state);
renderChatGame();
broadcastChatGameState('move');
}

function startCurrentChatCall(type){
if(String(currentChatUser).startsWith('group:')){
alert('Group calling will be added later.');
return;
}
startFriendCall(currentChatUser, type);
}

function openCurrentChatAccount(){
if(String(currentChatUser).startsWith('group:')){
openCurrentGroupInfo();
return;
}
if(isSelfChatUser()){
showPage('profilePage');
return;
}
openUserAccount(currentChatUser, 'conversationPage');
}

function currentGroupId(){
return String(currentChatUser).startsWith('group:')
? String(currentChatUser).replace('group:', '')
: '';
}

function currentGroup(){
const id = currentGroupId();
return id ? appGroups.find((group) => String(group._id) === id) : null;
}

function currentUserIsGroupAdmin(group = currentGroup()){
return Boolean(currentUser && group && Array.isArray(group.admins) && group.admins.includes(currentUser.username));
}

function openCurrentGroupInfo(){
const group = currentGroup();
if(!group){
alert('Group details not loaded yet.');
return;
}
const admins = (group.admins || []).map((name) => `@${name}`).join(', ') || 'No admins';
const members = (group.members || []).map((name) => `@${name}`).join(', ') || 'No members';
alert(`Group: ${group.name}\nMembers: ${group.members.length}\nAdmins: ${admins}\n\n${members}`);
}

function toggleChatPersonMenu(){
const menu = byId('chatPersonMenu');
const moreMenu = byId('chatMoreMenu');
if(menu){
menu.classList.toggle('hidden');
if(moreMenu) moreMenu.classList.add('hidden');
updateChatMenuState();
}
}

function toggleChatMoreMenu(){
const menu = byId('chatMoreMenu');
const personMenu = byId('chatPersonMenu');
if(personMenu) personMenu.classList.add('hidden');
if(menu) menu.classList.toggle('hidden');
}

function updateChatMenuState(){
const label = byId('chatMuteLabel');
const groupLabel = byId('chatGroupMuteLabel');
const isPersonChat = !String(currentChatUser).startsWith('group:');
const moreMenu = byId('chatMoreMenu');
document.querySelectorAll('.person-chat-option').forEach((item) => {
item.classList.toggle('hidden', !isPersonChat);
});
document.querySelectorAll('.group-chat-option').forEach((item) => {
item.classList.toggle('hidden', isPersonChat);
});
document.querySelectorAll('.person-more-option').forEach((item) => {
item.classList.toggle('hidden', !isPersonChat);
});
document.querySelectorAll('.group-more-option').forEach((item) => {
item.classList.toggle('hidden', isPersonChat);
});
if(label){
label.innerText = mutedChats.includes(currentChatUser) ? 'Unmute notification' : 'Mute notification';
}
if(groupLabel){
groupLabel.innerText = mutedChats.includes(currentChatUser) ? 'Unmute notification' : 'Mute notification';
}
updateChatCallPermissionView();
}

function searchInCurrentChat(){
const term = prompt('Search in this chat');
if(!term) return;
const messages = Array.from(byId('chatMessages').querySelectorAll('.message'));
const found = messages.find((item) => item.innerText.toLowerCase().includes(term.toLowerCase()));
if(found){
found.scrollIntoView({ behavior:'smooth', block:'center' });
found.classList.add('message-highlight');
setTimeout(() => found.classList.remove('message-highlight'), 1600);
}else{
alert('No matching message found.');
}
}

function toggleCurrentChatMute(){
mutedChats = mutedChats.includes(currentChatUser)
? mutedChats.filter((name) => name !== currentChatUser)
: [...mutedChats, currentChatUser];
localStorage.setItem('shashiMutedChats', JSON.stringify(mutedChats));
updateChatMenuState();
}

function openDisappearingMessages(){
alert('Disappearing messages setting is ready for the next backend timer step.');
}

function openChatThemes(){
const menu = byId('chatPersonMenu');
if(menu) menu.classList.add('hidden');
renderChatThemePage();
showPage('chatThemePage');
}

function chatThemeKey(chatName = currentChatUser){
return `shashiChatTheme:${chatName}`;
}

function readChatTheme(chatName = currentChatUser){
try{
return JSON.parse(localStorage.getItem(chatThemeKey(chatName)) || '{}');
}catch(error){
return {};
}
}

function renderChatThemePage(){
const grid = byId('chatThemeGrid');
if(!grid) return;
const saved = readChatTheme();
grid.innerHTML = chatThemeOptions.map((theme) => `
<button type="button" class="chat-theme-tile ${saved.id === theme.id ? 'active' : ''}" onclick="saveChatTheme('${theme.id}')">
<span class="chat-theme-preview" style="background:${theme.background}"></span>
<strong>${escapeHtml(theme.name)}</strong>
</button>
`).join('') + `
<button type="button" class="chat-theme-tile ${!saved.id ? 'active' : ''}" onclick="removeChatTheme()">
<span class="chat-theme-preview remove-theme-preview"><i class="fa-solid fa-ban"></i></span>
<strong>Remove theme</strong>
</button>
<button type="button" class="chat-theme-tile ${saved.id === 'gallery' ? 'active' : ''}" onclick="chooseChatGalleryTheme()">
<span class="chat-theme-preview gallery-preview"><i class="fa-solid fa-image"></i></span>
<strong>Choose from gallery</strong>
</button>
`;
}

function saveChatTheme(themeId){
const theme = chatThemeOptions.find((item) => item.id === themeId);
if(!theme) return;
localStorage.setItem(chatThemeKey(), JSON.stringify({ id:theme.id, background:theme.background }));
applyChatTheme();
renderChatThemePage();
}

function chooseChatGalleryTheme(){
const input = byId('chatThemeGalleryInput');
if(input) input.click();
}

function removeChatTheme(){
localStorage.removeItem(chatThemeKey());
applyChatTheme();
renderChatThemePage();
}

function saveChatGalleryTheme(){
const input = byId('chatThemeGalleryInput');
const file = input && input.files[0];
if(!file) return;
const reader = new FileReader();
reader.onload = () => {
localStorage.setItem(chatThemeKey(), JSON.stringify({ id:'gallery', image:reader.result }));
applyChatTheme();
renderChatThemePage();
};
reader.readAsDataURL(file);
}

function applyChatTheme(){
const body = document.querySelector('.conversation-body');
if(!body) return;
const theme = readChatTheme();
body.style.backgroundImage = '';
body.style.backgroundColor = '';
if(theme.id === 'gallery' && theme.image){
body.style.backgroundImage = `linear-gradient(rgba(255,255,255,.78),rgba(255,255,255,.78)), url(${theme.image})`;
body.style.backgroundSize = 'cover';
body.style.backgroundPosition = 'center';
return;
}
if(theme.background){
body.style.backgroundImage = theme.background.startsWith('linear-gradient')
? theme.background
: '';
body.style.backgroundColor = theme.background.startsWith('linear-gradient')
? ''
: theme.background;
}
}

async function blockCurrentChatUser(){
if(!currentUser || String(currentChatUser).startsWith('group:')){
alert('Open a person chat first.');
return;
}
if(!confirm(`Block ${currentChatUser}?`)) return;
try{
await advancedFetch('/block', {
method:'POST',
headers:{ 'Content-Type':'application/json' },
body:JSON.stringify({ blockedUser:currentChatUser })
});
alert(`${currentChatUser} blocked.`);
}catch(error){
alert(error.message);
}
}

function showChatPlaceholder(name){
const menu = byId('chatMoreMenu');
if(menu) menu.classList.add('hidden');
alert(`${name} will open here in the next version.`);
}

async function clearChatWithUser(username, options = {}){
if(!currentUser){
alert('Please login first.');
return false;
}
if(!username || String(username).startsWith('group:')){
alert('Open a person chat first.');
return false;
}

if(options.confirm !== false && !confirm(`Clear full chat with @${username}?`)) return false;

const menu = byId('chatMoreMenu');
const personMenu = byId('chatPersonMenu');
if(menu) menu.classList.add('hidden');
if(personMenu) personMenu.classList.add('hidden');

const me = currentUser.username;
const remainingLocalMessages = readLocalMessages().filter((message) => !(
(message.sender === me && message.receiver === username) ||
(message.sender === username && message.receiver === me) ||
(message.sender === 'You' && message.receiver === username)
));
writeLocalMessages(remainingLocalMessages);

if(currentChatUser === username){
currentConversationMessages = [];
const container = byId('chatMessages');
if(container){
container.innerHTML = '';
renderEmptyMessage(`No messages with ${username} yet.`);
}
}

let backendCleared = false;
try{
const params = new URLSearchParams({
sender: me,
receiver: username
});
const response = await fetchWithTimeout(`${API_BASE_URL}/api/messages/conversation?${params.toString()}`, {
method:'DELETE',
headers:authHeaders()
}, 6000);
const data = await response.json().catch(() => ({}));
if(!response.ok){
throw new Error(data.message || 'Could not clear backend chat');
}
backendCleared = true;
setStatus('Chat cleared', true);
}catch(error){
console.warn('Backend clear chat failed:', error.message);
setStatus('Chat cleared on this device. Backend offline.', false);
}

alert(backendCleared ? 'Full chat cleared.' : 'Chat cleared from this device. Start backend to clear saved messages too.');
return true;
}

function closeChatMenus(){
const menu = byId('chatMoreMenu');
const personMenu = byId('chatPersonMenu');
if(menu) menu.classList.add('hidden');
if(personMenu) personMenu.classList.add('hidden');
}

function groupActionBlockedForMember(actionName){
const group = currentGroup();
if(!group){
alert('Group details not loaded yet.');
return true;
}
if(!currentUserIsGroupAdmin(group)){
alert(`${actionName} is only for group admins.`);
return true;
}
return false;
}

async function refreshAfterGroupAction(groupId){
await loadGroups();
const group = appGroups.find((item) => String(item._id) === String(groupId));
if(group && currentChatUser === `group:${groupId}`){
byId('chatUser').innerText = group.name;
}
updateChatMenuState();
}

async function clearCurrentGroupChat(){
if(!currentUser){
alert('Please login first.');
return false;
}
const group = currentGroup();
if(!group){
alert('Open a group chat first.');
return false;
}
if(!currentUserIsGroupAdmin(group)){
alert('Only group admins can clear group chat.');
return false;
}
if(!confirm(`Clear full group chat in ${group.name}?`)) return false;

closeChatMenus();
const receiver = `group:${group._id}`;
const remainingLocalMessages = readLocalMessages().filter((message) => message.receiver !== receiver);
writeLocalMessages(remainingLocalMessages);
currentConversationMessages = [];
const container = byId('chatMessages');
if(container){
container.innerHTML = '';
renderEmptyMessage(`No messages in ${group.name} yet.`);
}

try{
const params = new URLSearchParams({
sender: currentUser.username,
receiver
});
const response = await fetchWithTimeout(`${API_BASE_URL}/api/messages/conversation?${params.toString()}`, {
method:'DELETE',
headers:authHeaders()
}, 6000);
const data = await response.json().catch(() => ({}));
if(!response.ok){
throw new Error(data.message || 'Could not clear group chat');
}
setStatus('Group chat cleared', true);
alert('Group chat cleared.');
return true;
}catch(error){
setStatus('Group chat cleared on this device. Backend offline.', false);
alert(error.message);
return false;
}
}

async function editCurrentGroupDetails(){
const group = currentGroup();
if(groupActionBlockedForMember('Edit group')) return;
const name = prompt('Group name:', group.name);
if(name === null) return;
const description = prompt('Group description:', group.description || '');
if(description === null) return;
try{
await advancedFetch(`/groups/${group._id}`, {
method:'PUT',
headers:{ 'Content-Type':'application/json' },
body:JSON.stringify({ name, description })
});
closeChatMenus();
await refreshAfterGroupAction(group._id);
}catch(error){
alert(error.message);
}
}

async function addMemberToCurrentGroup(){
const group = currentGroup();
if(groupActionBlockedForMember('Add member')) return;
const options = uniqueContactNames().filter((name) => !group.members.includes(name));
const hint = options.length ? `\nContacts: ${options.map((name) => `@${name}`).join(', ')}` : '';
const username = prompt(`Enter username to add:${hint}`);
if(!username) return;
try{
await advancedFetch(`/groups/${group._id}/join`, {
method:'POST',
headers:{ 'Content-Type':'application/json' },
body:JSON.stringify({ username: username.replace('@', '').trim() })
});
closeChatMenus();
await refreshAfterGroupAction(group._id);
}catch(error){
alert(error.message);
}
}

async function removeMemberFromCurrentGroup(){
const group = currentGroup();
if(groupActionBlockedForMember('Remove member')) return;
const removable = group.members.filter((name) => name !== group.owner && name !== currentUser.username);
if(!removable.length){
alert('No removable members in this group.');
return;
}
const username = prompt(`Remove which member?\n${removable.map((name) => `@${name}`).join(', ')}`);
if(!username) return;
try{
await advancedFetch(`/groups/${group._id}/members/${encodeURIComponent(username.replace('@', '').trim())}`, {
method:'DELETE'
});
closeChatMenus();
await refreshAfterGroupAction(group._id);
}catch(error){
alert(error.message);
}
}

async function makeAdminInCurrentGroup(){
const group = currentGroup();
if(groupActionBlockedForMember('Make admin')) return;
const candidates = group.members.filter((name) => !group.admins.includes(name));
if(!candidates.length){
alert('All members are already admins.');
return;
}
const username = prompt(`Make which member admin?\n${candidates.map((name) => `@${name}`).join(', ')}`);
if(!username) return;
try{
await advancedFetch(`/groups/${group._id}/admins`, {
method:'POST',
headers:{ 'Content-Type':'application/json' },
body:JSON.stringify({ username: username.replace('@', '').trim() })
});
closeChatMenus();
await refreshAfterGroupAction(group._id);
}catch(error){
alert(error.message);
}
}

async function removeAdminFromCurrentGroup(){
const group = currentGroup();
if(groupActionBlockedForMember('Remove admin')) return;
const candidates = group.admins.filter((name) => name !== group.owner && name !== currentUser.username);
if(!candidates.length){
alert('No removable admins in this group.');
return;
}
const username = prompt(`Remove admin rights from:\n${candidates.map((name) => `@${name}`).join(', ')}`);
if(!username) return;
try{
await advancedFetch(`/groups/${group._id}/admins/${encodeURIComponent(username.replace('@', '').trim())}`, {
method:'DELETE'
});
closeChatMenus();
await refreshAfterGroupAction(group._id);
}catch(error){
alert(error.message);
}
}

async function leaveCurrentGroup(){
const group = currentGroup();
if(!group || !currentUser){
alert('Open a group chat first.');
return;
}
if(!confirm(`Leave ${group.name}?`)) return;
try{
await advancedFetch(`/groups/${group._id}/leave`, {
method:'POST'
});
closeChatMenus();
await loadGroups();
showPage('chatPage');
}catch(error){
alert(error.message);
}
}

async function deleteCurrentGroup(){
const group = currentGroup();
if(!group || !currentUser){
alert('Open a group chat first.');
return;
}
if(group.owner !== currentUser.username){
alert('Only the group owner can delete this group.');
return;
}
if(!confirm(`Delete ${group.name} for everyone? This also deletes group messages.`)) return;
try{
await advancedFetch(`/groups/${group._id}`, {
method:'DELETE'
});
closeChatMenus();
await loadGroups();
showPage('chatPage');
}catch(error){
alert(error.message);
}
}

function clearCurrentChat(){
if(String(currentChatUser).startsWith('group:')){
clearCurrentGroupChat();
return;
}
clearChatWithUser(currentChatUser);
}

function startQuickCall(type){
const firstFriend = friendState.friends[0] || (appUsers[0] && appUsers[0].username);
if(!firstFriend){
alert('Add a friend first.');
return;
}
startFriendCall(firstFriend, type);
}

function openDialerPad(){
const panel = byId('dialerPanel');
if(panel) panel.classList.toggle('hidden');
}

function appendDialer(value){
const input = byId('dialerNumber');
if(input) input.value += value;
}

function startDialerCall(){
const input = byId('dialerNumber');
const number = input ? input.value.trim() : '';
if(!number){
alert('Enter a number first.');
return;
}
addCallHistory(number, 'voice');
alert(`Calling ${number}`);
}

function showFavoriteContacts(){
const list = byId('callsFriendsList');
if(!list) return;
const names = friendState.friends.slice(0, 5);
list.innerHTML = names.length
? names.map((name) => `
<div class="call-row friend-call-row">
<div class="call-icon"><i class="fa-solid fa-star"></i></div>
<div><strong>@${escapeHtml(name)}</strong><small>Favorite contact</small></div>
<div class="call-actions">
<button onclick="startFriendCall('${escapeHtml(name)}','voice')" title="Voice call"><i class="fa-solid fa-phone"></i></button>
<button onclick="startFriendCall('${escapeHtml(name)}','video')" title="Video call"><i class="fa-solid fa-video"></i></button>
</div>
</div>
`).join('')
: '<div class="empty-state compact">No favorite contacts yet.</div>';
}

function showPage(pageId, options = {}){
const page = byId(pageId);
if(!page) return;
if(currentPageId && currentPageId !== pageId && !options.skipHistory){
pageHistoryStack.push(currentPageId);
if(pageHistoryStack.length > 30){
pageHistoryStack = pageHistoryStack.slice(-30);
}
}
currentPageId = pageId;
document.body.classList.toggle('main-chat-mode', pageId === 'chatPage');
document.body.classList.toggle('full-page-mode', pageId !== 'chatPage');
document.body.classList.toggle('conversation-mode', pageId === 'conversationPage');
document.body.classList.toggle('user-account-mode', pageId === 'userAccountPage' || pageId === 'contactEditPage' || pageId === 'contactNotificationPage');
document.body.classList.toggle('calls-mode', pageId === 'callsPage');
document.body.classList.toggle('settings-mode', pageId === 'settingsPage');
document.body.classList.toggle('profile-mode', pageId === 'profilePage');

document.querySelectorAll('.page-section').forEach((page)=>{
page.classList.add('hidden');
});

page.classList.remove('hidden');

syncNavigationSelection(pageId);

if(pageId === 'callsPage'){
renderCallsPage();
}
if(pageId === 'profilePage'){
updateProfileTopbar();
renderProfilePosts();
}
if(pageId === 'onlinePage'){
updateFriendsPostsTopbar();
renderFriendsPosts();
}
}

function preferredBackPage(){
if(currentPageId === 'userAccountPage'){
return userAccountReturnPage || 'profilePage';
}
if(currentPageId === 'contactEditPage' || currentPageId === 'contactNotificationPage'){
return 'userAccountPage';
}
if(currentPageId === 'chatThemePage'){
return 'conversationPage';
}
if(currentPageId === 'textStoryPage'){
return 'statusPage';
}
return '';
}

function goBackInApp(){
if(currentPageId === 'chatPage') return false;
let target = preferredBackPage();
while(!target && pageHistoryStack.length){
const candidate = pageHistoryStack.pop();
if(candidate && candidate !== currentPageId && byId(candidate)){
target = candidate;
}
}
if(!target){
target = 'chatPage';
}
if(!byId(target)) return false;
if(target === 'chatPage'){
pageHistoryStack = [];
}
showPage(target, { skipHistory:true });
return true;
}

function isSwipeBackBlockedTarget(target){
if(!(target instanceof Element)) return false;
return Boolean(target.closest([
'input',
'textarea',
'select',
'button',
'a',
'label',
'video',
'audio',
'iframe',
'canvas',
'[contenteditable="true"]',
'[data-no-swipe-back]',
'.message-input',
'.emoji-picker',
'.attachment-menu',
'.chat-game-panel',
'.chat-game-board',
'.chat-game-ambient',
'.camera-panel',
'.story-camera-shell',
'.text-story-editor',
'.reel-card'
].join(',')));
}

function setupSwipeBackNavigation(){
const canTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
if(!canTouch) return;

document.addEventListener('touchstart', (event) => {
if(event.touches.length !== 1 || currentPageId === 'chatPage') return;
if(isSwipeBackBlockedTarget(event.target)) return;
const touch = event.touches[0];
swipeBackStart = {
x:touch.clientX,
y:touch.clientY,
time:Date.now(),
cancelled:false
};
}, { passive:true });

document.addEventListener('touchmove', (event) => {
if(!swipeBackStart || event.touches.length !== 1) return;
const touch = event.touches[0];
const dx = Math.abs(touch.clientX - swipeBackStart.x);
const dy = Math.abs(touch.clientY - swipeBackStart.y);
if(dy > 35 && dy > dx){
swipeBackStart.cancelled = true;
}
}, { passive:true });

document.addEventListener('touchend', (event) => {
if(!swipeBackStart || swipeBackStart.cancelled) {
swipeBackStart = null;
return;
}
const touch = event.changedTouches[0];
const dx = touch.clientX - swipeBackStart.x;
const dy = touch.clientY - swipeBackStart.y;
const absX = Math.abs(dx);
const absY = Math.abs(dy);
const elapsed = Date.now() - swipeBackStart.time;
swipeBackStart = null;
if(absX < 82 || absX < absY * 1.6 || absY > 80 || elapsed > 900) return;
goBackInApp();
}, { passive:true });

document.addEventListener('touchcancel', () => {
swipeBackStart = null;
}, { passive:true });
}

function syncNavigationSelection(pageId){
const navPages = ['chatPage', 'homePage', 'statusPage', 'callsPage', 'onlinePage', 'searchPage'];
if(!navPages.includes(pageId)) return;
const targetCall = `showPage('${pageId}')`;
document.querySelectorAll('.nav-btn').forEach((button) => {
const action = button.getAttribute('onclick') || '';
button.classList.toggle('active', action.includes(targetCall));
});
document.querySelectorAll('.mobile-nav button').forEach((button) => {
const action = button.getAttribute('onclick') || '';
button.classList.toggle('active-mobile', action.includes(targetCall));
});
}

function setActiveButton(buttons, activeButton, activeClass){
buttons.forEach((button)=>{
button.classList.remove(activeClass);
});
activeButton.classList.add(activeClass);
}

function createMessageElement(message, type){
const msg = document.createElement('div');
msg.classList.add('message', type);
msg.innerText = message;
return msg;
}

function appendMessage(message, type){
const container = byId('chatMessages');
container.appendChild(createMessageElement(message, type));
container.scrollTop = container.scrollHeight;
}

function readLocalMessages(){
try{
return JSON.parse(localStorage.getItem('shashiLocalMessages') || '[]');
}catch(error){
return [];
}
}

function writeLocalMessages(messages){
try{
localStorage.setItem('shashiLocalMessages', JSON.stringify(messages));
return true;
}catch(error){
console.warn('Local message storage full:', error.message);
setStatus('Message sent, but local storage is full.', false);
return false;
}
}

function messageTimeValue(message){
const time = new Date(message && (message.createdAt || message.updatedAt || message.time) || 0).getTime();
return Number.isFinite(time) ? time : 0;
}

function saveLocalMessage(message){
const messages = readLocalMessages();
const savedMessage = {
_id: `browser_${Date.now()}_${Math.random().toString(36).slice(2)}`,
...message,
createdAt: message.createdAt || new Date().toISOString()
};
const key = messageKey(savedMessage);
const nextMessages = key && messages.some((item) => messageKey(item) === key)
? messages
: [...messages, savedMessage];
return writeLocalMessages(messagesWithoutDuplicates(nextMessages, []).slice(-500));
}

function saveLocalMessagesBulk(messages){
const items = Array.isArray(messages) ? messages : [];
if(!items.length) return true;
const existing = readLocalMessages();
const prepared = items.map((message) => ({
_id: message._id || `browser_${Date.now()}_${Math.random().toString(36).slice(2)}`,
...message,
createdAt: message.createdAt || new Date().toISOString()
}));
const nextMessages = messagesWithoutDuplicates(existing, prepared)
.sort((a, b) => messageTimeValue(a) - messageTimeValue(b))
.slice(-500);
return writeLocalMessages(nextMessages);
}

function getLocalConversation(sender, receiver){
if(String(receiver).startsWith('group:')){
return readLocalMessages().filter((message)=> message.receiver === receiver);
}
return readLocalMessages().filter((message)=>(
(message.sender === sender && message.receiver === receiver) ||
(message.sender === receiver && message.receiver === sender) ||
(message.sender === 'You' && message.receiver === receiver)
));
}

function latestChatTimestamp(chatId){
if(!currentUser || !chatId) return 0;
return getLocalConversation(currentUser.username, chatId)
.reduce((latest, message) => Math.max(latest, messageTimeValue(message)), 0);
}

function latestChatMessage(chatId){
if(!currentUser || !chatId) return null;
return getLocalConversation(currentUser.username, chatId)
.reduce((latest, message) => messageTimeValue(message) > messageTimeValue(latest) ? message : latest, null);
}

function formatChatListTime(messageOrTime){
const timestamp = typeof messageOrTime === 'number' ? messageOrTime : messageTimeValue(messageOrTime);
if(!timestamp) return '';
const date = new Date(timestamp);
const now = new Date();
if(date.toDateString() === now.toDateString()){
return date.toLocaleTimeString([], { hour:'numeric', minute:'2-digit' });
}
const yesterday = new Date(now);
yesterday.setDate(now.getDate() - 1);
if(date.toDateString() === yesterday.toDateString()){
return 'Yesterday';
}
return date.toLocaleDateString([], { month:'short', day:'numeric' });
}

function chatReadTimesKey(){
return currentUser ? `shashiChatReadTimes:${currentUser.username}` : 'shashiChatReadTimes';
}

function readChatReadTimes(){
try{
return JSON.parse(localStorage.getItem(chatReadTimesKey()) || '{}');
}catch(error){
return {};
}
}

function writeChatReadTimes(readTimes){
localStorage.setItem(chatReadTimesKey(), JSON.stringify(readTimes || {}));
}

function unreadCountForChat(chatId){
if(!currentUser || !chatId || chatId === currentUser.username) return 0;
const readTimes = readChatReadTimes();
const readAt = Number(readTimes[chatId] || 0);
return getLocalConversation(currentUser.username, chatId).filter((message) => {
if(message.sender === currentUser.username || message.sender === 'You') return false;
return messageTimeValue(message) > readAt;
}).length;
}

function markChatRead(chatId){
if(!currentUser || !chatId) return;
const readTimes = readChatReadTimes();
readTimes[chatId] = Math.max(Date.now(), latestChatTimestamp(chatId));
writeChatReadTimes(readTimes);
}

function chatListMetaHtml(chatId, lastMessage){
const unread = unreadCountForChat(chatId);
const lastTime = formatChatListTime(lastMessage);
return `
<div class="chat-meta">
<time class="chat-last-time">${escapeHtml(lastTime)}</time>
${unread > 0 ? `<span class="chat-unread-count">${unread > 99 ? '99+' : unread}</span>` : ''}
</div>`;
}

function lastSeenStatusText(user){
if(!user) return 'Offline';
if(user.online) return 'Online now';
const lastSeen = new Date(user.lastSeen || user.updatedAt || 0).getTime();
if(!Number.isFinite(lastSeen) || !lastSeen) return 'Offline';
const minutes = Math.max(0, Math.floor((Date.now() - lastSeen) / 60000));
if(minutes < 1) return 'Online just now';
if(minutes < 60) return `Online before ${minutes} min`;
return 'Offline';
}

function sortByLatestChatTime(items){
return [...items].sort((a, b) => {
const timeDiff = latestChatTimestamp(b.chatId) - latestChatTimestamp(a.chatId);
if(timeDiff !== 0) return timeDiff;
if(a.isSelf && !b.isSelf) return -1;
if(!a.isSelf && b.isSelf) return 1;
return String(a.name || '').localeCompare(String(b.name || ''));
});
}

function linkMatches(text){
return String(text || '').match(/https?:\/\/[^\s]+/g) || [];
}

function chatHistoryForUser(username){
const source = username === currentChatUser && currentConversationMessages.length
? currentConversationMessages
: getLocalConversation(currentUser ? currentUser.username : '', username);

const media = source.filter((message) => ['image', 'video', 'voice'].includes(message.messageType) || message.mediaUrl && !message.fileName);
const documents = source.filter((message) => message.messageType === 'file' || message.fileName);
const links = source.flatMap((message) => linkMatches(message.text).map((url) => ({ url, message })));

return { media, documents, links };
}

function renderProfileHistoryList(items, type){
if(!items.length){
return '<div class="empty-state compact">No items yet.</div>';
}

return items.slice(0, 12).map((item) => {
if(type === 'links'){
return `<a class="profile-history-item" href="${escapeHtml(item.url)}" target="_blank" rel="noopener"><i class="fa-solid fa-link"></i><span>${escapeHtml(item.url)}</span></a>`;
}
const label = item.fileName || item.text || item.messageType || 'Shared item';
const icon = item.messageType === 'image'
? 'image'
: item.messageType === 'video'
? 'video'
: item.messageType === 'voice'
? 'microphone'
: 'file-lines';
return item.mediaUrl
? `<a class="profile-history-item" href="${escapeHtml(item.mediaUrl)}" target="_blank" rel="noopener"><i class="fa-solid fa-${icon}"></i><span>${escapeHtml(label)}</span></a>`
: `<div class="profile-history-item"><i class="fa-solid fa-${icon}"></i><span>${escapeHtml(label)}</span></div>`;
}).join('');
}

function renderCombinedProfileHistory(history){
const combined = [
...history.media.map((item) => ({ kind:'Media', item })),
...history.links.map((item) => ({ kind:'Link', item })),
...history.documents.map((item) => ({ kind:'Document', item }))
];

if(!combined.length){
return '<div class="empty-state compact">No media, links, or documents yet.</div>';
}

return combined.slice(0, 18).map(({ kind, item }) => {
if(kind === 'Link'){
return `<a class="profile-history-item" href="${escapeHtml(item.url)}" target="_blank" rel="noopener"><i class="fa-solid fa-link"></i><span>${escapeHtml(item.url)}</span><small>${kind}</small></a>`;
}
const label = item.fileName || item.text || item.messageType || kind;
const icon = item.messageType === 'image'
? 'image'
: item.messageType === 'video'
? 'video'
: item.messageType === 'voice'
? 'microphone'
: 'file-lines';
return item.mediaUrl
? `<a class="profile-history-item" href="${escapeHtml(item.mediaUrl)}" target="_blank" rel="noopener"><i class="fa-solid fa-${icon}"></i><span>${escapeHtml(label)}</span><small>${kind}</small></a>`
: `<div class="profile-history-item"><i class="fa-solid fa-${icon}"></i><span>${escapeHtml(label)}</span><small>${kind}</small></div>`;
}).join('');
}

function searchChatFromProfile(username){
openChat(username);
setTimeout(() => searchInCurrentChat(), 150);
}

function contactNoteKey(username){
return `shashiContactNote:${username}`;
}

function saveContactNote(username){
const input = byId('contactNoteInput');
if(!input) return;
localStorage.setItem(contactNoteKey(username), input.value.trim());
alert('Note saved.');
}

function toggleProfilePanel(id){
const panel = byId(id);
if(panel) panel.classList.toggle('hidden');
}

function messageKey(message){
if(message.clientId) return message.clientId;
return [
message.sender || '',
message.receiver || '',
message.text || '',
message.mediaUrl || '',
message.fileName || ''
].join('|');
}

function messagesWithoutDuplicates(primaryMessages, extraMessages){
const seen = new Set();
return [...primaryMessages, ...extraMessages].filter((message)=>{
const key = messageKey(message);
if(seen.has(key)) return false;
seen.add(key);
return true;
});
}

function extractTags(text){
const value = String(text || '');
return {
hashtags: [...new Set((value.match(/#[a-zA-Z0-9_]+/g) || []).map((tag) => tag.slice(1).toLowerCase()))],
mentions: [...new Set((value.match(/@[a-zA-Z0-9_]+/g) || []).map((tag) => tag.slice(1)))]
};
}

function formatCalculationNumber(value){
if(!Number.isFinite(value)) return '';
const fixed = Math.round((value + Number.EPSILON) * 100000000) / 100000000;
return Number.isInteger(fixed) ? String(fixed) : String(fixed);
}

function detectCalculation(text){
const value = String(text || '').trim();
if(/=\s*-?\d/.test(value)) return null;
const match = value.match(/(?:^|\s)((?:-?\d+(?:\.\d+)?\s*[+\-*/xX×÷]\s*)+-?\d+(?:\.\d+)?)$/);
if(!match) return null;

const expression = match[1].trim();
if(/[+\-*/xX×÷]\s*$/.test(expression)) return null;

const normalized = expression.replace(/[xX×]/g, '*').replace(/÷/g, '/').replace(/\s+/g, '');
if(!/^-?\d+(?:\.\d+)?(?:[+\-*/]-?\d+(?:\.\d+)?)+$/.test(normalized)){
return null;
}

const tokens = normalized.match(/-?\d+(?:\.\d+)?|[+\-*/]/g);
if(!tokens || tokens.length < 3) return null;

const values = [];
const operators = [];

for(let index = 0; index < tokens.length; index += 1){
const token = tokens[index];
if(index % 2 === 0){
values.push(Number(token));
}else{
operators.push(token);
}
}

for(let index = 0; index < operators.length; index += 1){
if(operators[index] !== '*' && operators[index] !== '/') continue;
const left = values[index];
const right = values[index + 1];
if(operators[index] === '/' && right === 0){
return { expression, result: 'undefined' };
}
const next = operators[index] === '*' ? left * right : left / right;
values.splice(index, 2, next);
operators.splice(index, 1);
index -= 1;
}

let result = values[0];
for(let index = 0; index < operators.length; index += 1){
result = operators[index] === '+'
? result + values[index + 1]
: result - values[index + 1];
}

return {
expression,
result: formatCalculationNumber(result)
};
}

function updateCalculatorPreview(){
const input = byId('chatInput');
const preview = byId('calculatorPreview');
if(!input || !preview) return;

const calculation = detectCalculation(input.value);
if(calculation){
preview.innerText = `=${calculation.result}`;
preview.classList.remove('hidden');
}else{
preview.innerText = '';
preview.classList.add('hidden');
}
}

function appendCalculationResult(text){
const calculation = detectCalculation(text);
if(!calculation) return text;
return `${text} = ${calculation.result}`;
}

function sendCalculationResult(){
const input = byId('chatInput');
if(!input) return;
const calculation = detectCalculation(input.value);
if(!calculation) return;
sendChat();
}

function renderEmptyMessage(text){
const container = byId('chatMessages');
container.innerHTML = '';
const empty = document.createElement('div');
empty.className = 'empty-state';
empty.innerText = text;
container.appendChild(empty);
}

function updateAuthView(){
const signedIn = Boolean(currentUser);
const authPanel = byId('authPanel');
const profileUserLabel = byId('profileUserLabel');
const chatUserLabel = byId('chatUserLabel');
const sendButton = byId('sendButton');
const chatInput = byId('chatInput');
const logoutButton = byId('logoutButton');
const profileInitial = byId('profileInitial');
const profileUsername = byId('profileUsername');
const profileEmail = byId('profileEmail');
const profilePhone = byId('profilePhone');
const profileAbout = byId('profileAbout');
const profileBio = byId('profileBio');
const profileBioLine = byId('profileBioLine');
const profileAboutDuration = byId('profileAboutDuration');
const profileOnlineDot = byId('profileOnlineDot');

if(authPanel){
authPanel.classList.toggle('hidden', signedIn);
}

if(profileUserLabel){
profileUserLabel.innerText = signedIn
? `Signed in as ${currentUser.username}`
: 'Sign in to save messages';
}

if(chatUserLabel){
chatUserLabel.innerText = signedIn
? `You are ${currentUser.username}`
: 'Sign in to save messages';
}

if(sendButton){
sendButton.disabled = !signedIn;
}

if(chatInput){
chatInput.disabled = !signedIn;
chatInput.placeholder = signedIn ? 'Type message...' : 'Login or signup to chat';
}
updateChatActionButton();

if(logoutButton){
logoutButton.classList.toggle('hidden', !signedIn);
}

if(profileInitial){
profileInitial.innerHTML = '<i class="fa-solid fa-bars"></i>';
}

if(profileUsername){
profileUsername.value = signedIn ? currentUser.username : '';
}

if(profileEmail){
profileEmail.value = signedIn ? currentUser.email : '';
}

if(profilePhone){
profilePhone.value = signedIn ? currentUser.phone || '' : '';
}

if(profileAbout){
profileAbout.value = signedIn ? currentUser.about || '' : '';
}

if(profileBio){
profileBio.value = signedIn ? currentUser.bio || '' : '';
}

if(profileBioLine){
const bioText = signedIn ? String(currentUser.bio || '').trim() : '';
profileBioLine.innerText = bioText;
profileBioLine.classList.toggle('hidden', !bioText);
}

if(profileAboutDuration){
profileAboutDuration.innerText = signedIn ? aboutDurationText(currentUser.aboutUpdatedAt || currentUser.updatedAt) : '';
}

if(profileOnlineDot){
profileOnlineDot.classList.toggle('hidden', !(signedIn && currentUser.online));
}

renderProfilePhoto();
updateProfileTopbar();
renderProfileStats();
renderProfilePosts();
renderUsers();
renderSettingsSummary();
updateFriendsPostsTopbar();
}

function renderProfilePhoto(){
const preview = byId('profilePhotoPreview');
const fallback = byId('profilePhotoFallback');

if(!preview || !fallback) return;

if(currentUser && currentUser.profilePhoto){
preview.src = photoUrl(currentUser.profilePhoto);
preview.classList.remove('hidden');
fallback.classList.add('hidden');
}else{
preview.removeAttribute('src');
preview.classList.add('hidden');
fallback.classList.remove('hidden');
fallback.innerText = currentUser ? currentUser.username.charAt(0).toUpperCase() : 'S';
}
}

function renderProfileStats(){
const followersCount = byId('profileFollowersCount');
const postsCount = byId('profilePostsCount');
const followingCount = byId('profileFollowingCount');
if(!followersCount || !postsCount || !followingCount) return;

const username = currentUser ? currentUser.username : '';
const posts = username
? appPosts.filter((post) => post.username === username).length
: 0;

followersCount.innerText = currentUser ? friendState.followers.length : 0;
postsCount.innerText = posts;
followingCount.innerText = currentUser ? friendState.following.length : 0;
}

function renderProfilePosts(){
const feed = byId('profilePostsFeed');
if(!feed) return;

if(!currentUser){
feed.innerHTML = '<div class="empty-state compact">Login to see your posts.</div>';
return;
}

const posts = appPosts.filter((post) => post.username === currentUser.username);
feed.innerHTML = '';

if(posts.length === 0){
feed.innerHTML = '<div class="empty-state compact">No posts uploaded yet.</div>';
return;
}

posts.forEach((post) => feed.appendChild(createPostCard(post)));
}

function aboutDurationText(dateValue){
if(!dateValue) return 'Not set yet';
const then = new Date(dateValue).getTime();
if(!Number.isFinite(then)) return 'Not set yet';
const diff = Math.max(0, Date.now() - then);
const minutes = Math.floor(diff / 60000);
if(minutes < 1) return 'Updated just now';
if(minutes < 60) return `Updated ${minutes} min ago`;
const hours = Math.floor(minutes / 60);
if(hours < 24) return `Updated ${hours} hr ago`;
const days = Math.floor(hours / 24);
if(days < 30) return `Updated ${days} day${days === 1 ? '' : 's'} ago`;
const months = Math.floor(days / 30);
return `Updated ${months} month${months === 1 ? '' : 's'} ago`;
}

function setQuickAbout(text){
const input = byId('profileAbout');
if(input){
input.value = text;
input.focus();
}
}

function chooseProfileStatus(){
if(!currentUser){
alert('Login first.');
return;
}
const input = byId('profileStatusInput');
if(input) input.click();
}

function renderUsers(){
const usersList = byId('usersList');
const chatUsersList = byId('chatUsersList');
document.querySelectorAll('.demo-chat-item').forEach((item) => {
item.classList.toggle('hidden', !!currentUser);
});

if(usersList){
usersList.innerHTML = '';
}

if(chatUsersList){
chatUsersList.innerHTML = '';
}

if(!currentUser){
if(usersList){
usersList.innerHTML = '<div class="empty-state compact">Login to view user accounts.</div>';
}
if(chatUsersList){
chatUsersList.innerHTML = '<div class="empty-state compact">Login to view real user chats.</div>';
}
renderFriendsPosts();
return;
}

const otherUsers = appUsers.filter((user) => !currentUser || user.username !== currentUser.username);
const chatContacts = sortByLatestChatTime([
{ type:'self', isSelf:true, name:currentUser.username, chatId:currentUser.username, user:currentUser },
...otherUsers.map((user) => ({ type:'user', isSelf:false, name:user.username, chatId:user.username, user }))
]);

if(chatUsersList){
chatContacts.forEach((contact) => {
chatUsersList.appendChild(contact.type === 'self'
? createSelfChatListItem()
: createChatListItem(contact.user));
});
}

if(otherUsers.length === 0){
if(usersList){
usersList.innerHTML = '<div class="empty-state compact">No other users yet.</div>';
}
renderChatGroups();
renderFriendsPosts();
return;
}

otherUsers.forEach((user)=>{
const item = createUserItem(user);
if(usersList){
usersList.appendChild(item);
}
});

renderChatGroups();
renderFriendsPosts();

renderFriendSystem();
}

function renderChatGroups(){
const chatGroupsList = byId('chatGroupsList');
if(!chatGroupsList) return;

if(!currentUser){
chatGroupsList.innerHTML = '';
return;
}

const sortedGroups = sortByLatestChatTime(appGroups.map((group) => ({
type:'group',
name:group.name,
chatId:`group:${group._id}`,
group
}))).map((item) => item.group);

chatGroupsList.innerHTML = sortedGroups.length
? sortedGroups.map((group)=>{
const chatId = `group:${group._id}`;
const lastMessage = latestChatMessage(chatId);
return `
<div class="chat-item group-chat-item" data-user="${escapeHtml(chatId)}" onclick="openGroupChat('${escapeHtml(group._id)}','${escapeHtml(group.name)}')">
<div class="chat-avatar group-avatar"><i class="fa-solid fa-user-group"></i></div>
<div class="chat-item-main">
<h4>${escapeHtml(group.name)}</h4>
<small>${group.members.length} members</small>
</div>
${chatListMetaHtml(chatId, lastMessage)}
</div>
`;
}).join('')
: '';
}

function renderFriendsPosts(){
const feed = byId('friendsPostsFeed');
if(!feed) return;

if(!currentUser){
feed.innerHTML = '<div class="empty-state compact">Login to see posts from friends.</div>';
return;
}

const names = new Set([
...friendState.friends,
...friendState.following,
...friendState.followers
]);
const relatedPosts = appPosts
.map((post) => {
const likes = post.likes || [];
const comments = post.comments || [];
const mentions = post.mentions || [];
const friendComment = comments.find((comment) => names.has(comment.username));
const friendLike = likes.find((name) => names.has(name));
const friendMention = mentions.find((name) => names.has(name));
let reason = '';
let priority = 3;

if(names.has(post.username)){
reason = 'Friend post';
priority = 0;
}else if(friendComment){
reason = `Commented by ${friendComment.username}`;
priority = 1;
}else if(friendLike){
reason = `Liked by ${friendLike}`;
priority = 2;
}else if(friendMention){
reason = `Related to ${friendMention}`;
priority = 2;
}

return reason ? { post, reason, priority } : null;
})
.filter(Boolean)
.sort((a, b) => {
if(a.priority !== b.priority) return a.priority - b.priority;
return new Date(b.post.createdAt || 0) - new Date(a.post.createdAt || 0);
});

feed.innerHTML = '';
if(relatedPosts.length === 0){
feed.innerHTML = '<div class="empty-state compact">No posts from friends or related activity yet.</div>';
return;
}

relatedPosts.forEach((item) => feed.appendChild(createPostCard(item.post, item.reason)));
}

function createUserItem(user){
const item = document.createElement('button');
item.type = 'button';
item.className = 'user-row';
item.onclick = () => openUserAccount(user.username);

const avatar = user.profilePhoto
? `<img src="${photoUrl(user.profilePhoto)}" alt="${user.username}">`
: `<span>${user.username.charAt(0).toUpperCase()}</span>`;

item.innerHTML = `
<div class="user-avatar">${avatar}</div>
<div>
<strong>${user.username}</strong>
<small>${escapeHtml(user.about || user.bio || lastSeenStatusText(user))}</small>
</div>
<span class="presence-dot ${user.online ? 'online' : ''}"></span>
`;

return item;
}

function createSelfChatListItem(){
const item = document.createElement('div');
item.className = 'chat-item self-chat-item';
item.dataset.user = currentUser.username;
item.onclick = () => openChat(currentUser.username);

const avatar = currentUser.profilePhoto
? `<img src="${photoUrl(currentUser.profilePhoto)}" alt="${escapeHtml(currentUser.username)}">`
: '<span>Y</span>';
const lastMessage = latestChatMessage(currentUser.username);

item.innerHTML = `
<div class="chat-avatar">${avatar}</div>
<div class="chat-item-main">
<h4>You <span></span></h4>
<small>Message yourself</small>
</div>
${chatListMetaHtml(currentUser.username, lastMessage)}
`;

return item;
}

function createChatListItem(user){
const item = document.createElement('div');
item.className = 'chat-item';
item.dataset.user = user.username;
item.onclick = () => openChat(user.username);

const avatar = user.profilePhoto
? `<img src="${photoUrl(user.profilePhoto)}" alt="${escapeHtml(user.username)}">`
: `<span>${escapeHtml(user.username.charAt(0).toUpperCase())}</span>`;
const lastMessage = latestChatMessage(user.username);

item.innerHTML = `
<div class="chat-avatar">${avatar}</div>
<div class="chat-item-main">
<h4>${escapeHtml(user.username)} <span></span></h4>
<small class="chat-presence-text">${escapeHtml(lastSeenStatusText(user))}</small>
</div>
${chatListMetaHtml(user.username, lastMessage)}
`;

return item;
}

function refreshChatListTimes(){
document.querySelectorAll('#chatUsersList .chat-item[data-user], #chatGroupsList .chat-item[data-user]').forEach((item) => {
const time = item.querySelector('.chat-last-time');
if(time){
time.innerText = formatChatListTime(latestChatMessage(item.dataset.user));
}
const badge = item.querySelector('.chat-unread-count');
const unread = unreadCountForChat(item.dataset.user);
if(badge){
badge.innerText = unread > 99 ? '99+' : unread;
badge.classList.toggle('hidden', unread === 0);
}else if(unread > 0){
const meta = item.querySelector('.chat-meta');
if(meta){
meta.insertAdjacentHTML('beforeend', `<span class="chat-unread-count">${unread > 99 ? '99+' : unread}</span>`);
}
}
const presence = item.querySelector('.chat-presence-text');
const user = appUsers.find((entry) => entry.username === item.dataset.user);
if(presence && user){
presence.innerText = lastSeenStatusText(user);
}
});
}

setInterval(refreshChatListTimes, 30000);

function contactEditKey(username){
return `shashiContactEdit:${username}`;
}

function readContactEdit(username){
try{
return JSON.parse(localStorage.getItem(contactEditKey(username)) || '{}');
}catch(error){
return {};
}
}

function contactDisplayName(user){
const edit = readContactEdit(user.username);
const fullName = [edit.firstName, edit.lastName].filter(Boolean).join(' ').trim();
return fullName || user.name || user.username;
}

function contactPhone(user){
const edit = readContactEdit(user.username);
return [edit.countryCode, edit.mobile].filter(Boolean).join(' ').trim() || user.phone || '';
}

function contactMatchesKey(){
return currentUser ? `shashiContactMatches:${currentUser.username}` : 'shashiContactMatches:guest';
}

function readContactMatchNames(){
try{
return JSON.parse(localStorage.getItem(contactMatchesKey()) || '[]');
}catch(error){
return [];
}
}

function saveContactMatches(users){
const names = users
.map((user) => user && user.username)
.filter(Boolean);
localStorage.setItem(contactMatchesKey(), JSON.stringify([...new Set(names)]));
}

function isVisiblePhoneContact(user){
if(!user || !user.username) return false;
if(currentUser && user.username === currentUser.username) return true;
const matchedNames = new Set([
...readContactMatchNames(),
...contactUsers.map((item) => item.username)
]);
return matchedNames.has(user.username);
}

function visibleContactPhone(user){
return isVisiblePhoneContact(user) ? contactPhone(user) : '';
}

function contactProfilePhoneLine(user){
return visibleContactPhone(user) || `@${user.username}`;
}

function profileAdvancedKey(username, kind){
return `shashiProfileAdvanced:${kind}:${username}`;
}

function readProfileAdvanced(username, kind, fallback){
try{
const value = localStorage.getItem(profileAdvancedKey(username, kind));
return value ? JSON.parse(value) : fallback;
}catch(error){
return fallback;
}
}

function writeProfileAdvanced(username, kind, value){
localStorage.setItem(profileAdvancedKey(username, kind), JSON.stringify(value));
}

function contactNickname(user){
return readProfileAdvanced(user.username, 'nickname', '') || '';
}

function contactLabel(user){
return readProfileAdvanced(user.username, 'label', 'Friend');
}

function renderCommonGroups(username){
const me = currentUser && currentUser.username;
const groups = appGroups.filter((group) => (
Array.isArray(group.members) &&
me &&
group.members.includes(me) &&
group.members.includes(username)
));
return groups.length
? groups.map((group) => `<button type="button" onclick="openGroupChat('${escapeHtml(group._id)}','${escapeHtml(group.name)}')"><i class="fa-solid fa-user-group"></i><span>${escapeHtml(group.name)}</span><small>${group.members.length}</small></button>`).join('')
: '<small class="profile-section-empty">No common groups yet.</small>';
}

function renderProfileSavedList(username, kind){
const items = readProfileAdvanced(username, kind, []);
return items.length
? items.map((item) => `<div class="profile-mini-item"><i class="fa-solid fa-${kind === 'starred' ? 'star' : 'thumbtack'}"></i><span>${escapeHtml(item)}</span></div>`).join('')
: `<small class="profile-section-empty">No ${kind === 'starred' ? 'starred messages' : 'pinned media'} yet.</small>`;
}

function profileQrPattern(username){
const seed = String(username || 'shashi').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
return Array.from({ length:49 }, (_, index) => {
const fixed = index < 14 && (index % 7 < 2 || Math.floor(index / 7) < 2);
return `<span class="${fixed || ((index * 11 + seed) % 5 < 2) ? 'active' : ''}"></span>`;
}).join('');
}

function openUserAccount(username, returnPage = 'profilePage'){
userAccountReturnPage = returnPage;
const user = appUsers.find((item) => item.username === username) || { username };
viewedProfileUser = user;
const title = byId('viewUserTitle');
const container = byId('viewUserProfile');
const displayName = contactDisplayName(user);
const mobileLine = contactProfilePhoneLine(user);
if(title) title.innerText = displayName;
if(!container) return;

const avatar = user.profilePhoto
? `<img src="${photoUrl(user.profilePhoto)}" alt="${escapeHtml(user.username)}">`
: `<span>${escapeHtml(user.username.charAt(0).toUpperCase())}</span>`;
const history = chatHistoryForUser(user.username);
const note = localStorage.getItem(contactNoteKey(user.username)) || '';
const nickname = contactNickname(user);
const privacy = readProfileAdvanced(user.username, 'privacy', { online:false, read:false, typing:false });
const aboutLine = user.about ? `<small class="contact-about-line">${escapeHtml(user.about)}</small>` : '';
const bioLine = user.bio ? `<small class="contact-bio-line">${escapeHtml(user.bio)}</small>` : '';

container.innerHTML = `
<div class="view-user-hero">
<div class="profile-photo-wrap contact-profile-photo">${avatar}</div>
${bioLine}
<h3>${escapeHtml(displayName)}</h3>
<small>@${escapeHtml(user.username)}</small>
<small class="contact-phone">${escapeHtml(mobileLine)}</small>
${aboutLine}
<small>${user.online ? 'Online' : 'Offline'}</small>
<div class="contact-action-row">
<button type="button" onclick="startFriendCall('${escapeHtml(user.username)}','voice')" title="Audio call"><i class="fa-solid fa-phone"></i></button>
<button type="button" onclick="startFriendCall('${escapeHtml(user.username)}','video')" title="Video call"><i class="fa-solid fa-video"></i></button>
<button type="button" onclick="searchChatFromProfile('${escapeHtml(user.username)}')" title="Search"><i class="fa-solid fa-magnifying-glass"></i></button>
</div>
<div class="contact-extra-action-row">
<button type="button" onclick="toggleProfilePanel('contactNotePanel')" title="Add notes"><i class="fa-solid fa-note-sticky"></i><span>Add notes</span></button>
</div>
</div>
<div id="contactNotePanel" class="contact-compact-panel hidden">
<input id="contactNoteInput" type="text" placeholder="Write a private note..." value="${escapeHtml(note)}" />
<button class="ghost-btn" onclick="saveContactNote('${escapeHtml(user.username)}')">Save</button>
</div>
<div class="profile-history-box">
<h3>Media, Links & Documents</h3>
${renderCombinedProfileHistory(history)}
</div>
<div class="profile-option-box">
<button type="button" onclick="openContactNotifications()"><i class="fa-solid fa-bell"></i><span>Notifications</span></button>
<button type="button" onclick="toggleProfileSetting('Media visibility')"><i class="fa-solid fa-image"></i><span>Media visibility</span></button>
<button type="button" onclick="openDisappearingMessages()"><i class="fa-solid fa-clock"></i><span>Disappearing messages</span></button>
<button type="button" onclick="toggleProfileSetting('Chat lock')"><i class="fa-solid fa-lock"></i><span>Chat lock</span></button>
<button type="button" onclick="toggleProfileSetting('Messages translate')"><i class="fa-solid fa-language"></i><span>Messages translate</span></button>
<button type="button" onclick="addCurrentProfileToFavorites()"><i class="fa-solid fa-star"></i><span>Add favorites</span></button>
</div>
<div class="profile-option-box danger-profile-options">
<button type="button" onclick="blockViewedProfileUser()"><i class="fa-solid fa-ban"></i><span>Block</span></button>
<button type="button" onclick="reportViewedProfileUser()"><i class="fa-solid fa-flag"></i><span>Report</span></button>
<button type="button" onclick="clearViewedProfileChat()"><i class="fa-solid fa-trash"></i><span>Clear chat</span></button>
</div>
<div class="profile-advanced-section">
<h3><i class="fa-solid fa-user-group"></i> Common groups</h3>
<div class="profile-option-box compact-options">${renderCommonGroups(user.username)}</div>
</div>
<div class="profile-advanced-section">
<h3><i class="fa-solid fa-star"></i> Starred messages</h3>
<div class="profile-mini-list">${renderProfileSavedList(user.username, 'starred')}</div>
<button type="button" class="ghost-btn" onclick="addProfileQuickItem('starred')">Add starred message</button>
</div>
<div class="profile-advanced-section">
<h3><i class="fa-solid fa-thumbtack"></i> Pinned media</h3>
<div class="profile-mini-list">${renderProfileSavedList(user.username, 'pinned')}</div>
<button type="button" class="ghost-btn" onclick="addProfileQuickItem('pinned')">Add pinned media</button>
</div>
<div class="profile-advanced-section">
<h3><i class="fa-solid fa-id-badge"></i> Nickname</h3>
<div class="profile-inline-editor"><input id="profileNicknameInput" type="text" value="${escapeHtml(nickname)}" placeholder="Add nickname" /><button class="ghost-btn" onclick="saveProfileNickname()">Save</button></div>
</div>
<div class="profile-advanced-section">
<h3><i class="fa-solid fa-shield-halved"></i> Privacy per contact</h3>
<div class="profile-toggle-list">
<label><span>Hide online status</span><input type="checkbox" id="contactPrivacyOnline" ${privacy.online ? 'checked' : ''} onchange="saveContactPrivacy()"></label>
<label><span>Hide read receipts</span><input type="checkbox" id="contactPrivacyRead" ${privacy.read ? 'checked' : ''} onchange="saveContactPrivacy()"></label>
<label><span>Hide typing status</span><input type="checkbox" id="contactPrivacyTyping" ${privacy.typing ? 'checked' : ''} onchange="saveContactPrivacy()"></label>
</div>
</div>
<div class="profile-advanced-section">
<h3><i class="fa-solid fa-qrcode"></i> Contact QR code</h3>
<div class="profile-qr">${profileQrPattern(user.username)}</div>
<button type="button" class="ghost-btn" onclick="shareCurrentProfile()">Share profile</button>
</div>
<div class="profile-advanced-section">
<h3><i class="fa-solid fa-file-export"></i> Chat export</h3>
<button type="button" class="ghost-btn" onclick="exportViewedProfileChat()">Export chat text</button>
</div>
`;
showPage('userAccountPage');
}

function backFromUserAccount(){
showPage(userAccountReturnPage || 'profilePage');
}

function toggleUserProfileMenu(){
const menu = byId('userProfileMenu');
if(menu) menu.classList.toggle('hidden');
}

function currentViewedUsername(){
return viewedProfileUser && viewedProfileUser.username ? viewedProfileUser.username : currentChatUser;
}

async function shareCurrentProfile(){
const username = currentViewedUsername();
const text = `shashi profile: @${username}`;
try{
if(navigator.share){
await navigator.share({ title:'shashi Profile', text });
}else if(navigator.clipboard){
await navigator.clipboard.writeText(text);
alert('Profile copied.');
}else{
alert(text);
}
}catch(error){}
}

function editCurrentProfileContact(){
const menu = byId('userProfileMenu');
if(menu) menu.classList.add('hidden');
if(!viewedProfileUser || !viewedProfileUser.username) return;
const edit = readContactEdit(viewedProfileUser.username);
const mobile = visibleContactPhone(viewedProfileUser);
if(byId('contactFirstNameInput')) byId('contactFirstNameInput').value = edit.firstName || '';
if(byId('contactLastNameInput')) byId('contactLastNameInput').value = edit.lastName || '';
if(byId('contactCountryInput')) byId('contactCountryInput').value = edit.countryCode || '';
if(byId('contactMobileInput')) byId('contactMobileInput').value = edit.mobile || mobile;
showPage('contactEditPage');
const input = byId('contactFirstNameInput');
if(input) input.focus();
}

function backToViewedProfile(){
if(viewedProfileUser && viewedProfileUser.username){
openUserAccount(viewedProfileUser.username, userAccountReturnPage || 'profilePage');
return;
}
showPage(userAccountReturnPage || 'profilePage');
}

function saveEditedProfileContact(){
if(!viewedProfileUser || !viewedProfileUser.username) return;
const firstName = byId('contactFirstNameInput') ? byId('contactFirstNameInput').value.trim() : '';
const lastName = byId('contactLastNameInput') ? byId('contactLastNameInput').value.trim() : '';
const countryCode = byId('contactCountryInput') ? byId('contactCountryInput').value.trim() : '';
const mobile = byId('contactMobileInput') ? byId('contactMobileInput').value.trim() : '';
localStorage.setItem(contactEditKey(viewedProfileUser.username), JSON.stringify({ firstName, lastName, countryCode, mobile }));
openUserAccount(viewedProfileUser.username, userAccountReturnPage || 'profilePage');
}

function openContactNotifications(){
if(!viewedProfileUser || !viewedProfileUser.username) return;
const username = viewedProfileUser.username;
const ringtone = readProfileAdvanced(username, 'ringtone', 'Default');
const prefs = readProfileAdvanced(username, 'notifications', {
messageMute:false,
messageVibrate:true,
messageTone:'Default',
callRingtone:ringtone,
callVibration:true,
statusMute:false
});
const language = readProfileAdvanced(username, 'translateLanguage', 'Hindi');
const label = readProfileAdvanced(username, 'label', 'Friend');
if(byId('messageMuteToggle')) byId('messageMuteToggle').checked = Boolean(prefs.messageMute);
if(byId('messageVibrateToggle')) byId('messageVibrateToggle').checked = prefs.messageVibrate !== false;
if(byId('messageToneSelect')) byId('messageToneSelect').value = prefs.messageTone || 'Default';
if(byId('contactCallRingtoneSelect')) byId('contactCallRingtoneSelect').value = prefs.callRingtone || ringtone || 'Default';
if(byId('callVibrationToggle')) byId('callVibrationToggle').checked = prefs.callVibration !== false;
if(byId('statusMuteToggle')) byId('statusMuteToggle').checked = Boolean(prefs.statusMute);
if(byId('contactTranslateLanguage')) byId('contactTranslateLanguage').value = language;
if(byId('contactRelationshipLabel')) byId('contactRelationshipLabel').value = label;
showPage('contactNotificationPage');
}

function addCurrentProfileToList(){
const username = currentViewedUsername();
const list = JSON.parse(localStorage.getItem('shashiProfileList') || '[]');
if(!list.includes(username)){
list.push(username);
localStorage.setItem('shashiProfileList', JSON.stringify(list));
}
alert(`${username} added to list.`);
}

function toggleProfileSetting(name){
alert(`${name} setting is ready here.`);
}

function addCurrentProfileToFavorites(){
const username = currentViewedUsername();
const list = JSON.parse(localStorage.getItem('shashiFavoriteContacts') || '[]');
if(!list.includes(username)){
list.push(username);
localStorage.setItem('shashiFavoriteContacts', JSON.stringify(list));
}
alert(`${username} added to favorites.`);
}

function reportViewedProfileUser(){
const username = currentViewedUsername();
const reason = prompt(`Report @${username}. Enter reason:`);
if(!reason) return;
const reports = JSON.parse(localStorage.getItem('shashiLocalReports') || '[]');
reports.push({
targetUser:username,
reason,
createdAt:new Date().toISOString()
});
localStorage.setItem('shashiLocalReports', JSON.stringify(reports.slice(-100)));
alert('Report saved.');
}

async function clearViewedProfileChat(){
const username = currentViewedUsername();
const cleared = await clearChatWithUser(username);
if(cleared){
openUserAccount(username, userAccountReturnPage || 'profilePage');
}
}

function addProfileQuickItem(kind){
const username = currentViewedUsername();
const label = kind === 'starred' ? 'starred message' : 'pinned media';
const value = prompt(`Add ${label}:`);
if(!value) return;
const items = readProfileAdvanced(username, kind, []);
items.unshift(value.trim());
writeProfileAdvanced(username, kind, items.slice(0, 12));
openUserAccount(username, userAccountReturnPage || 'profilePage');
}

function saveProfileNickname(){
const username = currentViewedUsername();
const value = byId('profileNicknameInput') ? byId('profileNicknameInput').value.trim() : '';
writeProfileAdvanced(username, 'nickname', value);
openUserAccount(username, userAccountReturnPage || 'profilePage');
}

function saveContactPrivacy(){
const username = currentViewedUsername();
writeProfileAdvanced(username, 'privacy', {
online:Boolean(byId('contactPrivacyOnline') && byId('contactPrivacyOnline').checked),
read:Boolean(byId('contactPrivacyRead') && byId('contactPrivacyRead').checked),
typing:Boolean(byId('contactPrivacyTyping') && byId('contactPrivacyTyping').checked)
});
}

function saveContactTranslateLanguage(){
const username = currentViewedUsername();
const value = byId('contactTranslateLanguage') ? byId('contactTranslateLanguage').value : 'Hindi';
writeProfileAdvanced(username, 'translateLanguage', value);
alert('Translate language saved.');
}

function saveContactLabel(){
const username = currentViewedUsername();
const value = byId('contactRelationshipLabel') ? byId('contactRelationshipLabel').value : 'Friend';
writeProfileAdvanced(username, 'label', value);
alert('Relationship label saved.');
}

function saveContactNotificationPrefs(){
const username = currentViewedUsername();
const prefs = {
messageMute:Boolean(byId('messageMuteToggle') && byId('messageMuteToggle').checked),
messageVibrate:Boolean(byId('messageVibrateToggle') && byId('messageVibrateToggle').checked),
messageTone:byId('messageToneSelect') ? byId('messageToneSelect').value : 'Default',
callRingtone:byId('contactCallRingtoneSelect') ? byId('contactCallRingtoneSelect').value : 'Default',
callVibration:Boolean(byId('callVibrationToggle') && byId('callVibrationToggle').checked),
statusMute:Boolean(byId('statusMuteToggle') && byId('statusMuteToggle').checked)
};
writeProfileAdvanced(username, 'notifications', prefs);
writeProfileAdvanced(username, 'ringtone', prefs.callRingtone);
}

function saveContactRingtone(){
const username = currentViewedUsername();
const value = byId('contactCallRingtoneSelect') ? byId('contactCallRingtoneSelect').value : 'Default';
writeProfileAdvanced(username, 'ringtone', value);
alert('Ringtone saved.');
}

function exportViewedProfileChat(){
const username = currentViewedUsername();
const me = currentUser ? currentUser.username : '';
const messages = readLocalMessages().filter((message) => (
(message.sender === me && message.receiver === username) ||
(message.sender === username && message.receiver === me) ||
(message.sender === 'You' && message.receiver === username)
));
const text = messages.length
? messages.map((message) => `[${new Date(message.createdAt || Date.now()).toLocaleString()}] ${message.sender || 'Unknown'}: ${message.text || message.fileName || message.messageType || ''}`).join('\n')
: `No local chat messages with @${username}.`;
const blob = new Blob([text], { type:'text/plain' });
const url = URL.createObjectURL(blob);
const link = document.createElement('a');
link.href = url;
link.download = `shashi-chat-${username}.txt`;
document.body.appendChild(link);
link.click();
link.remove();
URL.revokeObjectURL(url);
}

async function copyCurrentProfileNumber(){
const phone = viewedProfileUser ? visibleContactPhone(viewedProfileUser) : '';
if(!phone){
alert('Mobile number not available.');
return;
}
if(navigator.clipboard){
await navigator.clipboard.writeText(phone);
}
alert('Mobile number copied.');
}

function blockViewedProfileUser(){
currentChatUser = currentViewedUsername();
blockCurrentChatUser();
}

function setAuthMode(mode){
authMode = mode;

const signupOnly = document.querySelectorAll('.signup-only');
signupOnly.forEach((item)=>{
item.classList.toggle('hidden', mode !== 'signup');
});

byId('loginMode').classList.toggle('active', mode === 'login');
byId('signupMode').classList.toggle('active', mode === 'signup');
byId('authSubmit').innerText = mode === 'login' ? 'Login' : 'Create account';
byId('authMessage').innerText = '';
}

async function syncFirebaseAuth(mode, email, password){
const firebase = await firebaseReadyPromise;
if(!firebase || !firebase.auth || !firebaseReady(firebase)){
return null;
}

try{
if(mode === 'signup'){
return await firebase.createUserWithEmailAndPassword(firebase.auth, email, password);
}
return await firebase.signInWithEmailAndPassword(firebase.auth, email, password);
}catch(error){
if(mode === 'signup' && error && error.code === 'auth/email-already-in-use'){
return firebase.signInWithEmailAndPassword(firebase.auth, email, password);
}
console.warn('Firebase Auth sync skipped:', error.message);
return null;
}
}

function firebaseReady(firebase){
return Boolean(firebase && firebase.firebaseReady && firebase.auth);
}

async function registerDevicePushToken(){
if(!currentUser || !authToken) return;
try{
const firebase = await firebaseReadyPromise;
const vapidKey = (window.SHASHI_FIREBASE_VAPID_KEY || '').trim();
if(!firebase || !firebase.requestShashiPushToken || !vapidKey) return;
const token = await firebase.requestShashiPushToken(vapidKey);
if(!token) return;
await fetch(`${API_BASE_URL}/api/notifications/push/register`, {
method:'POST',
headers:{ 'Content-Type':'application/json', ...authHeaders() },
body:JSON.stringify({ username:currentUser.username, token })
});
if(firebase.listenForShashiPushMessages){
firebase.listenForShashiPushMessages((payload) => {
const body = payload && payload.notification ? payload.notification.body : 'New notification';
setStatus(body, true);
loadNotifications();
});
}
}catch(error){
console.warn('Push notification registration skipped:', error.message);
}
}

async function handleAuth(event){
event.preventDefault();

const username = byId('username').value.trim();
const email = byId('email').value.trim();
const phone = byId('phone').value.trim();
const password = byId('password').value.trim();
const authMessage = byId('authMessage');

if(!email || !phone || !password || (authMode === 'signup' && !username)){
authMessage.innerText = 'Please fill all required fields.';
return;
}

const payload = authMode === 'signup'
? { username, email, phone, password }
: { email, phone, password };

try{
const response = await fetch(`${API_BASE_URL}/api/auth/${authMode}`, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(payload)
});

const data = await response.json();

if(!response.ok){
throw new Error(data.message || 'Authentication failed');
}

if(authMode === 'signup'){
syncFirebaseAuth('signup', email, password);
authMessage.innerText = 'Account created. You can login now.';
setAuthMode('login');
byId('password').value = '';
return;
}

if(data.requiresTwoFactor){
authChallengeMode = 'two_factor';
authChallengeUserId = data.userId;
showAuthCodePanel(data.testingCode);
authMessage.innerText = `Enter the 2FA code sent by ${data.method}.${data.testingCode ? ` Testing code: ${data.testingCode}` : ''}`;
return;
}

syncFirebaseAuth('login', email, password);
completeLogin(data);
}catch(error){
authMessage.innerText = error.message === 'Failed to fetch'
? `Backend is not running or Backend URL is wrong. Start the app or open index.html?resetBackend=1. Current backend: ${API_BASE_URL}`
: error.message;
}
}

function completeLogin(data){
currentUser = data.user;
authToken = data.token;
localStorage.setItem('shashiUser', JSON.stringify(currentUser));
localStorage.setItem('shashiToken', authToken);
if(socket){
socket.auth = { token: authToken };
socket.disconnect().connect();
}
authChallengeMode = '';
authChallengeUserId = '';
const panel = byId('authCodePanel');
if(panel) panel.classList.add('hidden');
updateAuthView();
registerPresence();
registerDevicePushToken();
loadCurrentUser();
loadUsers();
loadMessages();
}

function showAuthCodePanel(testingCode){
const panel = byId('authCodePanel');
const input = byId('authCodeInput');
if(panel) panel.classList.remove('hidden');
if(input){
input.value = testingCode || '';
input.focus();
}
byId('newPasswordInput').classList.toggle('hidden', authChallengeMode !== 'password_reset');
}

async function startPhoneOtpLogin(){
const phone = byId('phone').value.trim();
if(!phone){
byId('authMessage').innerText = 'Enter your mobile number first.';
return;
}
try{
const response = await fetch(`${API_BASE_URL}/api/account/otp/request`, {
method:'POST',
headers:{'Content-Type':'application/json'},
body:JSON.stringify({ phone })
});
const data = await response.json();
if(!response.ok) throw new Error(data.message);
authChallengeMode = 'phone_login';
showAuthCodePanel(data.testingCode);
byId('authMessage').innerText = `${data.message}${data.testingCode ? ` Testing code: ${data.testingCode}` : ''}`;
}catch(error){
byId('authMessage').innerText = error.message;
}
}

async function startPasswordReset(){
const email = byId('email').value.trim();
if(!email){
byId('authMessage').innerText = 'Enter your email first.';
return;
}
try{
const response = await fetch(`${API_BASE_URL}/api/account/password/request`, {
method:'POST',
headers:{'Content-Type':'application/json'},
body:JSON.stringify({ email })
});
const data = await response.json();
if(!response.ok) throw new Error(data.message);
authChallengeMode = 'password_reset';
showAuthCodePanel(data.testingCode);
byId('authMessage').innerText = `${data.message}${data.testingCode ? ` Testing code: ${data.testingCode}` : ''}`;
}catch(error){
byId('authMessage').innerText = error.message;
}
}

async function verifyAuthCode(){
const code = byId('authCodeInput').value.trim();
let path = '/api/account/otp/verify';
let payload = { phone: byId('phone').value.trim(), code };
if(authChallengeMode === 'password_reset'){
path = '/api/account/password/reset';
payload = { email: byId('email').value.trim(), code, password: byId('newPasswordInput').value };
}
if(authChallengeMode === 'two_factor'){
path = '/api/account/2fa/verify';
payload = { userId: authChallengeUserId, code };
}
try{
const response = await fetch(`${API_BASE_URL}${path}`, {
method:'POST',
headers:{'Content-Type':'application/json'},
body:JSON.stringify(payload)
});
const data = await response.json();
if(!response.ok) throw new Error(data.message);
if(data.token) completeLogin(data);
else{
byId('authMessage').innerText = data.message;
byId('authCodePanel').classList.add('hidden');
authChallengeMode = '';
}
}catch(error){
byId('authMessage').innerText = error.message;
}
}

function logout(){
if(authToken){
fetch(`${API_BASE_URL}/api/auth/logout`, {
method: 'POST',
headers: authHeaders()
}).catch(()=>{});
}

firebaseReadyPromise.then((firebase) => {
if(firebase && firebase.auth && firebase.signOut){
firebase.signOut(firebase.auth).catch(() => {});
}
});

currentUser = null;
authToken = '';
if(socket) socket.disconnect();
appUsers = [];
localStorage.removeItem('shashiUser');
localStorage.removeItem('shashiToken');
updateAuthView();
renderEmptyMessage('Login to load your saved chat.');
renderSettingsSummary();
}

async function loadCurrentUser(){
if(!authToken) return;

try{
const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
headers: authHeaders()
});

if(!response.ok){
throw new Error('Unable to load profile');
}

currentUser = await response.json();
localStorage.setItem('shashiUser', JSON.stringify(currentUser));
updateAuthView();
}catch(error){
console.error(error);
}
}

async function loadUsers(){
if(!authToken) return;

try{
const response = await fetch(`${API_BASE_URL}/api/auth/users`, {
headers: authHeaders()
});

if(!response.ok){
throw new Error('Unable to load users');
}

appUsers = await response.json();
renderUsers();
loadFriendState();
}catch(error){
console.error(error);
}
}

async function saveProfile(event){
event.preventDefault();

if(!authToken){
byId('profileMessage').innerText = 'Login first.';
return;
}

const username = byId('profileUsername').value.trim();
const email = byId('profileEmail').value.trim();
const phone = byId('profilePhone').value.trim();
const about = byId('profileAbout') ? byId('profileAbout').value.trim() : '';
const bio = byId('profileBio') ? byId('profileBio').value.trim() : '';

try{
const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
method: 'PUT',
headers: {
...authHeaders(),
'Content-Type': 'application/json'
},
body: JSON.stringify({ username, email, phone, about, bio })
});

const data = await response.json();

if(!response.ok){
throw new Error(data.message || 'Could not update profile');
}

currentUser = data.user;
localStorage.setItem('shashiUser', JSON.stringify(currentUser));
byId('profileMessage').innerText = 'Profile saved.';
updateAuthView();
loadUsers();
loadMessages();
}catch(error){
byId('profileMessage').innerText = error.message;
}
}

async function uploadProfilePhoto(event){
event.preventDefault();

if(!authToken){
byId('photoMessage').innerText = 'Login first.';
return;
}

const file = byId('profilePhotoInput').files[0];
if(!file){
byId('photoMessage').innerText = 'Choose a photo first.';
return;
}

const formData = new FormData();
formData.append('profilePhoto', file);

try{
const response = await fetch(`${API_BASE_URL}/api/auth/profile/photo`, {
method: 'POST',
headers: authHeaders(),
body: formData
});

const data = await response.json();

if(!response.ok){
throw new Error(data.message || 'Could not upload photo');
}

currentUser = data.user;
localStorage.setItem('shashiUser', JSON.stringify(currentUser));
byId('photoMessage').innerText = 'Photo uploaded.';
updateAuthView();
loadUsers();
}catch(error){
byId('photoMessage').innerText = error.message;
}
}

function registerPresence(){
if(socket && currentUser && currentUser._id){
socket.emit('register_user', currentUser._id);
}
}

function renderConversationMessageList(messages, emptyText){
const container = byId('chatMessages');
if(!container) return;
container.innerHTML = '';
currentConversationMessages = messages;
if(!messages.length){
renderEmptyMessage(emptyText);
return;
}
messages.forEach((message)=>{
const type =
message.sender === currentUser.username || message.sender === 'You'
? 'sent'
: 'received';
appendMessage(message, type);
});
}

async function loadMessages(){
if(!currentUser){
renderEmptyMessage('Login to load your saved chat.');
return;
}

const localMessages = getLocalConversation(currentUser.username, currentChatUser);
if(localMessages.length > 0){
markChatRead(currentChatUser);
renderConversationMessageList(localMessages, `No messages with ${chatDisplayName(currentChatUser)} yet.`);
refreshChatListTimes();
}

try{
const params = new URLSearchParams({
sender: currentUser.username,
receiver: currentChatUser,
limit: '150'
});
const response = await fetchWithTimeout(`${API_BASE_URL}/api/messages?${params.toString()}`, {
headers: authHeaders()
}, 6000);

if(!response.ok){
throw new Error('Unable to load messages');
}

const messages = [
...messagesWithoutDuplicates(await response.json(), getLocalConversation(currentUser.username, currentChatUser))
];
const container = byId('chatMessages');
container.innerHTML = '';

const visibleMessages = messages.filter((message)=>{
if(String(currentChatUser).startsWith('group:')){
return message.receiver === currentChatUser;
}

const betweenCurrentChat =
(message.sender === currentUser.username && message.receiver === currentChatUser) ||
(message.sender === currentChatUser && message.receiver === currentUser.username);

const oldDemoMessages =
(message.sender === 'You' && message.receiver === currentChatUser);

return betweenCurrentChat || oldDemoMessages;
});
currentConversationMessages = visibleMessages;
saveLocalMessagesBulk(visibleMessages);
markChatRead(currentChatUser);
renderUsers();

if(visibleMessages.length === 0){
renderEmptyMessage(`No messages with ${chatDisplayName(currentChatUser)} yet.`);
return;
}

renderConversationMessageList(visibleMessages, `No messages with ${chatDisplayName(currentChatUser)} yet.`);

setStatus('Backend online', true);
}catch(error){
console.error(error);
setStatus('Backend offline', false);
if(localMessages.length > 0){
markChatRead(currentChatUser);
renderConversationMessageList(localMessages, `No messages with ${chatDisplayName(currentChatUser)} yet.`);
refreshChatListTimes();
return;
}
renderEmptyMessage('Could not load messages. Start backend and MongoDB.');
}
}

function openChat(user){
clearMessageSelection();
clearPendingChatAttachments();
currentChatUser = user;
markChatRead(user);
resumeChatGameForCurrentChat(false);
const displayName = chatDisplayName(user);
byId('chatUser').innerText = displayName;
const label = byId('chatUserLabel');
if(label){
label.innerText = isSelfChatUser(user)
? 'Message yourself'
: currentUser
? `Chat with @${user}`
: 'Sign in to save messages';
}
const avatar = byId('chatPersonAvatar');
if(avatar){
if(isSelfChatUser(user) && currentUser.profilePhoto){
avatar.innerHTML = `<img src="${photoUrl(currentUser.profilePhoto)}" alt="${escapeHtml(currentUser.username)}">`;
}else{
avatar.innerHTML = `<span>${escapeHtml(displayName.charAt(0).toUpperCase())}</span>`;
}
}

refreshChatListTimes();
document.querySelectorAll('.chat-item').forEach((item)=>{
item.classList.toggle('selected', item.dataset.user === user);
});

showPage('conversationPage');
updateChatMenuState();
applyChatTheme();
loadMessages();
}

function saveMessageToBackend(chatMessage){
fetchWithTimeout(`${API_BASE_URL}/api/messages`, {
method: 'POST',
headers: { 'Content-Type': 'application/json', ...authHeaders() },
body: JSON.stringify(chatMessage)
}, 6000).then((response)=>{
if(!response.ok){
throw new Error('Unable to save message');
}

setStatus('Backend online', true);
}).catch((error)=>{
console.warn('Message saved offline:', error.message);
setStatus('Saved offline. Backend slow.', false);
});
}

function pendingAttachmentIcon(messageType){
if(messageType === 'image') return 'image';
if(messageType === 'video') return 'video';
if(messageType === 'voice') return 'microphone';
return 'file-lines';
}

function renderPendingChatAttachments(){
const preview = byId('chatAttachmentPreview');
const wrapper = preview ? preview.closest('.message-input') : null;
document.body.classList.toggle('chat-has-pending-attachment', pendingChatAttachments.length > 0);
if(wrapper){
wrapper.classList.toggle('has-pending-attachment', pendingChatAttachments.length > 0);
}
if(!preview) return;
if(!pendingChatAttachments.length){
preview.classList.add('hidden');
preview.innerHTML = '';
return;
}

preview.classList.remove('hidden');
preview.innerHTML = pendingChatAttachments.map((item, index) => {
const name = escapeHtml(item.fileName || 'Attachment');
const typeLabel = item.messageType === 'file' ? 'Document ready to send' : `${item.messageType} ready to send`;
let thumb = `<i class="fa-solid fa-${pendingAttachmentIcon(item.messageType)}"></i>`;
if(item.messageType === 'image'){
thumb = `<img src="${item.previewUrl}" alt="${name}">`;
}else if(item.messageType === 'video'){
thumb = `<video src="${item.previewUrl}" muted playsinline></video>`;
}
return `
<div class="pending-attachment-card">
<div class="pending-attachment-thumb">${thumb}</div>
<div class="pending-attachment-info">
<strong>${name}</strong>
<small>${escapeHtml(typeLabel)}</small>
</div>
<button type="button" class="pending-attachment-remove" onclick="removePendingChatAttachment(${index})" title="Remove">
<i class="fa-solid fa-xmark"></i>
</button>
</div>`;
}).join('');
}

function clearPendingChatAttachments(){
pendingChatAttachments.forEach((item) => {
if(item.previewUrl){
URL.revokeObjectURL(item.previewUrl);
}
});
pendingChatAttachments = [];
renderPendingChatAttachments();
updateChatActionButton();
}

function removePendingChatAttachment(index){
const item = pendingChatAttachments[index];
if(item && item.previewUrl){
URL.revokeObjectURL(item.previewUrl);
}
pendingChatAttachments = pendingChatAttachments.filter((_, itemIndex) => itemIndex !== index);
renderPendingChatAttachments();
updateChatActionButton();
}

async function preparePendingChatAttachments(files){
const selectedFiles = Array.from(files || []);
if(!selectedFiles.length) return;
clearPendingChatAttachments();

const prepared = [];
for(const file of selectedFiles){
await validateChatAttachmentFile(file);
prepared.push({
id:`pending_${Date.now()}_${Math.random().toString(36).slice(2)}`,
file,
previewUrl:URL.createObjectURL(file),
messageType:chatMessageTypeForFile(file),
fileName:file.name,
mediaType:file.type || 'application/octet-stream'
});
}

pendingChatAttachments = prepared;
renderPendingChatAttachments();
updateChatActionButton();
setStatus(prepared.length === 1 ? 'Attachment ready. Press send.' : `${prepared.length} attachments ready. Press send.`, true);
}

async function sendPendingChatAttachments(caption = ''){
if(sendingPendingAttachments || !pendingChatAttachments.length) return;
sendingPendingAttachments = true;
setStatus('Sending attachment...', true);

const attachmentsToSend = [...pendingChatAttachments];
try{
let sentCount = 0;
for(const item of attachmentsToSend){
const uploaded = await uploadChatAttachment(item.file);
sendMediaPayload({
text:item.messageType === 'file' ? (caption || `Document: ${item.fileName}`) : caption,
messageType:item.messageType,
mediaUrl:uploaded.url,
mediaType:item.mediaType,
fileName:item.fileName
});
sentCount += 1;
if(uploaded.warning){
setStatus('Sent using local file preview. Cloud upload was not available.', false);
}
}
clearPendingChatAttachments();
if(sentCount > 1){
setStatus(`${sentCount} attachments sent`, true);
}
}catch(error){
setStatus('Attachment was not sent.', false);
alert(error.message);
}finally{
sendingPendingAttachments = false;
}
}

function updateChatActionButton(){
const input = byId('chatInput');
const sendButton = byId('sendButton');
if(!input || !sendButton) return;
const hasText = input.value.trim().length > 0;
const hasAttachment = pendingChatAttachments.length > 0;
const canSend = hasText || hasAttachment;
sendButton.classList.toggle('has-text', canSend);
sendButton.title = hasAttachment ? 'Send attachment' : hasText ? 'Send message' : 'Audio message';
sendButton.setAttribute('aria-label', sendButton.title);
sendButton.innerHTML = canSend
? '<i class="fa-solid fa-paper-plane"></i>'
: '<i class="fa-solid fa-microphone"></i>';
}

async function sendChat(){
if(!currentUser){
alert('Please login or signup first.');
return;
}

const input = byId('chatInput');
const rawMessage = input.value.trim();
const message = appendCalculationResult(rawMessage);

if(pendingChatAttachments.length){
input.value = '';
updateCalculatorPreview();
updateChatActionButton();
await sendPendingChatAttachments(message);
return;
}

if(rawMessage === ''){
setStatus('Hold to record audio message.', false);
updateChatActionButton();
return;
}

const chatMessage = {
clientId: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
sender: currentUser.username,
receiver: currentChatUser,
groupId: String(currentChatUser).startsWith('group:') ? currentGroupId() : '',
text: message,
messageType: 'text',
createdAt: new Date().toISOString(),
...extractTags(message)
};

input.value = '';
updateCalculatorPreview();
updateChatActionButton();
appendMessage(chatMessage, 'sent');
saveLocalMessage(chatMessage);
renderUsers();
if(socket){
socket.emit('send_message', chatMessage);
}
saveMessageToBackend(chatMessage);

moderateTextBeforeSend(message).then((moderation)=>{
if(!moderation.allowed){
setStatus(moderation.message || 'Message needs review', false);
}
});
}

async function checkBackend(){
try{
const response = await fetch(`${API_BASE_URL}/api/health`);
const health = await response.json();
setStatus(response.ok && health.ok ? 'Backend online' : 'Backend issue', response.ok && health.ok);
}catch(error){
setStatus('Backend offline', false);
}
}

document.addEventListener('DOMContentLoaded', ()=>{
const apiBaseInput = byId('apiBaseInput');
if(apiBaseInput){
apiBaseInput.value = API_BASE_URL;
}

byId('authForm').addEventListener('submit', handleAuth);
byId('loginMode').addEventListener('click', ()=>setAuthMode('login'));
byId('signupMode').addEventListener('click', ()=>setAuthMode('signup'));
byId('logoutButton').addEventListener('click', logout);
byId('profileForm').addEventListener('submit', saveProfile);
byId('photoForm').addEventListener('submit', uploadProfilePhoto);
const profileStatusInput = byId('profileStatusInput');
if(profileStatusInput){
profileStatusInput.addEventListener('change', () => {
const file = profileStatusInput.files[0];
uploadStoryFile(file, '', 'photoMessage', () => {
profileStatusInput.value = '';
});
});
}

byId('chatInput').addEventListener('keydown', function(e){
if(e.key === 'Enter'){
e.preventDefault();
sendChat();
}
});

byId('chatInput').addEventListener('input', function(){
updateCalculatorPreview();
updateChatActionButton();
if(socket && currentUser){
socket.emit('typing', {
sender: currentUser.username,
receiver: currentChatUser
});
}
});

function updateChatKeyboardOffset(){
let offset = 0;
if(window.visualViewport){
offset = Math.max(0, window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop);
}
document.documentElement.style.setProperty('--chat-keyboard-offset', `${Math.round(offset)}px`);
}

if(window.visualViewport){
window.visualViewport.addEventListener('resize', updateChatKeyboardOffset);
window.visualViewport.addEventListener('scroll', updateChatKeyboardOffset);
}
window.addEventListener('resize', updateChatKeyboardOffset);
byId('chatInput').addEventListener('focus', () => {
setTimeout(updateChatKeyboardOffset, 80);
setTimeout(() => {
const messages = byId('chatMessages');
if(messages) messages.scrollTop = messages.scrollHeight;
}, 120);
});
byId('chatInput').addEventListener('blur', () => {
setTimeout(updateChatKeyboardOffset, 120);
});
updateChatKeyboardOffset();
setupSwipeBackNavigation();

const navButtons = document.querySelectorAll('.nav-btn');
navButtons.forEach((btn)=>{
btn.addEventListener('click', ()=>{
setActiveButton(navButtons, btn, 'active');
});
});

const mobileButtons = document.querySelectorAll('.mobile-nav button');
mobileButtons.forEach((btn)=>{
btn.addEventListener('click', ()=>{
setActiveButton(mobileButtons, btn, 'active-mobile');
});
});

if(mobileButtons.length > 0){
mobileButtons[0].classList.add('active-mobile');
}

if(socket){
socket.on('receive_message', (message)=>{
if(!currentUser || message.sender === currentUser.username) return;

const isGroupMessage = String(message.receiver || '').startsWith('group:');
const isActiveGroupChat = isGroupMessage && message.receiver === currentChatUser;
const isDirectToMe = message.receiver === currentUser.username;

if(isGroupMessage || isDirectToMe){
saveLocalMessage(message);
if(isActiveGroupChat || (!isGroupMessage && message.sender === currentChatUser && currentPageId === 'conversationPage')){
markChatRead(isGroupMessage ? message.receiver : message.sender);
}
renderUsers();
}

if(isGroupMessage){
if(isActiveGroupChat){
appendMessage(message, 'received');
}
return;
}

if(!isDirectToMe || message.sender !== currentChatUser) return;

appendMessage(message, 'received');
socket.emit('message_seen', {
messageId: message._id || '',
reader: currentUser.username,
sender: message.sender
});
});

socket.on('typing_update', (typing)=>{
if(!currentUser || typing.receiver !== currentUser.username || typing.sender !== currentChatUser){
return;
}
const label = byId('chatUserLabel');
if(label){
label.innerText = `${typing.sender} is typing...`;
setTimeout(() => {
if(currentUser) label.innerText = `You are ${currentUser.username}`;
}, 1600);
}
});

socket.on('message_seen_update', (seen)=>{
if(currentUser && seen.sender === currentUser.username){
setStatus(`${seen.reader} saw your message`, true);
}
});

socket.on('game_action', applyChatGameSocket);

socket.on('presence_update', (presence)=>{
appUsers = appUsers.map((user)=>{
if(user._id !== presence.userId){
return user;
}

return {
...user,
online: presence.online,
lastSeen: presence.lastSeen || user.lastSeen
};
});

if(currentUser && currentUser._id === presence.userId){
currentUser.online = presence.online;
currentUser.lastSeen = presence.lastSeen || currentUser.lastSeen;
localStorage.setItem('shashiUser', JSON.stringify(currentUser));
updateAuthView();
}

renderUsers();
});
}

setAuthMode('login');
updateAuthView();
registerPresence();
registerDevicePushToken();
keepBackendWarm();
setInterval(keepBackendWarm, 240000);
loadCurrentUser();
loadUsers();
showPage('chatPage');
checkBackend();
});


/* SHASHI_SOCIAL_FEATURES */
let notifications = [];

function isEmojiOnlyText(text){
  const value = String(text || '').trim();
  if(!value) return false;
  try{
    const remainder = value
      .replace(/[#*0-9]\ufe0f?\u20e3/gu, '')
      .replace(/[\u{1F000}-\u{1FAFF}]/gu, '')
      .replace(/[\u2600-\u27BF]/gu, '')
      .replace(/[\u00a9\u00ae\u203c\u2049\u2122\u2139\u3030\u303d\u3297\u3299]/g, '')
      .replace(/[\s\u200d\ufe0f\u20e3\u{E0020}-\u{E007F}\u{1F3FB}-\u{1F3FF}\u{1F9B0}-\u{1F9B3}]/gu, '');
    return remainder.length === 0;
  }catch(error){
    return /^[\s\u200d\ufe0f\u2600-\u27BF\u{1F000}-\u{1FAFF}]+$/u.test(value);
  }
}

function renderRichMessage(message, type){
  const msg = document.createElement('div');
  msg.classList.add('message', type);
  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  const data = message && typeof message === 'object'
    ? message
    : {
      text:String(message || ''),
      sender:type === 'sent' ? (currentUser && currentUser.username || 'You') : currentChatUser,
      receiver:type === 'sent' ? currentChatUser : (currentUser && currentUser.username || ''),
      messageType:'text',
      createdAt:new Date().toISOString()
    };
  if(!data.createdAt) data.createdAt = new Date().toISOString();
  if(!data.messageType) data.messageType = 'text';
  if(isPinnedMessage(data)) msg.classList.add('pinned-message');
  const emojiOnly = data.messageType === 'text' && isEmojiOnlyText(data.text);
  if(emojiOnly) msg.classList.add('emoji-only-message');

  if(data.messageType === 'image'){
    bubble.classList.add('media-message');
    bubble.innerHTML = `<img src="${data.mediaUrl}" alt="${escapeHtml(data.fileName || 'Image')}"><small>${escapeHtml(data.text || data.fileName || 'Image')}</small>`;
  }else if(data.messageType === 'video'){
    bubble.classList.add('media-message');
    bubble.innerHTML = `<video src="${data.mediaUrl}" controls></video><small>${escapeHtml(data.text || data.fileName || 'Video')}</small>`;
  }else if(data.messageType === 'voice'){
    bubble.classList.add('media-message');
    bubble.innerHTML = `<audio src="${data.mediaUrl}" controls></audio><small>${escapeHtml(data.fileName || 'Voice note')}</small>`;
  }else if(data.messageType === 'location' || data.messageType === 'liveLocation'){
    const url = linkMatches(data.text)[0] || data.mediaUrl || '';
    const label = data.messageType === 'liveLocation' ? 'Live location' : String(data.text || '').startsWith('Map:') ? 'Map' : 'Location';
    bubble.classList.add('location-message');
    bubble.innerHTML = `<a href="${escapeHtml(url)}" target="_blank" rel="noopener"><i class="fa-solid fa-map-location-dot"></i><span>${escapeHtml(label)}</span><small>${escapeHtml(url || data.text || 'Open map')}</small></a>`;
  }else if(data.messageType === 'contact'){
    const cleanText = escapeHtml(data.text || 'Contact').replace(/\n/g, '<br>');
    bubble.classList.add('contact-card-message');
    bubble.innerHTML = `<div><i class="fa-solid fa-address-book"></i><span>${cleanText}</span></div>`;
  }else if(data.messageType === 'file'){
    bubble.classList.add('file-message');
    bubble.innerHTML = `<a href="${data.mediaUrl}" download="${escapeHtml(data.fileName || 'file')}"><i class="fa-solid fa-file"></i> ${escapeHtml(data.fileName || 'Download file')}</a>`;
  }else if(emojiOnly){
    bubble.innerHTML = `<span class="emoji-only-content">${escapeHtml(data.text || '')}</span>`;
  }else{
    bubble.innerText = data.text || '';
  }

  const time = document.createElement('span');
  time.className = 'message-time';
  time.textContent = formatMessageTime(data.createdAt);
  bubble.appendChild(time);
  msg.appendChild(bubble);
  setupMessageSelection(msg, data);
  return msg;
}

createMessageElement = function(message, type){
  return renderRichMessage(message, type);
};

function emojiFromCodes(codes){
  return codes.map((code) => String.fromCodePoint(code));
}

function flagEmoji(code){
  return code
    .toUpperCase()
    .split('')
    .map((letter) => String.fromCodePoint(0x1F1E6 + letter.charCodeAt(0) - 65))
    .join('');
}

const emojiCategories = [
  {
    name:'Smileys',
    icon:String.fromCodePoint(0x1F600),
    emojis:emojiFromCodes([
      0x1F600,0x1F603,0x1F604,0x1F601,0x1F606,0x1F605,0x1F923,0x1F602,
      0x1F642,0x1F643,0x1FAE0,0x1F609,0x1F60A,0x1F607,0x1F970,0x1F60D,
      0x1F929,0x1F618,0x1F617,0x263A,0x1F61A,0x1F619,0x1F972,0x1F60B,
      0x1F61B,0x1F61C,0x1F92A,0x1F61D,0x1F911,0x1F917,0x1F92D,0x1FAE2,
      0x1FAE3,0x1F92B,0x1F914,0x1FAE1,0x1F910,0x1F928,0x1F610,0x1F611,
      0x1F636,0x1FAE5,0x1F60F,0x1F612,0x1F644,0x1F62C,0x1F925,0x1FAE8,
      0x1F60C,0x1F614,0x1F62A,0x1F924,0x1F634,0x1F637,0x1F912,0x1F915,
      0x1F922,0x1F92E,0x1F927,0x1F975,0x1F976,0x1F974,0x1F635,0x1F92F,
      0x1F920,0x1F973,0x1F978,0x1F60E,0x1F913,0x1F9D0,0x1F615,0x1FAE4,
      0x1F61F,0x1F641,0x2639,0x1F62E,0x1F62F,0x1F632,0x1F633,0x1F97A,
      0x1F979,0x1F626,0x1F627,0x1F628,0x1F630,0x1F625,0x1F622,0x1F62D,
      0x1F631,0x1F616,0x1F623,0x1F61E,0x1F613,0x1F629,0x1F62B,0x1F971,
      0x1F624,0x1F621,0x1F620,0x1F92C,0x1F608,0x1F47F,0x1F480,0x2620
    ])
  },
  {
    name:'People',
    icon:String.fromCodePoint(0x1F44B),
    emojis:emojiFromCodes([
      0x1F44B,0x1F91A,0x1F590,0x270B,0x1F596,0x1FAF1,0x1FAF2,0x1FAF3,
      0x1FAF4,0x1FAF7,0x1FAF8,0x1F44C,0x1F90C,0x1F90F,0x270C,0x1F91E,
      0x1FAF0,0x1F91F,0x1F918,0x1F919,0x1F448,0x1F449,0x1F446,0x1F595,
      0x1F447,0x261D,0x1FAF5,0x1F44D,0x1F44E,0x270A,0x1F44A,0x1F91B,
      0x1F91C,0x1F44F,0x1F64C,0x1FAF6,0x1F450,0x1F932,0x1F91D,0x1F64F,
      0x270D,0x1F485,0x1F4AA,0x1F9BE,0x1F9BF,0x1F9B5,0x1F9B6,0x1F442,
      0x1F9BB,0x1F443,0x1F9E0,0x1FAC0,0x1FAC1,0x1F9B7,0x1F9B4,0x1F440,
      0x1F441,0x1F445,0x1F444,0x1FAE6,0x1F476,0x1F9D2,0x1F466,0x1F467,
      0x1F9D1,0x1F471,0x1F468,0x1F9D4,0x1F469,0x1F9D3,0x1F474,0x1F475,
      0x1F64D,0x1F64E,0x1F645,0x1F646,0x1F481,0x1F64B,0x1F9CF,0x1F647,
      0x1F926,0x1F937,0x1F46E,0x1F575,0x1F482,0x1F477,0x1F934,0x1F478,
      0x1F473,0x1F472,0x1F9D5,0x1F935,0x1F470,0x1F930,0x1FAC3,0x1FAC4
    ])
  },
  {
    name:'Animals',
    icon:String.fromCodePoint(0x1F43B),
    emojis:emojiFromCodes([
      0x1F436,0x1F431,0x1F42D,0x1F439,0x1F430,0x1F98A,0x1F43B,0x1F43C,
      0x1F428,0x1F42F,0x1F981,0x1F42E,0x1F437,0x1F43D,0x1F438,0x1F435,
      0x1F648,0x1F649,0x1F64A,0x1F412,0x1F414,0x1F427,0x1F426,0x1F424,
      0x1F423,0x1F425,0x1F986,0x1F9A2,0x1F989,0x1F9A4,0x1FAB6,0x1F43A,
      0x1F417,0x1F434,0x1F984,0x1F41D,0x1FAB2,0x1F41B,0x1F98B,0x1F40C,
      0x1FAB1,0x1F41E,0x1F41C,0x1FAB0,0x1F99F,0x1F997,0x1F577,0x1F578,
      0x1F982,0x1F40D,0x1F98E,0x1F996,0x1F995,0x1F419,0x1F991,0x1F990,
      0x1F99E,0x1F980,0x1F421,0x1F420,0x1F41F,0x1F42C,0x1F433,0x1F40B,
      0x1F988,0x1F9AD,0x1F40A,0x1F405,0x1F406,0x1F993,0x1F98D,0x1F9A7
    ])
  },
  {
    name:'Food',
    icon:String.fromCodePoint(0x1F354),
    emojis:emojiFromCodes([
      0x1F347,0x1F348,0x1F349,0x1F34A,0x1F34B,0x1F34C,0x1F34D,0x1F96D,
      0x1F34E,0x1F34F,0x1F350,0x1F351,0x1F352,0x1F353,0x1FAD0,0x1F95D,
      0x1F345,0x1FAD2,0x1F965,0x1F951,0x1F346,0x1F954,0x1F955,0x1F33D,
      0x1F336,0x1FAD1,0x1F952,0x1F96C,0x1F966,0x1F9C4,0x1F9C5,0x1F344,
      0x1F95C,0x1FAD8,0x1F330,0x1F35E,0x1F950,0x1F956,0x1FAD3,0x1F968,
      0x1F96F,0x1F95E,0x1F9C7,0x1F9C0,0x1F356,0x1F357,0x1F969,0x1F953,
      0x1F354,0x1F35F,0x1F355,0x1F32D,0x1F96A,0x1F32E,0x1F32F,0x1FAD4,
      0x1F959,0x1F9C6,0x1F95A,0x1F373,0x1F958,0x1F372,0x1FAD5,0x1F963,
      0x1F957,0x1F37F,0x1F9C8,0x1F9C2,0x1F96B,0x1F371,0x1F358,0x1F359,
      0x1F35A,0x1F35B,0x1F35C,0x1F35D,0x1F360,0x1F362,0x1F363,0x1F364,
      0x1F365,0x1F96E,0x1F361,0x1F95F,0x1F960,0x1F961,0x1F980,0x1F99E,
      0x1F366,0x1F367,0x1F368,0x1F369,0x1F36A,0x1F382,0x1F370,0x1F9C1,
      0x1F967,0x1F36B,0x1F36C,0x1F36D,0x1F36E,0x1F36F,0x1F37C,0x1F95B,
      0x2615,0x1FAD6,0x1F375,0x1F376,0x1F37E,0x1F377,0x1F378,0x1F379,
      0x1F37A,0x1F37B,0x1F942,0x1F943,0x1F964,0x1F9CB,0x1F9C3,0x1F9C9
    ])
  },
  {
    name:'Travel',
    icon:String.fromCodePoint(0x1F697),
    emojis:emojiFromCodes([
      0x1F30D,0x1F30E,0x1F30F,0x1F310,0x1F5FA,0x1F5FE,0x1F9ED,0x1F3D4,
      0x26F0,0x1F30B,0x1F5FB,0x1F3D5,0x1F3D6,0x1F3DC,0x1F3DD,0x1F3DE,
      0x1F3DF,0x1F3DB,0x1F3D7,0x1F9F1,0x1FAA8,0x1FAB5,0x1F6D6,0x1F3D8,
      0x1F3DA,0x1F3E0,0x1F3E1,0x1F3E2,0x1F3E3,0x1F3E4,0x1F3E5,0x1F3E6,
      0x1F3E8,0x1F3E9,0x1F3EA,0x1F3EB,0x1F3EC,0x1F3ED,0x1F3EF,0x1F3F0,
      0x1F492,0x1F5FC,0x1F5FD,0x26EA,0x1F54C,0x1F6D5,0x1F54D,0x26E9,
      0x1F6E4,0x1F6E3,0x1F5FE,0x1F391,0x1F3A1,0x1F3A2,0x1F3A0,0x26F2,
      0x26F1,0x1F682,0x1F683,0x1F684,0x1F685,0x1F686,0x1F687,0x1F688,
      0x1F689,0x1F68A,0x1F69D,0x1F69E,0x1F68B,0x1F68C,0x1F68D,0x1F68E,
      0x1F690,0x1F691,0x1F692,0x1F693,0x1F694,0x1F695,0x1F696,0x1F697,
      0x1F698,0x1F699,0x1F6FB,0x1F69A,0x1F69B,0x1F69C,0x1F3CE,0x1F3CD,
      0x1F6F5,0x1F9BD,0x1F9BC,0x1F6FA,0x1F6B2,0x1F6F4,0x1F6F9,0x1F6FC,
      0x1F68F,0x1F6E2,0x26FD,0x1F6DE,0x1F6A8,0x1F6A5,0x1F6A6,0x1F6D1,
      0x2693,0x1F6DF,0x26F5,0x1F6F6,0x1F6A4,0x1F6F3,0x26F4,0x1F6E5,
      0x1F6A2,0x2708,0x1F6E9,0x1F6EB,0x1F6EC,0x1FA82,0x1F4BA,0x1F681,
      0x1F69F,0x1F6A0,0x1F6F0,0x1F680,0x1F6F8
    ])
  },
  {
    name:'Objects',
    icon:String.fromCodePoint(0x1F4F1),
    emojis:emojiFromCodes([
      0x231A,0x1F4F1,0x1F4F2,0x1F4BB,0x2328,0x1F5A5,0x1F5A8,0x1F5B1,
      0x1F5B2,0x1F579,0x1F5DC,0x1F4BD,0x1F4BE,0x1F4BF,0x1F4C0,0x1F4FC,
      0x1F4F7,0x1F4F8,0x1F4F9,0x1F3A5,0x1F4FD,0x1F39E,0x1F4DE,0x260E,
      0x1F4DF,0x1F4E0,0x1F4FA,0x1F4FB,0x1F399,0x1F39A,0x1F39B,0x1F9ED,
      0x23F1,0x23F2,0x23F0,0x1F570,0x231B,0x23F3,0x1F4E1,0x1F50B,
      0x1FAAB,0x1F50C,0x1F4A1,0x1F526,0x1F56F,0x1FA94,0x1F9EF,0x1F6E2,
      0x1F4B8,0x1F4B5,0x1F4B4,0x1F4B6,0x1F4B7,0x1FA99,0x1F4B0,0x1F4B3,
      0x1FAAA,0x1F48E,0x2696,0x1FA9C,0x1F9F0,0x1FA9B,0x1F527,0x1FA9A,
      0x1F528,0x2692,0x1F6E0,0x26CF,0x1FA9D,0x2699,0x1F9F1,0x26D3,
      0x1FA9D,0x1F52B,0x1F4A3,0x1F9E8,0x1FA93,0x1F52A,0x1F5E1,0x2694,
      0x1F6E1,0x1F6AC,0x26B0,0x1FAA6,0x26B1,0x1F3FA,0x1F52E,0x1F4FF,
      0x1F9FF,0x1FAAC,0x1F488,0x2697,0x1F52D,0x1F52C,0x1F573,0x1FA79,
      0x1FA7A,0x1FA78,0x1FA7B,0x1FA7C,0x1F48A,0x1F489,0x1FA80,0x1FA81
    ])
  },
  {
    name:'Symbols',
    icon:String.fromCodePoint(0x2764),
    emojis:emojiFromCodes([
      0x2764,0x1F9E1,0x1F49B,0x1F49A,0x1F499,0x1F49C,0x1F90E,0x1F5A4,
      0x1FA76,0x1FA75,0x1FA77,0x1F90D,0x1F494,0x2763,0x1F495,0x1F49E,
      0x1F493,0x1F497,0x1F496,0x1F498,0x1F49D,0x1F49F,0x262E,0x271D,
      0x262A,0x1F549,0x2638,0x2721,0x1F52F,0x1F54E,0x262F,0x2626,
      0x1F6D0,0x26CE,0x2648,0x2649,0x264A,0x264B,0x264C,0x264D,
      0x264E,0x264F,0x2650,0x2651,0x2652,0x2653,0x1F194,0x269B,
      0x1F251,0x2622,0x2623,0x1F4F4,0x1F4F3,0x1F236,0x1F21A,0x1F238,
      0x1F23A,0x1F237,0x2734,0x1F19A,0x1F4AE,0x1F250,0x3299,0x3297,
      0x1F234,0x1F235,0x1F239,0x1F232,0x1F170,0x1F171,0x1F18E,0x1F191,
      0x1F198,0x26D4,0x1F4DB,0x1F6AB,0x274C,0x2B55,0x1F4A2,0x2668,
      0x1F6B7,0x1F6AF,0x1F6B3,0x1F6B1,0x1F51E,0x1F4F5,0x2757,0x2755,
      0x2753,0x2754,0x203C,0x2049,0x1F505,0x1F506,0x303D,0x26A0,
      0x1F6B8,0x1F531,0x269C,0x1F530,0x267B,0x2705,0x1F22F,0x1F4B9,
      0x2747,0x2733,0x274E,0x1F310,0x1F4A0,0x24C2,0x1F300,0x1F4A4
    ])
  },
  {
    name:'Flags',
    icon:flagEmoji('IN'),
    emojis:['IN','US','GB','CA','AU','NZ','AE','SA','QA','KW','OM','BH','SG','MY','TH','ID','PH','VN','JP','KR','CN','HK','TW','NP','LK','BD','PK','AF','IR','TR','RU','UA','DE','FR','IT','ES','PT','NL','BE','CH','SE','NO','DK','FI','IE','BR','MX','AR','ZA','EG','NG','KE'].map(flagEmoji)
  }
];

function renderEmojiPicker(){
  const picker = byId('emojiPicker');
  if(!picker || picker.dataset.ready === 'true') return;

  const tabs = document.createElement('div');
  tabs.className = 'emoji-tabs';

  const grid = document.createElement('div');
  grid.id = 'emojiGrid';
  grid.className = 'emoji-grid';

  emojiCategories.forEach((category, index) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'emoji-tab';
    tab.title = category.name;
    tab.textContent = category.icon;
    tab.addEventListener('click', () => selectEmojiCategory(index));
    tabs.appendChild(tab);
  });

  picker.appendChild(tabs);
  picker.appendChild(grid);
  picker.dataset.ready = 'true';
  selectEmojiCategory(0);
}

function selectEmojiCategory(index){
  const grid = byId('emojiGrid');
  const picker = byId('emojiPicker');
  const category = emojiCategories[index] || emojiCategories[0];
  if(!grid || !category) return;

  if(picker){
    picker.querySelectorAll('.emoji-tab').forEach((tab, tabIndex) => {
      tab.classList.toggle('active', tabIndex === index);
    });
  }

  grid.innerHTML = '';
  category.emojis.forEach((emoji) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'emoji-key';
    button.textContent = emoji;
    button.addEventListener('click', () => insertEmoji(emoji));
    grid.appendChild(button);
  });
}

function toggleEmojiPicker(){
  renderEmojiPicker();
  byId('emojiPicker').classList.toggle('hidden');
}

function insertEmoji(emoji){
  const input = byId('chatInput');
  input.value += emoji;
  input.focus();
  updateCalculatorPreview();
  updateChatActionButton();
}

function readFileAsDataUrl(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function uploadMediaToCloud(file, folder){
  const dataUrl = await readFileAsDataUrl(file);
  const response = await fetch(`${API_BASE_URL}/api/storage/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({
      file: dataUrl,
      fileName: file.name,
      mediaType: file.type || 'application/octet-stream',
      folder
    })
  });

  if(!response.ok){
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'Cloud upload failed');
  }

  return response.json();
}

function fileSizeLabel(bytes){
  if(bytes >= 1024 * 1024){
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function isVideoFile(file){
  return Boolean(file && (file.type.startsWith('video/') || /\.(mp4|mov|m4v|webm|mkv|avi)$/i.test(file.name || '')));
}

function getVideoDuration(file){
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      video.load();
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Could not read video duration'));
    }, 8000);

    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      clearTimeout(timer);
      const duration = video.duration;
      cleanup();
      Number.isFinite(duration) ? resolve(duration) : reject(new Error('Could not read video duration'));
    };
    video.onerror = () => {
      clearTimeout(timer);
      cleanup();
      reject(new Error('Could not read video duration'));
    };
    video.src = url;
  });
}

async function validateChatAttachmentFile(file){
  if(file.size > MAX_CHAT_FILE_BYTES){
    throw new Error(`${file.name} is ${fileSizeLabel(file.size)}. Please choose a file below ${fileSizeLabel(MAX_CHAT_FILE_BYTES)}.`);
  }

  if(isVideoFile(file)){
    const duration = await getVideoDuration(file);
    if(duration > MAX_CHAT_VIDEO_SECONDS){
      throw new Error(`${file.name} is longer than 15 minutes.`);
    }
  }
}

async function uploadChatAttachment(file){
  try{
    return await uploadMediaToCloud(file, 'chat');
  }catch(error){
    const url = await readFileAsDataUrl(file);
    return {
      url,
      provider:'browser-local',
      fileName:file.name,
      mediaType:file.type || 'application/octet-stream',
      warning:error.message
    };
  }
}

function chatMessageTypeForFile(file){
  if(file.type.startsWith('image/')) return 'image';
  if(isVideoFile(file)) return 'video';
  if(file.type.startsWith('audio/')) return 'voice';
  return 'file';
}

async function moderateTextBeforeSend(text){
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/ai/moderate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ text })
    }, 2500);
    if(!response.ok) return { allowed: true };
    return response.json();
  } catch(error) {
    return { allowed: true };
  }
}

function chooseChatMedia(){
  if(!currentUser){
    alert('Please login or signup first.');
    return;
  }
  byId('chatMediaInput').click();
}

function toggleAttachmentMenu(){
  if(!currentUser){
    alert('Please login or signup first.');
    return;
  }
  const menu = byId('attachmentMenu');
  if(menu) menu.classList.toggle('hidden');
}

function closeAttachmentMenu(){
  const menu = byId('attachmentMenu');
  if(menu) menu.classList.add('hidden');
}

function chooseAttachment(type){
  closeAttachmentMenu();
  if(!currentUser){
    alert('Please login or signup first.');
    return;
  }

  const pickers = {
    document: 'chatDocumentInput',
    gallery: 'chatGalleryInput',
    catalogue: 'chatCatalogueInput'
  };

  if(pickers[type]){
    const input = byId(pickers[type]);
    if(input){
      input.value = '';
      input.dataset.attachmentType = type;
      input.click();
    }
    return;
  }

  if(type === 'location'){
    sendCurrentLocationAttachment();
    return;
  }

  if(type === 'liveLocation'){
    sendLiveLocationAttachment();
    return;
  }

  if(type === 'map'){
    sendMapAttachment();
    return;
  }

  if(type === 'contacts'){
    sendContactAttachment();
    return;
  }

  if(type === 'quickReply'){
    openQuickReplyMenu();
  }
}

function sendCurrentLocationAttachment(){
  if(!navigator.geolocation){
    alert('Location is not supported on this device.');
    return;
  }
  navigator.geolocation.getCurrentPosition((position) => {
    const { latitude, longitude } = position.coords;
    const mapsUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
    sendMediaPayload({
      text: `Location: ${mapsUrl}`,
      messageType: 'location'
    });
  }, () => {
    alert('Location permission denied.');
  }, { enableHighAccuracy:true, timeout:10000 });
}

function sendLiveLocationAttachment(){
  if(!navigator.geolocation){
    alert('Live location is not supported on this device.');
    return;
  }

  navigator.geolocation.getCurrentPosition((position) => {
    const { latitude, longitude } = position.coords;
    const mapsUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
    sendMediaPayload({
      text: `Live location: ${mapsUrl}\nUpdated just now`,
      messageType: 'liveLocation'
    });
  }, () => {
    alert('Live location permission denied.');
  }, { enableHighAccuracy:true, timeout:15000 });
}

function sendMapAttachment(){
  const query = prompt('Enter place name, address, or map link. Leave empty to send current location.');
  if(query && query.trim()){
    const value = query.trim();
    const mapsUrl = /^https?:\/\//i.test(value)
      ? value
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value)}`;
    sendMediaPayload({
      text: `Map: ${mapsUrl}`,
      messageType: 'location'
    });
    return;
  }

  sendCurrentLocationAttachment();
}

async function sendContactAttachment(){
  if(navigator.contacts && navigator.contacts.select){
    try{
      const contacts = await navigator.contacts.select(['name', 'tel'], { multiple:false });
      const contact = contacts && contacts[0];
      const name = contact && contact.name ? contact.name.join(' ') : 'Contact';
      const phone = contact && contact.tel ? contact.tel.join(', ') : '';
      if(phone){
        sendMediaPayload({
          text: `Contact: ${name}\n${phone}`,
          messageType: 'contact'
        });
        return;
      }
    }catch(error){
      alert('Contact selection cancelled.');
      return;
    }
  }

  const manual = prompt('Enter contact name and phone number');
  if(manual){
    sendMediaPayload({
      text: `Contact: ${manual}`,
      messageType: 'contact'
    });
  }
}

function openQuickReplyMenu(){
  const reply = prompt('Quick reply', 'I will reply soon.');
  if(reply && reply.trim()){
    sendMediaPayload({
      text: reply.trim(),
      messageType: 'text'
    });
  }
}

function sendMediaPayload(payload){
  if(!currentUser){
    alert('Please login or signup first.');
    return;
  }

  const chatMessage = {
    clientId: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    sender: currentUser.username,
    receiver: currentChatUser,
    groupId: String(currentChatUser).startsWith('group:') ? currentGroupId() : '',
    createdAt: new Date().toISOString(),
    ...payload
  };

  appendMessage(chatMessage, 'sent');
  saveLocalMessage(chatMessage);
  renderUsers();
  if(socket) socket.emit('send_message', chatMessage);

  fetchWithTimeout(`${API_BASE_URL}/api/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(chatMessage)
  }, 6000).then((response)=>{
    if(!response.ok) throw new Error('Unable to save media');
    setStatus('Backend online', true);
  }).catch((error)=>{
    console.warn('Media saved offline:', error.message);
    setStatus('Media saved offline. Backend slow.', false);
  });
}

function messageKey(message){
  if(!message) return '';
  return String(message.clientId || message._id || `${message.sender || ''}|${message.receiver || ''}|${message.text || ''}|${message.mediaUrl || ''}|${message.fileName || ''}`);
}

function messagePreviewText(message){
  if(!message) return '';
  return String(message.text || message.fileName || message.messageType || 'Message').trim();
}

function formatMessageTime(value){
  const date = new Date(value || Date.now());
  if(Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
}

function pinnedMessagesKey(){
  return `shashiPinnedMessages:${currentUser ? currentUser.username : 'guest'}:${currentChatUser}`;
}

function getPinnedMessages(){
  try{
    return JSON.parse(localStorage.getItem(pinnedMessagesKey()) || '[]');
  }catch(error){
    return [];
  }
}

function isPinnedMessage(message){
  const key = messageKey(message);
  if(!key) return false;
  return getPinnedMessages().some((item) => item.key === key);
}

function removeMessageFromLocalStore(message){
  const key = messageKey(message);
  if(!key) return;
  const nextMessages = readLocalMessages().filter((item) => messageKey(item) !== key);
  writeLocalMessages(nextMessages);
}

function syncSelectedMessageRefs(){
  const firstSelected = selectedChatMessages[0] || null;
  selectedChatMessage = firstSelected ? firstSelected.message : null;
  selectedChatMessageElement = firstSelected ? firstSelected.element : null;
}

function updateMessageSelectionBar(){
  const selectedCount = selectedChatMessages.length;
  const hasTextSelection = Boolean(selectedChatText);
  const bar = byId('messageSelectionBar');
  const title = byId('messageSelectionTitle');
  const header = document.querySelector('.chat-person-header');
  if(title) title.innerText = hasTextSelection ? '' : String(selectedCount);
  if(bar) bar.classList.toggle('hidden', selectedCount === 0 && !hasTextSelection);
  if(header) header.classList.toggle('selection-active', selectedCount > 0 || hasTextSelection);

  document.querySelectorAll('[data-selection-action]').forEach((button) => {
    const mode = button.dataset.selectionAction;
    const shouldHide = hasTextSelection
      ? mode !== 'copy'
      : selectedCount === 0
      || mode === 'single' && selectedCount !== 1
      || mode === 'multi' && selectedCount < 2;
    button.classList.toggle('hidden', shouldHide);
  });

  const pinButton = document.querySelector('[onclick="pinSelectedMessage()"]');
  if(pinButton){
    const allPinned = selectedChatMessages.length > 0 && selectedChatMessages.every(({ message }) => isPinnedMessage(message));
    pinButton.title = allPinned ? 'Unpin' : 'Pin';
  }
}

function toggleMessageSelection(element, message, forceSelect = false){
  if(!element || !message) return;
  const key = messageKey(message);
  const existing = selectedChatMessages.find((item) => item.key === key);

  if(existing && !forceSelect){
    existing.element.classList.remove('selected-message');
    selectedChatMessages = selectedChatMessages.filter((item) => item.key !== key);
  }else if(!existing){
    element.classList.add('selected-message');
    selectedChatMessages.push({ key, element, message });
  }

  syncSelectedMessageRefs();
  updateMessageSelectionBar();
}

function selectMessageElement(element, message){
  toggleMessageSelection(element, message, true);
}

function clearMessageSelection(){
  if(messageLongPressTimer){
    clearTimeout(messageLongPressTimer);
    messageLongPressTimer = null;
  }
  messageLongPressJustSelected = false;
  selectedChatMessages.forEach((item) => item.element.classList.remove('selected-message'));
  selectedChatMessages = [];
  if(selectedChatText && window.getSelection){
    window.getSelection().removeAllRanges();
  }
  selectedChatText = '';
  selectedChatMessage = null;
  selectedChatMessageElement = null;
  updateMessageSelectionBar();
}

function selectedTextFromChat(){
  const selection = window.getSelection ? window.getSelection() : null;
  const chat = byId('chatMessages');
  if(!selection || selection.isCollapsed || !chat) return '';
  const text = selection.toString().trim();
  if(!text) return '';
  const anchor = selection.anchorNode && (selection.anchorNode.nodeType === Node.ELEMENT_NODE ? selection.anchorNode : selection.anchorNode.parentElement);
  const focus = selection.focusNode && (selection.focusNode.nodeType === Node.ELEMENT_NODE ? selection.focusNode : selection.focusNode.parentElement);
  return anchor && focus && chat.contains(anchor) && chat.contains(focus) ? text : '';
}

function handleChatTextSelection(){
  const text = selectedTextFromChat();
  if(text){
    if(selectedChatMessages.length){
      selectedChatMessages.forEach((item) => item.element.classList.remove('selected-message'));
      selectedChatMessages = [];
      selectedChatMessage = null;
      selectedChatMessageElement = null;
    }
    selectedChatText = text;
    updateMessageSelectionBar();
  }else if(selectedChatText){
    selectedChatText = '';
    updateMessageSelectionBar();
  }
}

function setupMessageSelection(element, message){
  if(!element) return;
  element.dataset.messageKey = messageKey(message);
  element.__messageData = message;
  let pressStart = null;

  const startPress = (event) => {
    if(event.button !== undefined && event.button !== 0) return;
    if(selectedChatMessages.length > 0) return;
    if(event.target.closest('a, button, input, textarea, select, video, audio')) return;
    pressStart = { x:event.clientX, y:event.clientY };
    if(messageLongPressTimer) clearTimeout(messageLongPressTimer);
    messageLongPressTimer = setTimeout(() => {
      messageLongPressTimer = null;
      messageLongPressJustSelected = true;
      selectMessageElement(element, message);
    }, MESSAGE_LONG_PRESS_MS);
  };

  const cancelPress = () => {
    if(messageLongPressTimer){
      clearTimeout(messageLongPressTimer);
      messageLongPressTimer = null;
    }
    pressStart = null;
  };

  const cancelPressOnMove = (event) => {
    if(!pressStart || !messageLongPressTimer) return;
    const moved = Math.abs(event.clientX - pressStart.x) > 10 || Math.abs(event.clientY - pressStart.y) > 10;
    if(moved) cancelPress();
  };

  element.addEventListener('pointerdown', startPress);
  element.addEventListener('pointermove', cancelPressOnMove);
  element.addEventListener('pointerup', cancelPress);
  element.addEventListener('pointercancel', cancelPress);
  element.addEventListener('pointerleave', cancelPress);
  element.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    selectMessageElement(element, message);
  });
  element.addEventListener('click', (event) => {
    const highlightedText = selectedTextFromChat();
    if(highlightedText){
      selectedChatText = highlightedText;
      updateMessageSelectionBar();
      return;
    }
    if(messageLongPressJustSelected){
      messageLongPressJustSelected = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if(selectedChatMessages.length === 0) return;
    event.preventDefault();
    event.stopPropagation();
    toggleMessageSelection(element, message);
  });
}

function handleSelectedMessageKeyboard(event){
  if(!selectedChatMessages.length || event.key !== 'Delete' || event.repeat) return;
  event.preventDefault();
  deleteSelectedMessage();
}

document.addEventListener('keydown', handleSelectedMessageKeyboard);
document.addEventListener('selectionchange', handleChatTextSelection);

function replyToSelectedMessage(){
  if(selectedChatMessages.length !== 1 || !selectedChatMessage) return;
  const input = byId('chatInput');
  if(!input) return;
  const sender = selectedChatMessage.sender === (currentUser && currentUser.username) ? 'You' : selectedChatMessage.sender || chatDisplayName(currentChatUser);
  const preview = messagePreviewText(selectedChatMessage).slice(0, 80);
  input.value = `Reply to ${sender}: "${preview}"\n`;
  input.focus();
  updateCalculatorPreview();
  clearMessageSelection();
}

function showSelectedMessageInfo(){
  if(selectedChatMessages.length !== 1 || !selectedChatMessage) return;
  const createdAt = selectedChatMessage.createdAt
    ? new Date(selectedChatMessage.createdAt).toLocaleString()
    : 'Just now';
  alert([
    `From: ${selectedChatMessage.sender || 'Unknown'}`,
    `To: ${chatDisplayName(selectedChatMessage.receiver || currentChatUser)}`,
    `Type: ${selectedChatMessage.messageType || 'text'}`,
    `Time: ${createdAt}`,
    `Text: ${messagePreviewText(selectedChatMessage) || 'No text'}`
  ].join('\n'));
}

function selectedMessagesCopyText(){
  return selectedChatMessages
    .map(({ message }) => messagePreviewText(message))
    .filter(Boolean)
    .join('\n');
}

async function copyTextToClipboard(text){
  if(!text) return false;
  try{
    if(navigator.clipboard && window.isSecureContext){
      await navigator.clipboard.writeText(text);
      return true;
    }
  }catch(error){}

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  let copied = false;
  try{
    copied = document.execCommand('copy');
  }catch(error){
    copied = false;
  }
  textarea.remove();
  return copied;
}

async function copySelectedMessages(){
  const text = selectedChatText || selectedMessagesCopyText();
  if(!text) return;
  const copied = await copyTextToClipboard(text);
  setStatus(copied ? 'Copied' : 'Copy failed', copied);
  if(copied){
    if(window.getSelection) window.getSelection().removeAllRanges();
    clearMessageSelection();
  }
}

async function deleteSelectedMessage(){
  if(!selectedChatMessages.length) return;
  const selectedItems = [...selectedChatMessages];
  const deleteText = selectedItems.length === 1 ? 'Delete selected message?' : `Delete ${selectedItems.length} selected messages?`;
  if(!confirm(deleteText)) return;

  const selectedKeys = new Set(selectedItems.map((item) => item.key));
  selectedItems.forEach(({ element, message }) => {
    if(element) element.remove();
    removeMessageFromLocalStore(message);
  });
  currentConversationMessages = currentConversationMessages.filter((message) => !selectedKeys.has(messageKey(message)));

  await Promise.allSettled(selectedItems.map(async ({ message }) => {
    const id = encodeURIComponent(message._id || message.clientId || '');
    if(!id) return;
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/messages/${id}`, {
      method:'DELETE',
      headers:authHeaders()
    }, 6000);
    if(!response.ok){
      throw new Error('Unable to delete from backend');
    }
  })).then((results) => {
    const failed = results.some((result) => result.status === 'rejected');
    setStatus(failed ? 'Deleted on this device. Backend slow.' : 'Messages deleted', !failed);
  });

  const container = byId('chatMessages');
  if(container && !container.querySelector('.message')){
    renderEmptyMessage(`No messages with ${chatDisplayName(currentChatUser)} yet.`);
  }
  clearMessageSelection();
}

async function shareSelectedMessage(){
  if(selectedChatMessages.length !== 1 || !selectedChatMessage) return;
  const text = messagePreviewText(selectedChatMessage);
  try{
    if(navigator.share){
      await navigator.share({ text });
    }else if(navigator.clipboard){
      await navigator.clipboard.writeText(text);
      alert('Message copied for sharing.');
    }else{
      alert(text);
    }
  }catch(error){}
  clearMessageSelection();
}

function forwardSelectedMessages(){
  if(!selectedChatMessages.length) return;
  const target = prompt('Forward to username or group id');
  if(!target || !currentUser) return;
  const cleanTarget = target.trim();
  const selectedItems = [...selectedChatMessages];

  selectedItems.forEach(({ message }) => {
    const text = messagePreviewText(message);
    const forwardedMessage = {
      clientId:`msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      sender:currentUser.username,
      receiver:cleanTarget,
      groupId:String(cleanTarget).startsWith('group:') ? cleanTarget.replace('group:', '') : '',
      text:`Forwarded: ${text}`,
      messageType:'text',
      createdAt:new Date().toISOString(),
      ...extractTags(`Forwarded: ${text}`)
    };
    saveLocalMessage(forwardedMessage);
    renderUsers();
    if(socket) socket.emit('send_message', forwardedMessage);
    saveMessageToBackend(forwardedMessage);
  });

  alert(`${selectedItems.length} message${selectedItems.length === 1 ? '' : 's'} forwarded.`);
  clearMessageSelection();
}

function pinSelectedMessage(){
  if(!selectedChatMessages.length) return;
  const saved = getPinnedMessages();
  const selectedItems = [...selectedChatMessages];
  const selectedKeys = new Set(selectedItems.map(({ message }) => messageKey(message)));
  const allAlreadyPinned = selectedItems.every(({ message }) => isPinnedMessage(message));

  if(allAlreadyPinned){
    selectedItems.forEach(({ element }) => element.classList.remove('pinned-message'));
    const next = saved.filter((message) => !selectedKeys.has(message.key));
    localStorage.setItem(pinnedMessagesKey(), JSON.stringify(next));
    setStatus(selectedItems.length === 1 ? 'Message unpinned' : 'Messages unpinned', true);
    clearMessageSelection();
    return;
  }

  const pinnedItems = selectedItems.map(({ element, message }) => {
    if(element) element.classList.add('pinned-message');
    return {
      key: messageKey(message),
      text: messagePreviewText(message),
      sender: message.sender || '',
      createdAt: message.createdAt || new Date().toISOString()
    };
  });
  const next = [...pinnedItems, ...saved.filter((message) => !selectedKeys.has(message.key))].slice(0, 30);
  localStorage.setItem(pinnedMessagesKey(), JSON.stringify(next));
  setStatus(pinnedItems.length === 1 ? 'Message pinned' : 'Messages pinned', true);
  clearMessageSelection();
}

async function handleChatMedia(event){
  const input = event.target;
  const files = Array.from(input.files || []);
  input.value = '';
  if(!files.length) return;

  try{
    await preparePendingChatAttachments(files);
  }catch(error){
    clearPendingChatAttachments();
    alert(error.message);
  }
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

  try{
    const uploaded = await uploadMediaToCloud(file, 'reels');
    const captionResponse = await fetch(`${API_BASE_URL}/api/ai/caption`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaType: file.type, fileName: file.name })
    });
    const aiCaption = captionResponse.ok ? await captionResponse.json() : null;
    const finalCaption = caption || (aiCaption && aiCaption.caption) || '';
    try{
      const response = await fetch(`${API_BASE_URL}/api/reels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser.username,
          caption: finalCaption,
          ...extractTags(finalCaption),
          videoUrl: uploaded.url,
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
  }catch(error){
    byId('reelMessage').innerText = error.message;
  }
}

async function loadReels(){
  const feed = byId('reelsFeed');
  if(!feed) return;

  try{
    const response = await fetch(`${API_BASE_URL}/api/reels`);
    if(!response.ok) throw new Error('Unable to load reels');
    const reels = await response.json();
    appReels = reels;
    renderProfileStats();
    renderReelsList(reels);
    if(activeReelCollection) showReelCollection(activeReelCollection, true);
  }catch(error){
    feed.innerHTML = '<div class="empty-state compact">Could not load reels.</div>';
  }
}

function renderReelsList(reels){
  const feed = byId('reelsFeed');
  if(!feed) return;
  feed.innerHTML = reels.length ? '' : '<div class="empty-state compact">No reels yet.</div>';
  reels.forEach((reel)=>feed.appendChild(createReelCard(reel)));
}

function toggleReelUpload(){
  const panel = byId('reelUploadPanel');
  if(!panel) return;
  panel.classList.toggle('hidden');
  closeReelCollection();
  const message = byId('reelMessage');
  if(message) message.innerText = '';
}

function toggleReelsMenu(){
  const menu = byId('reelsMenu');
  if(menu) menu.classList.toggle('hidden');
}

function filterReels(value = ''){
  const text = value.trim().toLowerCase();
  closeReelCollection();
  const filtered = !text
    ? appReels
    : appReels.filter((reel) => {
      const caption = (reel.caption || '').toLowerCase();
      const username = (reel.username || '').toLowerCase();
      return caption.includes(text) || username.includes(text);
    });
  renderReelsList(filtered);
}

function getSavedReelIds(){
  try{
    return JSON.parse(localStorage.getItem('shashiSavedReels') || '[]');
  }catch(error){
    return [];
  }
}

function setSavedReelIds(ids){
  localStorage.setItem('shashiSavedReels', JSON.stringify([...new Set(ids)]));
}

function isReelSaved(id){
  return getSavedReelIds().includes(id);
}

function toggleSaveReel(id){
  const saved = getSavedReelIds();
  const next = saved.includes(id)
    ? saved.filter((item) => item !== id)
    : [...saved, id];
  setSavedReelIds(next);
  renderReelsList(appReels);
  if(activeReelCollection) showReelCollection(activeReelCollection, true);
}

function getReelCollection(kind){
  if(kind === 'liked'){
    return currentUser
      ? appReels.filter((reel) => (reel.likes || []).includes(currentUser.username))
      : [];
  }
  if(kind === 'commented'){
    return currentUser
      ? appReels.filter((reel) => (reel.comments || []).some((comment) => comment.username === currentUser.username))
      : [];
  }
  if(kind === 'saved'){
    const saved = getSavedReelIds();
    return appReels.filter((reel) => saved.includes(reel._id));
  }
  return appReels;
}

function showReelCollection(kind, keepMenuClosed = false){
  activeReelCollection = kind;
  const titles = {
    liked: 'Liked reels',
    commented: 'Commented reels',
    saved: 'Saved reels'
  };
  const panel = byId('reelCollectionPanel');
  const title = byId('reelCollectionTitle');
  const list = byId('reelCollectionList');
  if(!panel || !title || !list) return;

  if(!keepMenuClosed){
    const menu = byId('reelsMenu');
    if(menu) menu.classList.add('hidden');
  }

  const uploadPanel = byId('reelUploadPanel');
  if(uploadPanel) uploadPanel.classList.add('hidden');
  const feed = byId('reelsFeed');
  if(feed) feed.classList.add('hidden');
  title.innerText = titles[kind] || 'Reels';
  const reels = getReelCollection(kind);
  list.innerHTML = reels.length ? '' : `<div class="empty-state compact">No ${titles[kind].toLowerCase()} yet.</div>`;
  reels.forEach((reel)=>list.appendChild(createReelCard(reel)));
  panel.classList.remove('hidden');
}

function closeReelCollection(){
  activeReelCollection = '';
  const panel = byId('reelCollectionPanel');
  if(panel) panel.classList.add('hidden');
  const feed = byId('reelsFeed');
  if(feed) feed.classList.remove('hidden');
}

function createReelCard(reel){
  const card = document.createElement('article');
  card.className = 'reel-feed-card';
  const likes = reel.likes || [];
  const comments = reel.comments || [];
  const liked = currentUser && likes.includes(currentUser.username);
  const saved = isReelSaved(reel._id);
  card.innerHTML = `
    <video src="${escapeHtml(reel.videoUrl)}" controls loop playsinline></video>
    <div class="reel-meta">
      <strong>@${escapeHtml(reel.username)}</strong>
      <p>${escapeHtml(reel.caption || '')}</p>
      <div class="reel-stats">
        <button onclick="likeReel('${escapeHtml(reel._id)}')"><i class="fa-solid fa-heart"></i> ${liked ? 'Liked' : 'Like'} (${likes.length})</button>
        <button onclick="toggleSaveReel('${escapeHtml(reel._id)}')"><i class="fa-solid fa-bookmark"></i> ${saved ? 'Saved' : 'Save'}</button>
        <span>${comments.length} comments</span>
      </div>
      <div class="reel-comment-box">
        <input id="comment-${escapeHtml(reel._id)}" placeholder="Add comment..." />
        <button onclick="commentReel('${escapeHtml(reel._id)}')">Post</button>
      </div>
      <div class="reel-comments">
        ${comments.slice(-3).map((comment)=>`<small><b>@${escapeHtml(comment.username)}</b> ${escapeHtml(comment.text)}</small>`).join('')}
      </div>
    </div>
  `;
  return card;
}

async function uploadAccountPost(){
  if(!currentUser){
    byId('postMessage').innerText = 'Login first.';
    return;
  }

  const caption = byId('postCaptionInput').value.trim();
  const file = byId('postMediaInput').files[0];

  if(!caption && !file){
    byId('postMessage').innerText = 'Write a caption or choose a photo/video.';
    return;
  }

  try{
    byId('postMessage').innerText = 'Uploading post...';
    let uploaded = { url: '' };
    let mediaType = 'none';

    if(file){
      if(!file.type.startsWith('image/') && !file.type.startsWith('video/')){
        byId('postMessage').innerText = 'Choose an image or video.';
        return;
      }
      uploaded = await uploadMediaToCloud(file, 'posts');
      mediaType = file.type.startsWith('video/') ? 'video' : 'image';
    }

    const response = await fetch(`${API_BASE_URL}/api/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        username: currentUser.username,
        caption,
        mediaUrl: uploaded.url,
        mediaType,
        fileType: file ? file.type : ''
      })
    });

    const data = await response.json();
    if(!response.ok) throw new Error(data.message || 'Unable to upload post');

    byId('postCaptionInput').value = '';
    byId('postMediaInput').value = '';
    byId('postMessage').innerText = 'Post uploaded online.';
    loadPosts();
  }catch(error){
    byId('postMessage').innerText = error.message;
  }
}

async function loadPosts(){
  const feed = byId('postsFeed');
  try{
    const response = await fetch(`${API_BASE_URL}/api/posts`);
    if(!response.ok) throw new Error('Unable to load posts');
    const posts = await response.json();
    appPosts = posts;
    renderProfileStats();
    renderProfilePosts();
    renderFriendsPosts();

    if(!feed) return;
    feed.innerHTML = posts.length ? '' : '<div class="empty-state compact">No posts yet.</div>';
    posts.forEach((post) => feed.appendChild(createPostCard(post)));
  }catch(error){
    if(feed) feed.innerHTML = '<div class="empty-state compact">Could not load posts.</div>';
  }
}

function createPostCard(post, relationText = ''){
  const card = document.createElement('article');
  card.className = 'post-card';
  const likes = post.likes || [];
  const comments = post.comments || [];
  const liked = currentUser && likes.includes(currentUser.username);
  const relation = relationText
    ? `<div class="post-relation"><i class="fa-solid fa-link"></i><span>${escapeHtml(relationText)}</span></div>`
    : '';
  const media = post.mediaType === 'image'
    ? `<img src="${post.mediaUrl}" alt="${escapeHtml(post.caption || 'Post')}">`
    : post.mediaType === 'video'
      ? `<video src="${post.mediaUrl}" controls playsinline></video>`
      : '';

  card.innerHTML = `
    ${relation}
    <div class="post-head">
      <strong>@${escapeHtml(post.username)}</strong>
      <small>${new Date(post.createdAt).toLocaleString()}</small>
    </div>
    ${media}
    <p>${escapeHtml(post.caption || '')}</p>
    <div class="reel-actions">
      <button onclick="likePost('${post._id}')">${liked ? 'Liked' : 'Like'} (${likes.length})</button>
      <button onclick="commentPost('${post._id}')">Comment (${comments.length})</button>
    </div>
  `;
  return card;
}

async function likePost(id){
  if(!currentUser){
    alert('Login first.');
    return;
  }

  await fetch(`${API_BASE_URL}/api/posts/${id}/like`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ username: currentUser.username })
  });
  loadPosts();
  loadNotifications();
}

async function commentPost(id){
  if(!currentUser){
    alert('Login first.');
    return;
  }

  const text = prompt('Write a comment');
  if(!text) return;

  await fetch(`${API_BASE_URL}/api/posts/${id}/comment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ username: currentUser.username, text })
  });
  loadPosts();
  loadNotifications();
}

async function likeReel(id){
  if(!currentUser){
    alert('Login first.');
    return;
  }

  await fetch(`${API_BASE_URL}/api/reels/${id}/like`, {
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

  const input = byId(`comment-${id}`);
  const text = input.value.trim();
  if(!text) return;

  const moderation = await moderateTextBeforeSend(text);
  if(!moderation.allowed){
    alert(moderation.message || 'Please edit this comment.');
    return;
  }

  await fetch(`${API_BASE_URL}/api/reels/${id}/comment`, {
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
  const response = await fetch(`${API_BASE_URL}/api/notifications/${currentUser.username}`, { headers:authHeaders() });
  if(!response.ok) return;
  notifications = await response.json();
  renderNotifications();
}

function renderNotifications(){
  const lists = [byId('notificationList'), byId('friendsNotificationList')].filter(Boolean);
  const badges = [byId('notificationBadge'), byId('friendsNotificationBadge')].filter(Boolean);
  if(!lists.length && !badges.length) return;
  const unread = notifications.filter((item)=>!item.read).length;
  badges.forEach((badge) => {
    badge.innerText = unread;
    badge.classList.toggle('hidden', unread === 0);
  });
  const html = notifications.length
    ? notifications.map((item)=>`<div class="notification-item ${item.read ? '' : 'unread'}"><strong>${item.type.replace('_', ' ')}</strong><small>${item.text}</small></div>`).join('')
    : '<div class="empty-state compact">No notifications yet.</div>';
  lists.forEach((list) => {
    list.innerHTML = html;
  });
}

async function markNotificationsRead(){
  if(!currentUser) return;
  await fetch(`${API_BASE_URL}/api/notifications/${currentUser.username}/read`, { method: 'PUT', headers:authHeaders() });
  loadNotifications();
}

function sendFriendRequest(username){
  if(!currentUser) return;
  const notification = {
    recipient: username,
    sender: currentUser.username,
    type: 'friend_request',
    text: `${currentUser.username} sent you a friend request`
  };
  fetch(`${API_BASE_URL}/api/notifications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(notification)
  });
  if(socket) socket.emit('send_notification', notification);
}

document.addEventListener('DOMContentLoaded', ()=>{
  const mediaInput = byId('chatMediaInput');
  if(mediaInput) mediaInput.addEventListener('change', handleChatMedia);
  ['chatGalleryInput', 'chatDocumentInput', 'chatCatalogueInput'].forEach((id) => {
    const input = byId(id);
    if(input) input.addEventListener('change', handleChatMedia);
  });
  loadReels();
  loadPosts();
  loadNotifications();
  if(socket){
    socket.on('new_notification', (notification)=>{
      if(currentUser && notification.recipient === currentUser.username){
        notifications = [notification, ...notifications];
        renderNotifications();
        if('Notification' in window && Notification.permission === 'granted'){
          new Notification('shashi', { body: notification.text });
        }
      }
    });
    socket.on('reel_updated', loadReels);
  }
  if('Notification' in window && Notification.permission === 'default'){
    Notification.requestPermission();
  }
});

/* SHASHI_FRIEND_STORY_SEARCH_SETTINGS */
function escapeHtml(value){
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}

async function loadFriendState(){
  if(!currentUser) return;
  try{
    const response = await fetch(`${API_BASE_URL}/api/friends/${currentUser.username}`, { headers:authHeaders() });
    if(!response.ok) return;
    friendState = await response.json();
    renderProfileStats();
    renderFriendsPosts();
    renderFriendSystem();
    loadGroups();
  }catch(error){
    console.error(error);
  }
}

function userByName(username){
  return appUsers.find((user) => user.username === username) || { username };
}

function renderFriendSystem(){
  const requestsList = byId('friendRequestsList');
  const friendsList = byId('friendsList');
  const followersList = byId('followersList');
  const picker = byId('friendGroupPicker');
  const groupList = byId('friendGroupsList');
  const contactsList = byId('contactMatchesList');
  if(!requestsList && !friendsList && !followersList && !picker && !groupList && !contactsList) return;

  if(!currentUser){
    [requestsList, friendsList, followersList, picker, groupList, contactsList].forEach((list) => {
      if(list) list.innerHTML = '<div class="empty-state compact">Login first.</div>';
    });
    return;
  }

  if(requestsList){
    requestsList.innerHTML = friendState.friendRequests.length
      ? friendState.friendRequests.map((name) => friendActionRow(name, `<button onclick="acceptFriendRequest('${name}')">Accept</button><button onclick="removeFriend('${name}')">Remove</button>`)).join('')
      : '<div class="empty-state compact">No requests yet.</div>';
  }

  if(friendsList){
    friendsList.innerHTML = friendState.friends.length
      ? friendState.friends.map((name) => friendActionRow(name, `<button onclick="openChat('${name}')">Chat</button><button onclick="removeFriend('${name}')">Remove</button>`)).join('')
      : '<div class="empty-state compact">No friends yet.</div>';
  }

  if(followersList){
    followersList.innerHTML = friendState.followers.length
      ? friendState.followers.map((name) => friendActionRow(name, `<button onclick="sendFriendRequest('${name}')">Follow back</button>`)).join('')
      : '<div class="empty-state compact">No followers yet.</div>';
  }

  if(picker){
    const groupContacts = uniqueContactNames();
    picker.innerHTML = groupContacts.length
      ? groupContacts.map((name) => groupFriendOption(name)).join('')
      : '<div class="empty-state compact">Allow contacts or add friends first.</div>';
  }

  if(groupList){
    groupList.innerHTML = appGroups.length
      ? appGroups.map((group) => renderManagedGroupCard(group)).join('')
      : '<div class="empty-state compact">No groups yet.</div>';
  }

  renderContactMatches();
}

function uniqueContactNames(){
  return [...new Set([
    ...friendState.friends,
    ...contactUsers.map((user) => user.username)
  ])];
}

function renderContactMatches(){
  const contactsList = byId('contactMatchesList');
  if(!contactsList) return;

  if(contactUsers.length === 0){
    contactsList.innerHTML = '<div class="empty-state compact">Allow contacts to find app users from your phone.</div>';
    return;
  }

  contactsList.innerHTML = contactUsers.map((user) => {
    const isFriend = friendState.friends.includes(user.username);
    const requested = friendState.following.includes(user.username);
    const label = isFriend ? 'Friend' : requested ? 'Requested' : 'Add';
    return friendActionRow(
      user.username,
      `<button onclick="openChat('${user.username}')">Chat</button><button onclick="sendFriendRequest('${user.username}')">${label}</button>`
    );
  }).join('');
}

function renderManagedGroupCard(group){
  const isAdmin = currentUser && group.admins.includes(currentUser.username);
  const addOptions = uniqueContactNames()
    .filter((name) => !group.members.includes(name))
    .map((name) => `<option value="${escapeHtml(name)}">@${escapeHtml(name)}</option>`)
    .join('');
  const adminOptions = group.members
    .filter((name) => !group.admins.includes(name))
    .map((name) => `<option value="${escapeHtml(name)}">@${escapeHtml(name)}</option>`)
    .join('');
  const removeMemberOptions = group.members
    .filter((name) => name !== group.owner && (!currentUser || name !== currentUser.username))
    .map((name) => `<option value="${escapeHtml(name)}">@${escapeHtml(name)}</option>`)
    .join('');
  const removeAdminOptions = group.admins
    .filter((name) => name !== group.owner && (!currentUser || name !== currentUser.username))
    .map((name) => `<option value="${escapeHtml(name)}">@${escapeHtml(name)}</option>`)
    .join('');

  return `
    <div class="managed-group-card">
      <button type="button" class="user-row" onclick="openGroupChat('${escapeHtml(group._id)}','${escapeHtml(group.name)}')">
        <div class="user-avatar group-avatar"><i class="fa-solid fa-user-group"></i></div>
        <div>
          <strong>${escapeHtml(group.name)}</strong>
          <small>${group.members.length} members - ${group.admins.length} admins</small>
        </div>
      </button>
      <div class="group-admin-list"><small>Admins: ${group.admins.map((name) => `@${escapeHtml(name)}`).join(', ')}</small></div>
      ${isAdmin ? `
        <label class="setting-row group-permission-row">
          <span>Members can add more people</span>
          <input type="checkbox" ${group.allowMembersToAdd ? 'checked' : ''} onchange="updateGroupPermission('${escapeHtml(group._id)}', this.checked)" />
        </label>
        <div class="group-admin-tools">
          <select id="add-member-${escapeHtml(group._id)}">
            <option value="">Add contact</option>
            ${addOptions}
          </select>
          <button type="button" class="ghost-btn" onclick="addGroupMember('${escapeHtml(group._id)}')"><i class="fa-solid fa-plus"></i></button>
          <select id="make-admin-${escapeHtml(group._id)}">
            <option value="">Make admin</option>
            ${adminOptions}
          </select>
          <button type="button" class="ghost-btn" onclick="makeGroupAdmin('${escapeHtml(group._id)}')"><i class="fa-solid fa-user-shield"></i></button>
        </div>
        <div class="group-admin-tools">
          <select id="remove-member-${escapeHtml(group._id)}">
            <option value="">Remove member</option>
            ${removeMemberOptions}
          </select>
          <button type="button" class="ghost-btn" onclick="removeGroupMember('${escapeHtml(group._id)}')"><i class="fa-solid fa-user-minus"></i></button>
          <select id="remove-admin-${escapeHtml(group._id)}">
            <option value="">Remove admin</option>
            ${removeAdminOptions}
          </select>
          <button type="button" class="ghost-btn" onclick="removeGroupAdmin('${escapeHtml(group._id)}')"><i class="fa-solid fa-user-lock"></i></button>
        </div>
        <div class="group-management-actions">
          <button type="button" class="ghost-btn" onclick="editGroupFromCard('${escapeHtml(group._id)}')"><i class="fa-solid fa-pen"></i> Edit</button>
          <button type="button" class="ghost-btn" onclick="clearGroupChatFromCard('${escapeHtml(group._id)}')"><i class="fa-solid fa-trash"></i> Clear chat</button>
          <button type="button" class="ghost-btn" onclick="leaveGroupFromCard('${escapeHtml(group._id)}')"><i class="fa-solid fa-right-from-bracket"></i> Leave</button>
          ${currentUser && group.owner === currentUser.username ? `<button type="button" class="ghost-btn danger-btn" onclick="deleteGroupFromCard('${escapeHtml(group._id)}')"><i class="fa-solid fa-trash-can"></i> Delete</button>` : ''}
        </div>
      ` : '<small>Only group admins can add members or select new admins.</small>'}
    </div>
  `;
}

function toggleGroupContactPicker(){
  const picker = byId('friendGroupPicker');
  if(picker) picker.classList.toggle('hidden');
}

function groupFriendOption(username){
  const user = userByName(username);
  const avatar = user.profilePhoto
    ? `<img src="${photoUrl(user.profilePhoto)}" alt="${escapeHtml(username)}">`
    : `<span>${escapeHtml(username.charAt(0).toUpperCase())}</span>`;

  return `
    <label class="group-friend-option">
      <input type="checkbox" value="${escapeHtml(username)}" />
      <div class="user-avatar">${avatar}</div>
      <span>@${escapeHtml(username)}</span>
    </label>
  `;
}

function contactPhonesFromSelection(contacts){
  return contacts
    .flatMap((contact) => contact.tel || [])
    .map((phone) => String(phone || '').replace(/\D/g, ''))
    .filter(Boolean);
}

async function requestContactsPermission(){
  const message = byId('contactsMessage');
  if(!currentUser){
    if(message) message.innerText = 'Login first.';
    return;
  }

  if(!navigator.contacts || !navigator.contacts.select){
    if(message){
      message.innerText = 'Contact picker is not supported on this browser. Try Android Chrome or the Android app.';
    }
    return;
  }

  try{
    if(message) message.innerText = 'Choose contacts to match with app users...';
    const contacts = await navigator.contacts.select(['name', 'tel'], { multiple: true });
    const phones = contactPhonesFromSelection(contacts);

    if(phones.length === 0){
      if(message) message.innerText = 'No phone numbers selected.';
      return;
    }

    const response = await fetch(`${API_BASE_URL}/api/friends/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        username: currentUser.username,
        phones
      })
    });
    const data = await response.json();
    if(!response.ok) throw new Error(data.message || 'Could not match contacts');

    contactUsers = data;
    saveContactMatches(contactUsers);
    if(message){
      message.innerText = contactUsers.length
        ? `${contactUsers.length} app contacts found.`
        : 'No selected contacts are using this app yet.';
    }
    renderFriendSystem();
  }catch(error){
    if(message) message.innerText = error.name === 'AbortError' ? 'Contacts permission cancelled.' : error.message;
  }
}

function friendActionRow(username, actions){
  const user = userByName(username);
  const avatar = user.profilePhoto
    ? `<img src="${photoUrl(user.profilePhoto)}" alt="${escapeHtml(username)}">`
    : `<span>${escapeHtml(username.charAt(0).toUpperCase())}</span>`;
  return `
    <div class="friend-row">
      <div class="user-avatar">${avatar}</div>
      <div><strong>@${escapeHtml(username)}</strong><small>${user.online ? 'Online' : 'Offline'}</small></div>
      <div class="friend-actions">${actions}</div>
    </div>
  `;
}

async function sendFriendRequest(username){
  if(!currentUser){
    alert('Login first.');
    return;
  }
  const response = await fetch(`${API_BASE_URL}/api/friends/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ from: currentUser.username, to: username })
  });
  if(!response.ok){
    const data = await response.json().catch(() => ({}));
    alert(data.message || 'Could not send request.');
    return;
  }
  if(socket) socket.emit('send_notification', {
    recipient: username,
    sender: currentUser.username,
    type: 'friend_request',
    text: `${currentUser.username} sent you a friend request`
  });
  await loadFriendState();
  alert('Friend request sent.');
}

async function acceptFriendRequest(requester){
  if(!currentUser) return;
  await fetch(`${API_BASE_URL}/api/friends/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ username: currentUser.username, requester })
  });
  await loadFriendState();
  loadUsers();
}

async function removeFriend(friend){
  if(!currentUser) return;
  await fetch(`${API_BASE_URL}/api/friends/remove`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ username: currentUser.username, friend })
  });
  await loadFriendState();
  loadUsers();
}

async function uploadStory(){
  if(!currentUser){
    byId('storyMessage').innerText = 'Login first.';
    return;
  }
  const file = byId('storyFileInput').files[0];
  const caption = byId('storyCaptionInput').value.trim();
  await uploadStoryFile(file, caption, 'storyMessage', () => {
    byId('storyFileInput').value = '';
    byId('storyCaptionInput').value = '';
    const panel = byId('storyUploadPanel');
    if(panel) panel.classList.add('hidden');
  });
}

function toggleStoryUpload(){
  const panel = byId('storyUploadPanel');
  if(!panel) return;
  panel.classList.toggle('hidden');
  closeStoryOptionPanel();
  const message = byId('storyMessage');
  if(message) message.innerText = '';
}

function toggleStoryMenu(){
  const menu = byId('storyMenu');
  if(menu) menu.classList.toggle('hidden');
}

async function openStoryCamera(){
  closeStoryOptionPanel();
  const panel = byId('storyCameraPanel');
  const uploadPanel = byId('storyUploadPanel');
  const message = byId('storyCameraMessage');
  if(uploadPanel) uploadPanel.classList.add('hidden');
  if(panel) panel.classList.remove('hidden');

  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    if(message) message.innerText = 'Live preview is not supported here. Opening phone camera picker.';
    const input = byId('storyCameraInput');
    if(input){
      input.value = '';
      input.click();
    }
    return;
  }

  try{
    if(storyCameraStream){
      storyCameraStream.getTracks().forEach((track) => track.stop());
    }
    storyCameraStream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'environment' }, audio:false });
    const preview = byId('storyCameraPreview');
    if(preview) preview.srcObject = storyCameraStream;
    if(message) message.innerText = 'Camera opened. Gallery is beside it.';
  }catch(error){
    if(message) message.innerText = 'Camera permission denied. Opening phone camera picker.';
    const input = byId('storyCameraInput');
    if(input){
      input.value = '';
      input.click();
    }
  }
}

function closeStoryCameraPanel(){
  if(storyCameraStream){
    storyCameraStream.getTracks().forEach((track) => track.stop());
    storyCameraStream = null;
  }
  const preview = byId('storyCameraPreview');
  if(preview) preview.srcObject = null;
  const panel = byId('storyCameraPanel');
  if(panel) panel.classList.add('hidden');
}

function captureStoryCameraPhoto(){
  const preview = byId('storyCameraPreview');
  const message = byId('storyCameraMessage');
  if(!preview || !preview.videoWidth){
    if(message) message.innerText = 'Camera is not ready yet.';
    return;
  }
  const canvas = document.createElement('canvas');
  canvas.width = preview.videoWidth;
  canvas.height = preview.videoHeight;
  canvas.getContext('2d').drawImage(preview, 0, 0, canvas.width, canvas.height);
  canvas.toBlob((blob) => {
    if(!blob){
      if(message) message.innerText = 'Could not capture photo.';
      return;
    }
    const file = new File([blob], `story-camera-${Date.now()}.jpg`, { type:'image/jpeg' });
    setStoryUploadFile(file, 'Camera photo selected. Add caption and upload story.');
    closeStoryCameraPanel();
  }, 'image/jpeg', 0.92);
}

function setStoryUploadFile(file, statusText){
  const uploadInput = byId('storyFileInput');
  const uploadPanel = byId('storyUploadPanel');
  const message = byId('storyMessage');
  if(uploadInput && window.DataTransfer){
    const transfer = new DataTransfer();
    transfer.items.add(file);
    uploadInput.files = transfer.files;
  }
  if(uploadPanel) uploadPanel.classList.remove('hidden');
  if(message) message.innerText = statusText;
}

function handleStoryCameraCapture(input){
  const file = input && input.files ? input.files[0] : null;
  if(!file) return;

  setStoryUploadFile(file, 'Camera media selected. Add caption and upload story.');
}

function openStoryGalleryPicker(){
  const input = byId('storyGalleryInput');
  if(input){
    input.value = '';
    input.click();
  }
}

function handleStoryGallerySelection(input){
  const files = Array.from(input && input.files ? input.files : []);
  const preview = byId('storyGalleryPreview');
  const message = byId('storyCameraMessage');
  if(!preview) return;
  if(!files.length){
    preview.innerHTML = '<div class="empty-state compact">Choose photos or videos from gallery.</div>';
    return;
  }
  preview.innerHTML = files.map((file, index) => {
    const url = URL.createObjectURL(file);
    const media = file.type.startsWith('video/')
      ? `<video src="${url}" muted playsinline></video>`
      : `<img src="${url}" alt="${escapeHtml(file.name)}">`;
    return `<button type="button" class="story-gallery-item" onclick="useGalleryStoryFile(${index})">${media}<span>${escapeHtml(file.name)}</span></button>`;
  }).join('');
  window.storyGalleryFiles = files;
  if(message) message.innerText = 'Tap a gallery item to use it for story.';
}

function useGalleryStoryFile(index){
  const files = window.storyGalleryFiles || [];
  const file = files[index];
  if(!file) return;
  setStoryUploadFile(file, 'Gallery media selected. Add caption and upload story.');
  closeStoryCameraPanel();
}

async function startLiveStory(){
  const message = byId('storyLiveMessage') || byId('storyMessage');
  if(!currentUser){
    if(message) message.innerText = 'Login first.';
    return;
  }
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    if(message) message.innerText = 'Live camera is not supported on this device browser.';
    return;
  }

  try{
    const stream = await navigator.mediaDevices.getUserMedia({ video:true, audio:true });
    const preview = byId('storyLivePreview');
    const panel = byId('storyLivePanel');
    const uploadPanel = byId('storyUploadPanel');
    if(preview) preview.srcObject = stream;
    if(panel) panel.classList.remove('hidden');
    if(uploadPanel) uploadPanel.classList.add('hidden');

    liveStoryState = { active:true, stream, recorder:null, chunks:[], startedAt:new Date(), url:'' };
    if(window.MediaRecorder){
      const recorder = new MediaRecorder(stream);
      liveStoryState.recorder = recorder;
      recorder.ondataavailable = (event) => {
        if(event.data && event.data.size > 0) liveStoryState.chunks.push(event.data);
      };
      recorder.start();
    }
    if(message) message.innerText = 'Live story is running.';
    renderStories();
  }catch(error){
    if(message) message.innerText = 'Camera or microphone permission denied.';
  }
}

function endLiveStory(){
  const message = byId('storyLiveMessage');
  if(!liveStoryState.active){
    if(message) message.innerText = 'No live story is running.';
    return;
  }

  const finish = () => {
    if(liveStoryState.stream){
      liveStoryState.stream.getTracks().forEach((track) => track.stop());
    }
    const preview = byId('storyLivePreview');
    if(preview) preview.srcObject = null;
    const panel = byId('storyLivePanel');
    if(panel) panel.classList.add('hidden');

    if(liveStoryState.chunks.length){
      const blob = new Blob(liveStoryState.chunks, { type:'video/webm' });
      saveLiveStoryToGallery(blob);
      if(message) message.innerText = 'Live ended and saved.';
    }else if(message){
      message.innerText = 'Live ended. Recording could not be saved on this browser.';
    }

    liveStoryState = { active:false, stream:null, recorder:null, chunks:[], startedAt:null, url:'' };
    renderStories();
  };

  if(liveStoryState.recorder && liveStoryState.recorder.state !== 'inactive'){
    liveStoryState.recorder.onstop = finish;
    liveStoryState.recorder.stop();
  }else{
    finish();
  }
}

function saveLiveStoryToGallery(blob){
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
link.download = `shashi-live-story-${Date.now()}.webm`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function openStoryMusicPicker(){
  closeStoryOptionPanel();
  const input = byId('storyMusicFileInput');
  if(input){
    input.value = '';
    input.click();
  }else{
    openStoryOption('music');
  }
}

function handleStoryMusicSelection(input){
  const file = input && input.files ? input.files[0] : null;
  if(!file) return;
  if(byId('textStoryPage') && !byId('textStoryPage').classList.contains('hidden')){
    selectedTextStoryMusic = file;
    updateTextStoryMusicLabel();
    return;
  }
  selectedStoryMusic = file;
  openStoryOption('music');
}

function openTextStoryPage(){
  const input = byId('textStoryPageInput');
  const message = byId('textStoryMessage');
  if(input) input.value = '';
  if(message) message.innerText = '';
  selectedTextStoryMusic = null;
  selectedTextStoryColor = '#ffffff';
  updateTextStoryMusicLabel();
  updateTextStoryColorPreview();
  showPage('textStoryPage');
  setTimeout(() => {
    const freshInput = byId('textStoryPageInput');
    if(freshInput) freshInput.focus();
  }, 50);
}

function selectTextStoryColor(color, button){
  selectedTextStoryColor = color;
  document.querySelectorAll('.text-story-colors button').forEach((item) => item.classList.remove('active'));
  if(button) button.classList.add('active');
  const customColor = byId('textStoryCustomColorInput');
  if(customColor) customColor.value = color;
  updateTextStoryColorPreview();
}

function selectCustomTextStoryColor(color){
  selectedTextStoryColor = color;
  document.querySelectorAll('.text-story-colors button').forEach((item) => item.classList.remove('active'));
  updateTextStoryColorPreview();
}

function readableTextColor(background){
  const hex = String(background || '#ffffff').replace('#', '');
  if(hex.length !== 6) return '#0f172a';
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  const brightness = (red * 299 + green * 587 + blue * 114) / 1000;
  return brightness < 130 ? '#ffffff' : '#0f172a';
}

function updateTextStoryColorPreview(){
  const input = byId('textStoryPageInput');
  if(!input) return;
  input.style.background = selectedTextStoryColor;
  input.style.color = readableTextColor(selectedTextStoryColor);
}

function openTextStoryMusicPicker(){
  const input = byId('storyMusicFileInput');
  if(input){
    input.value = '';
    input.click();
  }
}

function updateTextStoryMusicLabel(){
  const label = byId('textStoryMusicLabel');
  if(label){
    label.innerText = selectedTextStoryMusic ? selectedTextStoryMusic.name : 'Add music';
  }
}

async function postTextStory(){
  const input = byId('textStoryPageInput');
  const message = byId('textStoryMessage');
  const text = input ? input.value.trim() : '';

  if(!currentUser){
    if(message) message.innerText = 'Login first.';
    return;
  }
  if(!text){
    if(message) message.innerText = 'Write something for your status.';
    return;
  }

  try{
    if(message) message.innerText = 'Posting status...';
    const response = await fetch(`${API_BASE_URL}/api/stories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        username: currentUser.username,
        mediaUrl: '',
        mediaType: 'text',
        caption: text,
        backgroundColor: selectedTextStoryColor,
        musicName: selectedTextStoryMusic ? selectedTextStoryMusic.name : ''
      })
    });
    const data = await response.json().catch(() => ({}));
    if(!response.ok) throw new Error(data.message || 'Could not post status');
    if(input) input.value = '';
    selectedTextStoryMusic = null;
    selectedTextStoryColor = '#ffffff';
    if(message) message.innerText = 'Status posted.';
    await loadStories();
    showPage('statusPage');
  }catch(error){
    if(message) message.innerText = error.message;
  }
}

function filterStories(value = ''){
  const text = value.trim().toLowerCase();
  const filtered = !text
    ? storyItems
    : storyItems.filter((story) => {
      const username = (story.username || '').toLowerCase();
      const caption = (story.caption || '').toLowerCase();
      return username.includes(text) || caption.includes(text);
    });
  renderStories(filtered);
}

function closeStoryOptionPanel(){
  const panel = byId('storyOptionsPanel');
  if(panel) panel.classList.add('hidden');
}

function openStoryOption(type){
  const menu = byId('storyMenu');
  if(menu) menu.classList.add('hidden');
  const uploadPanel = byId('storyUploadPanel');
  if(uploadPanel) uploadPanel.classList.add('hidden');
  const panel = byId('storyOptionsPanel');
  if(!panel) return;

  const content = {
    privacy: `
      <div class="section-title">
        <h2>Status privacy</h2>
        <button class="ghost-btn small" onclick="closeStoryOptionPanel()">Close</button>
      </div>
      <label class="story-option-row"><span>My contacts</span><input type="radio" name="storyPrivacy" checked></label>
      <label class="story-option-row"><span>My contacts except...</span><input type="radio" name="storyPrivacy"></label>
      <label class="story-option-row"><span>Only share with...</span><input type="radio" name="storyPrivacy"></label>
    `,
    schedule: `
      <div class="section-title">
        <h2>Schedule status</h2>
        <button class="ghost-btn small" onclick="closeStoryOptionPanel()">Close</button>
      </div>
      <input type="datetime-local" id="storyScheduleTime" />
      <button class="primary-btn" onclick="alert('Schedule saved in this app screen.')">Save schedule</button>
    `,
    settings: `
      <div class="section-title">
        <h2>Settings</h2>
        <button class="ghost-btn small" onclick="closeStoryOptionPanel()">Close</button>
      </div>
      <label class="story-option-row"><span>Allow reactions</span><input type="checkbox" checked></label>
      <label class="story-option-row"><span>Show viewers</span><input type="checkbox" checked></label>
      <label class="story-option-row"><span>Auto delete after 24 hours</span><input type="checkbox" checked></label>
    `,
    text: `
      <div class="section-title">
        <h2>Text story</h2>
        <button class="ghost-btn small" onclick="closeStoryOptionPanel()">Close</button>
      </div>
      <textarea id="textStoryCaptionInput" placeholder="Type your story text..."></textarea>
      <button class="primary-btn" onclick="createTextStory()">Post text story</button>
    `,
    music: `
      <div class="section-title">
        <h2>Music story</h2>
        <button class="ghost-btn small" onclick="closeStoryOptionPanel()">Close</button>
      </div>
      <button class="story-picker-btn" onclick="openStoryMusicPicker()"><i class="fa-solid fa-folder-open"></i><span>Choose from phone or other apps</span></button>
      <label class="story-option-row"><span>${escapeHtml(selectedStoryMusic ? selectedStoryMusic.name : 'No music selected')}</span><i class="fa-solid fa-music"></i></label>
      <input id="storyMusicInput" type="text" placeholder="Song name or audio link" value="${escapeHtml(selectedStoryMusic ? selectedStoryMusic.name : '')}" />
      <button class="primary-btn" onclick="saveStoryMusic()">Add music</button>
    `
  };
  panel.innerHTML = content[type] || '';
  panel.classList.remove('hidden');
}

function createTextStory(){
  const input = byId('textStoryCaptionInput');
  const storyCaption = byId('storyCaptionInput');
  if(storyCaption && input){
    storyCaption.value = input.value.trim();
  }
  closeStoryOptionPanel();
  toggleStoryUpload();
}

function saveStoryMusic(){
  const input = byId('storyMusicInput');
  const storyCaption = byId('storyCaptionInput');
  const musicName = selectedStoryMusic ? selectedStoryMusic.name : input ? input.value.trim() : '';
  if(!musicName){
    alert('Select music first.');
    return;
  }
  if(storyCaption && !storyCaption.value.includes(musicName)){
    storyCaption.value = `${storyCaption.value.trim()} ${storyCaption.value.trim() ? '\n' : ''}Music: ${musicName}`.trim();
  }
  closeStoryOptionPanel();
  const uploadPanel = byId('storyUploadPanel');
  if(uploadPanel) uploadPanel.classList.remove('hidden');
}

async function uploadStoryFile(file, caption = '', messageId = 'storyMessage', onDone){
  const message = byId(messageId);
  if(!currentUser){
    if(message) message.innerText = 'Login first.';
    return;
  }
  if(!file || (!file.type.startsWith('image/') && !file.type.startsWith('video/'))){
    if(message) message.innerText = 'Choose an image or video.';
    return;
  }
  if(file.size > 12 * 1024 * 1024){
    if(message) message.innerText = 'Choose media below 12 MB.';
    return;
  }

  try{
    if(message) message.innerText = 'Uploading status...';
    const uploaded = await uploadMediaToCloud(file, 'stories');
    const captionResponse = await fetch(`${API_BASE_URL}/api/ai/caption`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaType: file.type, fileName: file.name })
    });
    const aiCaption = captionResponse.ok ? await captionResponse.json() : null;
    const response = await fetch(`${API_BASE_URL}/api/stories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        username: currentUser.username,
        mediaUrl: uploaded.url,
        mediaType: file.type.startsWith('video/') ? 'video' : 'image',
        caption: caption || (aiCaption && aiCaption.caption) || ''
      })
    });
    if(message) message.innerText = response.ok ? 'Status uploaded for 24 hours.' : 'Status upload failed.';
    if(onDone) onDone();
    loadStories();
  }catch(error){
    if(message) message.innerText = error.message;
  }
}

async function loadStories(){
  const list = byId('storiesList');
  if(!list) return;
  try{
    const response = await fetch(`${API_BASE_URL}/api/stories`);
    if(!response.ok) throw new Error('Could not load stories');
    storyItems = await response.json();
    renderStories();
  }catch(error){
    storyItems = [];
    renderStories([]);
    list.insertAdjacentHTML('beforeend', '<div class="empty-state compact story-grid-message">Could not load stories.</div>');
  }
}

function renderStories(items = storyItems){
  const list = byId('storiesList');
  if(!list) return;
  const myStoryCard = createMyStoryCard(storyItems);
  const liveStoryCard = createLiveStoryCard();
  const friendNames = new Set(friendState.friends || []);
  const friendStories = currentUser
    ? items.filter((story) => story.username !== currentUser.username && friendNames.has(story.username))
    : [];
  const storyCards = friendStories.map((story) => {
      const backgroundColor = escapeHtml(story.backgroundColor || '#ffffff');
      const textColor = readableTextColor(backgroundColor);
      const musicLine = story.musicName
        ? `<small class="story-music-line"><i class="fa-solid fa-music"></i> ${escapeHtml(story.musicName)}</small>`
        : '';
      const ownerBadge = storyOwnerBadge(story.username);
      const media = story.mediaType === 'text'
        ? `<div class="story-text-card" style="background:${backgroundColor};color:${textColor}"><p>${escapeHtml(story.caption || '')}</p>${musicLine}</div>`
        : story.mediaType === 'video'
          ? `<video src="${story.mediaUrl}" controls playsinline></video>`
          : `<img src="${story.mediaUrl}" alt="${escapeHtml(story.caption || 'Story')}">`;
      return `
        <article class="story-card" onclick="viewStory('${story._id}')">
          <div class="story-preview-wrap">
            ${media}
            ${ownerBadge}
          </div>
          <div class="story-info">
            <strong>@${escapeHtml(story.username)}</strong>
            <p>${escapeHtml(story.caption)}</p>
            ${musicLine}
            <small>${story.viewers.length} viewers · ${story.reactions.length} reactions</small>
            <div class="story-reactions">
              <button onclick="event.stopPropagation(); reactStory('${story._id}','Like')">Like</button>
              <button onclick="event.stopPropagation(); reactStory('${story._id}','Love')">Love</button>
              <button onclick="event.stopPropagation(); reactStory('${story._id}','Wow')">Wow</button>
            </div>
          </div>
        </article>
      `;
    }).join('');
  list.innerHTML = myStoryCard + liveStoryCard + storyCards;
}

function storyOwnerBadge(username){
  const user = username === (currentUser && currentUser.username)
    ? currentUser
    : userByName(username);
  const label = username ? username.charAt(0).toUpperCase() : 'S';
  const avatar = user && user.profilePhoto
    ? `<img src="${photoUrl(user.profilePhoto)}" alt="${escapeHtml(username)}">`
    : `<span>${escapeHtml(label)}</span>`;
  return `<div class="story-id-badge">${avatar}</div>`;
}

function createLiveStoryCard(){
  if(!liveStoryState.active || !currentUser) return '';
  return `
    <article class="story-card live-story-card">
      <div class="story-preview-wrap live-story-preview">
        <i class="fa-solid fa-tower-broadcast"></i>
        <span>LIVE</span>
        ${storyOwnerBadge(currentUser.username)}
      </div>
      <div class="story-info">
        <strong>@${escapeHtml(currentUser.username)}</strong>
        <p>Live story is running</p>
        <small>Visible while live only</small>
      </div>
    </article>
  `;
}

function createMyStoryCard(items = storyItems){
  if(!currentUser){
    return '';
  }

  const myStory = items.find((story) => story.username === currentUser.username);
  const myBadge = storyOwnerBadge(currentUser.username);
  if(myStory){
    return `
      <article class="story-card my-story-card" onclick="viewStory('${escapeHtml(myStory._id)}')">
        <div class="story-preview-wrap my-story-preview active"><i class="fa-solid fa-circle-play"></i>${myBadge}</div>
        <div class="story-info">
          <strong>My story</strong>
          <p>${escapeHtml(myStory.caption || 'Tap to view your story')}</p>
          <small>${myStory.viewers.length} viewers</small>
        </div>
      </article>
    `;
  }

  const avatar = currentUser.profilePhoto
    ? `<img src="${photoUrl(currentUser.profilePhoto)}" alt="${escapeHtml(currentUser.username)}">`
    : `<span>${escapeHtml(currentUser.username.charAt(0).toUpperCase())}</span>`;
  return `
    <article class="story-card my-story-card empty-my-story" onclick="toggleStoryUpload()">
      <div class="story-preview-wrap my-story-preview empty-preview"><div class="story-id-badge">${avatar}</div></div>
      <div class="story-info">
        <strong>My story</strong>
        <p>No story uploaded</p>
        <small>Tap to add status</small>
      </div>
    </article>
  `;
}

async function viewStory(id){
  if(!currentUser) return;
  await fetch(`${API_BASE_URL}/api/stories/${id}/view`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: currentUser.username })
  });
  loadStories();
}

async function reactStory(id, reaction){
  if(!currentUser){
    alert('Login first.');
    return;
  }
  await fetch(`${API_BASE_URL}/api/stories/${id}/react`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: currentUser.username, reaction })
  });
  loadStories();
}

let searchTimer = null;

function quickSearch(){
  const value = byId('globalSearchInput').value;
  const pageInput = byId('searchPageInput');
  if(pageInput) pageInput.value = value;
  showPage('searchPage');
  runSearch(value);
}

function runSearch(value){
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => performSearch(value), 250);
}

async function performSearch(value){
  const results = byId('searchResults');
  if(!results) return;
  const q = String(value || '').trim();
  if(!q){
    results.innerHTML = '<div class="empty-state compact">Search users, groups, content, reels, and chats.</div>';
    return;
  }
  try{
    const username = currentUser ? currentUser.username : '';
    const response = await fetch(`${API_BASE_URL}/api/search?q=${encodeURIComponent(q)}&username=${encodeURIComponent(username)}`, {
      headers:authHeaders()
    });
    const data = await response.json();
    results.innerHTML = `
      <div class="search-column"><h3>Users</h3>${renderSearchUsers(data.users)}</div>
      <div class="search-column"><h3>Groups</h3>${renderSearchGroups(data.groups || [])}</div>
      <div class="search-column"><h3>Content</h3>${renderSearchContent(data.content || [])}</div>
      <div class="search-column"><h3>Reels</h3>${renderSearchReels(data.reels)}</div>
      <div class="search-column"><h3>Chats</h3>${renderSearchChats(data.chats)}</div>
    `;
  }catch(error){
    results.innerHTML = '<div class="empty-state compact">Search failed.</div>';
  }
}

function renderSearchGroups(groups){
  return groups.length ? groups.map((group) => `
    <button class="search-chat" onclick="openGroupChat('${group._id}','${escapeHtml(group.name)}')">
      <strong>${escapeHtml(group.name)}</strong>
      <small>${escapeHtml(group.description || `${(group.members || []).length} members`)}</small>
    </button>
  `).join('') : '<div class="empty-state compact">No groups.</div>';
}

function renderSearchContent(posts){
  return posts.length ? posts.map((post) => `
    <article class="search-reel">
      ${post.mediaType === 'image' ? `<img src="${post.mediaUrl}" alt="">` : post.mediaType === 'video' ? `<video src="${post.mediaUrl}" controls playsinline></video>` : ''}
      <strong>@${escapeHtml(post.username)}</strong>
      <small>${escapeHtml(post.caption || 'Post')}</small>
    </article>
  `).join('') : '<div class="empty-state compact">No content.</div>';
}

function renderSearchUsers(users){
  return users.length ? users.map((user) => {
    const isFriend = friendState.friends.includes(user.username);
    const requested = friendState.following.includes(user.username);
    return friendActionRow(
      user.username,
      `<button onclick="openChat('${user.username}')">Chat</button><button onclick="sendFriendRequest('${user.username}')">${isFriend ? 'Friend' : requested ? 'Requested' : 'Add'}</button>`
    );
  }).join('') : '<div class="empty-state compact">No users.</div>';
}

function renderSearchReels(reels){
  return reels.length ? reels.map((reel) => `
    <article class="search-reel">
      <video src="${reel.videoUrl}" controls playsinline></video>
      <strong>@${escapeHtml(reel.username)}</strong>
      <small>${escapeHtml(reel.caption)}</small>
    </article>
  `).join('') : '<div class="empty-state compact">No reels.</div>';
}

function renderSearchChats(chats){
  return chats.length ? chats.map((chat) => `
    <button class="search-chat" onclick="openChat('${chat.sender === (currentUser && currentUser.username) ? chat.receiver : chat.sender}')">
      <strong>${escapeHtml(chat.sender)} to ${escapeHtml(chat.receiver)}</strong>
      <small>${escapeHtml(chat.text || chat.fileName || chat.messageType)}</small>
    </button>
  `).join('') : '<div class="empty-state compact">No chats.</div>';
}

function applySettings(){
  const settings = JSON.parse(localStorage.getItem('shashiSettings') || '{}');
  document.body.classList.toggle('dark-mode', Boolean(settings.darkMode));
  document.body.dataset.theme = settings.theme || 'default';
  const galleryTheme = localStorage.getItem('shashiGalleryTheme') || '';
  document.body.style.backgroundImage = settings.theme === 'gallery' && galleryTheme
    ? `url(${galleryTheme})`
    : '';
  document.body.classList.toggle('gallery-theme', settings.theme === 'gallery' && Boolean(galleryTheme));

  const darkToggle = byId('darkModeToggle');
  const themeSelect = byId('themeSelect');
  if(darkToggle) darkToggle.checked = Boolean(settings.darkMode);
  if(themeSelect) themeSelect.value = settings.theme || 'default';

  const language = localStorage.getItem('shashiLanguage') || 'English';
  const settingsLanguageSelect = byId('settingsLanguageSelect');
  if(settingsLanguageSelect) settingsLanguageSelect.value = language;
  applyAccountSecurityView();
  document.documentElement.lang = language.toLowerCase();
  renderSettingsSummary();
}

function applyAccountSecurityView(){
  const privacy = currentUser && currentUser.privacy || {};
  if(byId('profileVisibilitySelect')) byId('profileVisibilitySelect').value = privacy.profileVisibility || 'everyone';
  if(byId('showOnlineStatusToggle')) byId('showOnlineStatusToggle').checked = privacy.showOnlineStatus !== false;
  if(byId('allowMessagesSelect')) byId('allowMessagesSelect').value = privacy.allowMessagesFrom || 'everyone';
  if(byId('twoFactorToggle')) byId('twoFactorToggle').checked = Boolean(currentUser && currentUser.twoFactorEnabled);
  if(byId('twoFactorMethodSelect')) byId('twoFactorMethodSelect').value = currentUser && currentUser.twoFactorMethod || 'email';
}

async function savePrivacySecurity(){
  const result = byId('settingsSecurityResult');
  if(!authToken){
    result.innerHTML = '<small>Login first to save protection settings.</small>';
    return;
  }
  try{
    const privacyResponse = await fetch(`${API_BASE_URL}/api/account/privacy`, {
      method:'PUT',
      headers:{...authHeaders(),'Content-Type':'application/json'},
      body:JSON.stringify({
        profileVisibility:byId('profileVisibilitySelect').value,
        showOnlineStatus:byId('showOnlineStatusToggle').checked,
        allowMessagesFrom:byId('allowMessagesSelect').value
      })
    });
    const securityResponse = await fetch(`${API_BASE_URL}/api/account/security`, {
      method:'PUT',
      headers:{...authHeaders(),'Content-Type':'application/json'},
      body:JSON.stringify({
        twoFactorEnabled:byId('twoFactorToggle').checked,
        twoFactorMethod:byId('twoFactorMethodSelect').value
      })
    });
    const privacyData = await privacyResponse.json();
    const securityData = await securityResponse.json();
    if(!privacyResponse.ok || !securityResponse.ok) throw new Error(privacyData.message || securityData.message);
    currentUser = securityData.user;
    currentUser.privacy = privacyData.user.privacy;
    localStorage.setItem('shashiUser', JSON.stringify(currentUser));
    result.innerHTML = '<strong>Protection saved</strong><small>Privacy and two-factor settings are active.</small>';
  }catch(error){
    result.innerHTML = `<small>${escapeHtml(error.message)}</small>`;
  }
}

async function createCloudBackup(){
  const result = byId('settingsBackupResult');
  if(!authToken){
    result.innerHTML = '<small>Login first to create a cloud backup.</small>';
    return;
  }
  try{
    const response = await fetch(`${API_BASE_URL}/api/account/backup`, {
      method:'POST',
      headers:{...authHeaders(),'Content-Type':'application/json'},
      body:JSON.stringify({
        settings:JSON.parse(localStorage.getItem('shashiSettings') || '{}'),
        language:localStorage.getItem('shashiLanguage') || 'English'
      })
    });
    const data = await response.json();
    if(!response.ok) throw new Error(data.message);
    result.innerHTML = `<strong>Backup completed</strong><small>${data.backup.messageCount} chats saved at ${new Date(data.backup.updatedAt).toLocaleString()}.</small>`;
  }catch(error){
    result.innerHTML = `<small>${escapeHtml(error.message)}</small>`;
  }
}

async function restoreCloudBackup(){
  const result = byId('settingsBackupResult');
  if(!authToken){
    result.innerHTML = '<small>Login first to restore a backup.</small>';
    return;
  }
  try{
    const response = await fetch(`${API_BASE_URL}/api/account/backup`, { headers:authHeaders() });
    const data = await response.json();
    if(!response.ok) throw new Error(data.message);
    localStorage.setItem('shashiSettings', JSON.stringify(data.settings || {}));
    applySettings();
    result.innerHTML = `<strong>Settings restored</strong><small>${data.messageCount || 0} backed-up chats are protected in cloud backup.</small>`;
  }catch(error){
    result.innerHTML = `<small>${escapeHtml(error.message)}</small>`;
  }
}

async function loadMonitoring(){
  const result = byId('settingsMonitoringResult');
  try{
    const requests = [fetch(`${API_BASE_URL}/api/monitoring`)];
    if(authToken) requests.push(fetch(`${API_BASE_URL}/api/account/activity`, { headers:authHeaders() }));
    const responses = await Promise.all(requests);
    const health = await responses[0].json();
    const activity = responses[1] ? await responses[1].json() : [];
    setSettingsStatus('monitoringStatus', health.server === 'online' ? 'Healthy' : 'Issue', health.server === 'online');
    result.innerHTML = `
      <div class="settings-pill-grid">
        <div class="settings-pill"><strong>${escapeHtml(health.mongo)}</strong><small>Database</small></div>
        <div class="settings-pill"><strong>${health.memoryMb} MB</strong><small>Server memory</small></div>
        <div class="settings-pill"><strong>${health.logins24h}</strong><small>Logins today</small></div>
        <div class="settings-pill"><strong>${health.crashes24h}</strong><small>Crashes today</small></div>
      </div>
      ${(activity || []).slice(0,5).map((item)=>`<small>${escapeHtml(item.type)}: ${escapeHtml(item.detail)}</small>`).join('')}
    `;
  }catch(error){
    setSettingsStatus('monitoringStatus', 'Unavailable', false);
    result.innerHTML = '<small>Monitoring is unavailable.</small>';
  }
}

function saveSettings(){
  const selectedTheme = byId('themeSelect') ? byId('themeSelect').value : 'default';
  const settings = {
    darkMode: Boolean(byId('darkModeToggle') && byId('darkModeToggle').checked),
    theme: selectedTheme
  };
  localStorage.setItem('shashiSettings', JSON.stringify(settings));
  if(selectedTheme === 'gallery' && !localStorage.getItem('shashiGalleryTheme')){
    const input = byId('themeGalleryInput');
    if(input) input.click();
  }
  applySettings();
}

function saveGalleryTheme(){
  const input = byId('themeGalleryInput');
  const file = input && input.files[0];
  if(!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    localStorage.setItem('shashiGalleryTheme', reader.result);
    const settings = JSON.parse(localStorage.getItem('shashiSettings') || '{}');
    settings.theme = 'gallery';
    localStorage.setItem('shashiSettings', JSON.stringify(settings));
    applySettings();
  };
  reader.readAsDataURL(file);
}

function saveLanguage(value){
  const language = value || (byId('settingsLanguageSelect') && byId('settingsLanguageSelect').value) || 'English';
  localStorage.setItem('shashiLanguage', language);
  applySettings();
}

function setSettingsStatus(id, text, online){
  const status = byId(id);
  if(!status) return;
  status.innerText = text;
  status.classList.toggle('offline', online === false);
}

function renderSettingsSummary(){
  const localData = byId('settingsLocalData');
  const connection = byId('settingsConnectionResult');

  if(localData){
    const keys = ['shashiUser', 'shashiToken', 'shashiSettings', 'shashiLanguage', 'shashiApiBase'];
    const savedCount = keys.filter((key) => localStorage.getItem(key)).length;
    localData.innerHTML = `
      <div class="settings-pill-grid">
        <div class="settings-pill"><strong>${savedCount}</strong><small>Saved items</small></div>
        <div class="settings-pill"><strong>${escapeHtml(localStorage.getItem('shashiLanguage') || 'English')}</strong><small>Language</small></div>
        <div class="settings-pill"><strong>${escapeHtml(JSON.parse(localStorage.getItem('shashiSettings') || '{}').theme || 'default')}</strong><small>Theme</small></div>
        <div class="settings-pill"><strong>${escapeHtml(API_BASE_URL)}</strong><small>Backend</small></div>
      </div>
    `;
  }

  if(connection && !connection.innerHTML){
    connection.innerHTML = `<small>${escapeHtml(API_BASE_URL)}</small>`;
  }
}

async function checkBackendFromSettings(){
  const result = byId('settingsConnectionResult');
  if(result) result.innerHTML = '<small>Checking backend...</small>';
  try{
    const response = await fetch(`${API_BASE_URL}/api/health`);
    const health = await response.json();
    const online = response.ok && health.ok;
    setSettingsStatus('settingsBackendStatus', online ? 'Online' : 'Issue', online);
    setStatus(online ? 'Backend online' : 'Backend issue', online);
    if(result){
      result.innerHTML = online
        ? `<strong>Backend online</strong><small>MongoDB: ${escapeHtml(health.mongo)} · ${escapeHtml(API_BASE_URL)}</small>`
        : `<strong>Backend issue</strong><small>${escapeHtml(API_BASE_URL)}</small>`;
    }
  }catch(error){
    setSettingsStatus('settingsBackendStatus', 'Offline', false);
    setStatus('Backend offline', false);
    if(result){
      result.innerHTML = `<strong>Backend offline</strong><small>${escapeHtml(API_BASE_URL)}</small>`;
    }
  }
}

async function loadPushStatus(){
  const container = byId('settingsPushStatus');
  if(!container) return;
  try{
    const response = await fetch(`${API_BASE_URL}/api/notifications/push/status`);
    const data = await response.json();
    container.innerHTML = `
      <strong>Push notifications</strong>
      <small>Firebase Admin: ${data.firebaseAdminInstalled ? 'ready' : 'not ready'}</small>
      <small>Credentials: ${data.credentials ? 'ready' : 'not configured'}</small>
      <small>Browser alerts: ${'Notification' in window ? Notification.permission : 'not supported'}</small>
    `;
  }catch(error){
    container.innerHTML = '<div class="empty-state compact">Push status unavailable.</div>';
  }
}

async function refreshSettingsStatus(){
  await Promise.all([
    checkBackendFromSettings(),
    loadStorageStatus(),
    loadSettingsStorageStatus(),
    loadPushStatus(),
    loadMonitoring()
  ]);
  setSettingsStatus('settingsCloudStatus', 'Updated', true);
  renderSettingsSummary();
}

async function loadSettingsStorageStatus(){
  const container = byId('settingsStorageStatus');
  if(!container) return;
  try{
    const response = await fetch(`${API_BASE_URL}/api/storage/status`);
    const data = await response.json();
    container.innerHTML = `
      <strong>Cloud storage</strong>
      <small>Active: ${escapeHtml(data.activeProvider)}</small>
      <small>Cloudinary: ${data.cloudinary ? 'ready' : 'not configured'}</small>
      <small>Firebase Storage: ${data.firebase ? 'ready' : 'not configured'}</small>
      <small>AWS S3: ${data.s3 ? 'ready' : 'not configured'}</small>
    `;
  }catch(error){
    container.innerHTML = '<div class="empty-state compact">Storage status unavailable.</div>';
  }
}

async function requestBrowserNotifications(){
  const container = byId('settingsPushStatus');
  if(!('Notification' in window)){
    if(container) container.innerHTML = '<div class="empty-state compact">Browser alerts are not supported here.</div>';
    return;
  }
  const permission = await Notification.requestPermission();
  if(container){
    container.innerHTML = `<strong>Browser alerts</strong><small>${escapeHtml(permission)}</small>`;
  }
}

function exportLocalData(){
  const data = {
    user: currentUser,
    settings: JSON.parse(localStorage.getItem('shashiSettings') || '{}'),
    language: localStorage.getItem('shashiLanguage') || 'English',
    apiBase: API_BASE_URL,
    exportedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
link.download = 'shashi-local-data.json';
  link.click();
  URL.revokeObjectURL(url);
}

function clearLocalAppData(){
  if(!confirm('Clear saved login, settings, and backend URL from this browser?')) return;
  ['shashiUser', 'shashiToken', 'shashiSettings', 'shashiLanguage', 'shashiApiBase'].forEach((key) => localStorage.removeItem(key));
  currentUser = null;
  authToken = '';
  window.location.reload();
}

document.addEventListener('DOMContentLoaded', () => {
  syncSettingsInputs();
  applySettings();
  loadFriendState();
  loadStories();
  loadStorageStatus();
  loadSettingsStorageStatus();
  loadPushStatus();
  checkBackendFromSettings();
  loadAiRecommendations();
  loadExplore();
  loadGroups();
  loadAdvancedAnalytics();
  loadMonitoring();
});

window.addEventListener('error', (event) => {
  if(!authToken) return;
  fetch(`${API_BASE_URL}/api/account/crash`, {
    method:'POST',
    headers:{...authHeaders(),'Content-Type':'application/json'},
    body:JSON.stringify({ detail:`${event.message} at ${event.filename}:${event.lineno}` })
  }).catch(()=>{});
});

async function advancedFetch(path, options){
  const config = options || {};
  config.headers = { ...authHeaders(), ...(config.headers || {}) };
  const response = await fetch(`${API_BASE_URL}/api/advanced${path}`, config);
  const data = await response.json().catch(() => ({}));
  if(!response.ok){
    throw new Error(data.message || 'Advanced action failed');
  }
  return data;
}

async function loadExplore(){
  const container = byId('advancedExplore');
  if(!container) return;
  try{
    const data = await advancedFetch('/explore');
    const tags = data.hashtags.length
      ? data.hashtags.map((item) => `<span class="status">#${escapeHtml(item.tag)} ${item.count}</span>`).join(' ')
      : '<small>No hashtags yet.</small>';
    const reels = data.reels.slice(0, 5).map((reel) => `
      <div class="advanced-card">
        <strong>@${escapeHtml(reel.username)} ${reel.score ? 'Trending' : ''}</strong>
        <small>${escapeHtml(reel.caption || 'No caption')}</small>
        <small>${(reel.likes || []).length} likes · ${(reel.comments || []).length} comments</small>
      </div>
    `).join('');
    const users = data.users.slice(0, 5).map((user) => `
      <div class="advanced-card">
        <strong>@${escapeHtml(user.username)} ${user.verified ? 'Verified' : ''}</strong>
        <small>${user.online ? 'Online' : 'Offline'} · ${(user.followers || []).length} followers</small>
      </div>
    `).join('');
    container.innerHTML = `<h3>Hashtags</h3><div>${tags}</div><h3>Trending reels</h3>${reels || '<small>No reels yet.</small>'}<h3>Suggested users</h3>${users || '<small>No users yet.</small>'}`;
  }catch(error){
    container.innerHTML = `<div class="empty-state compact">${escapeHtml(error.message)}</div>`;
  }
}

async function loadGroups(){
  const container = byId('groupsList');
  const friendGroupsList = byId('friendGroupsList');
  const chatGroupsList = byId('chatGroupsList');
  if(!container && !friendGroupsList && !chatGroupsList) return;
  try{
    const username = currentUser ? currentUser.username : '';
    appGroups = currentUser ? await advancedFetch(`/groups?username=${encodeURIComponent(username)}`) : [];
    advancedGroups = appGroups;
    renderChatGroups();
    renderFriendSystem();
    if(!container) return;
    container.innerHTML = advancedGroups.length
      ? advancedGroups.map((group) => `
        <div class="advanced-card">
          <strong>${escapeHtml(group.name)}</strong>
          <small>${escapeHtml(group.description || 'Group chat')}</small>
          <small>${group.members.length} members</small>
          <button class="ghost-btn" onclick="openGroupChat('${group._id}','${escapeHtml(group.name)}')">Open group</button>
        </div>
      `).join('')
      : '<div class="empty-state compact">No groups yet.</div>';
  }catch(error){
    if(container){
      container.innerHTML = `<div class="empty-state compact">${escapeHtml(error.message)}</div>`;
    }
  }
}

async function createGroup(){
  if(!currentUser){
    alert('Login first.');
    return;
  }
  const name = byId('groupNameInput').value.trim();
  const members = byId('groupMembersInput').value.split(',').map((item) => item.trim()).filter(Boolean);
  if(!name){
    alert('Group name is required.');
    return;
  }
  await advancedFetch('/groups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, owner: currentUser.username, members })
  });
  byId('groupNameInput').value = '';
  byId('groupMembersInput').value = '';
  loadGroups();
}

async function createFriendGroup(){
  const message = byId('friendGroupMessage');
  if(!currentUser){
    if(message) message.innerText = 'Login first.';
    return;
  }

  const nameInput = byId('friendGroupNameInput');
  const name = nameInput.value.trim();
  const members = [...document.querySelectorAll('#friendGroupPicker input:checked')]
    .map((input) => input.value)
    .filter(Boolean);

  if(!name){
    if(message) message.innerText = 'Group name is required.';
    return;
  }

  if(members.length === 0){
    if(message) message.innerText = 'Select at least one friend.';
    return;
  }

  try{
    await advancedFetch('/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, owner: currentUser.username, members })
    });
    nameInput.value = '';
    document.querySelectorAll('#friendGroupPicker input:checked').forEach((input) => {
      input.checked = false;
    });
    if(message) message.innerText = 'Group created.';
    loadGroups();
  }catch(error){
    if(message) message.innerText = error.message;
  }
}

async function updateGroupPermission(groupId, allowMembersToAdd){
  if(!currentUser) return;
  try{
    await advancedFetch(`/groups/${groupId}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actor: currentUser.username,
        allowMembersToAdd
      })
    });
    loadGroups();
  }catch(error){
    alert(error.message);
    loadGroups();
  }
}

async function addGroupMember(groupId){
  if(!currentUser) return;
  const select = byId(`add-member-${groupId}`);
  const username = select ? select.value : '';
  if(!username){
    alert('Select a contact to add.');
    return;
  }

  try{
    await advancedFetch(`/groups/${groupId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actor: currentUser.username,
        username
      })
    });
    loadGroups();
  }catch(error){
    alert(error.message);
  }
}

async function makeGroupAdmin(groupId){
  if(!currentUser) return;
  const select = byId(`make-admin-${groupId}`);
  const username = select ? select.value : '';
  if(!username){
    alert('Select a group member to make admin.');
    return;
  }

  try{
    await advancedFetch(`/groups/${groupId}/admins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actor: currentUser.username,
        username
      })
    });
    loadGroups();
  }catch(error){
    alert(error.message);
  }
}

function groupById(groupId){
  return appGroups.find((group) => String(group._id) === String(groupId));
}

async function editGroupFromCard(groupId){
  const group = groupById(groupId);
  if(!group) return;
  const name = prompt('Group name:', group.name);
  if(name === null) return;
  const description = prompt('Group description:', group.description || '');
  if(description === null) return;
  try{
    await advancedFetch(`/groups/${groupId}`, {
      method:'PUT',
      headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify({ name, description })
    });
    loadGroups();
  }catch(error){
    alert(error.message);
  }
}

async function removeGroupMember(groupId){
  if(!currentUser) return;
  const select = byId(`remove-member-${groupId}`);
  const username = select ? select.value : '';
  if(!username){
    alert('Select a member to remove.');
    return;
  }
  try{
    await advancedFetch(`/groups/${groupId}/members/${encodeURIComponent(username)}`, {
      method:'DELETE'
    });
    loadGroups();
  }catch(error){
    alert(error.message);
  }
}

async function removeGroupAdmin(groupId){
  if(!currentUser) return;
  const select = byId(`remove-admin-${groupId}`);
  const username = select ? select.value : '';
  if(!username){
    alert('Select an admin to remove.');
    return;
  }
  try{
    await advancedFetch(`/groups/${groupId}/admins/${encodeURIComponent(username)}`, {
      method:'DELETE'
    });
    loadGroups();
  }catch(error){
    alert(error.message);
  }
}

async function clearGroupChatFromCard(groupId){
  const group = groupById(groupId);
  if(!group || !currentUser) return;
  if(!confirm(`Clear full group chat in ${group.name}?`)) return;
  try{
    const receiver = `group:${groupId}`;
    const params = new URLSearchParams({
      sender: currentUser.username,
      receiver
    });
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/messages/conversation?${params.toString()}`, {
      method:'DELETE',
      headers:authHeaders()
    }, 6000);
    const data = await response.json().catch(() => ({}));
    if(!response.ok){
      throw new Error(data.message || 'Could not clear group chat');
    }
    writeLocalMessages(readLocalMessages().filter((message) => message.receiver !== receiver));
    if(currentChatUser === receiver){
      currentConversationMessages = [];
      loadMessages();
    }
    alert('Group chat cleared.');
  }catch(error){
    alert(error.message);
  }
}

async function leaveGroupFromCard(groupId){
  const group = groupById(groupId);
  if(!group || !currentUser) return;
  if(!confirm(`Leave ${group.name}?`)) return;
  try{
    await advancedFetch(`/groups/${groupId}/leave`, {
      method:'POST'
    });
    loadGroups();
  }catch(error){
    alert(error.message);
  }
}

async function deleteGroupFromCard(groupId){
  const group = groupById(groupId);
  if(!group || !currentUser) return;
  if(!confirm(`Delete ${group.name} for everyone? This also deletes group messages.`)) return;
  try{
    await advancedFetch(`/groups/${groupId}`, {
      method:'DELETE'
    });
    loadGroups();
  }catch(error){
    alert(error.message);
  }
}

function openGroupChat(groupId, groupName){
currentChatUser = `group:${groupId}`;
clearPendingChatAttachments();
markChatRead(currentChatUser);
clearChatGameView();
byId('chatUser').innerText = groupName;
const avatar = byId('chatPersonAvatar');
if(avatar){
avatar.innerText = groupName.charAt(0).toUpperCase();
}
showPage('conversationPage');
refreshChatListTimes();
updateChatMenuState();
applyChatTheme();
loadMessages();
}

async function blockAdvancedUser(){
  if(!currentUser){
    alert('Login first.');
    return;
  }
  const blockedUser = byId('safetyUserInput').value.trim();
  const user = await advancedFetch('/block', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: currentUser.username, blockedUser })
  });
  currentUser = user;
  localStorage.setItem('shashiUser', JSON.stringify(currentUser));
  byId('safetyResult').innerHTML = `<div class="advanced-card"><strong>Blocked @${escapeHtml(blockedUser)}</strong></div>`;
}

async function unblockAdvancedUser(){
  if(!currentUser){
    alert('Login first.');
    return;
  }
  const blockedUser = byId('safetyUserInput').value.trim();
  const user = await advancedFetch('/unblock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: currentUser.username, blockedUser })
  });
  currentUser = user;
  localStorage.setItem('shashiUser', JSON.stringify(currentUser));
  byId('safetyResult').innerHTML = `<div class="advanced-card"><strong>Unblocked @${escapeHtml(blockedUser)}</strong></div>`;
}

async function reportAdvancedUser(){
  if(!currentUser){
    alert('Login first.');
    return;
  }
  const targetUser = byId('safetyUserInput').value.trim();
  const reason = byId('reportReasonInput').value.trim();
  await advancedFetch('/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reporter: currentUser.username, targetType: 'user', targetUser, reason })
  });
  byId('safetyResult').innerHTML = `<div class="advanced-card"><strong>Report sent</strong><small>@${escapeHtml(targetUser)}</small></div>`;
  loadAdvancedAnalytics();
}

async function loadAdvancedAnalytics(){
  const analytics = byId('advancedAnalytics');
  const reportsList = byId('reportsList');
  if(!analytics) return;
  try{
    const data = await advancedFetch('/analytics');
    analytics.innerHTML = `
      <div class="settings-pill-grid">
        <div class="settings-pill"><strong>${data.users}</strong><small>Users</small></div>
        <div class="settings-pill"><strong>${data.onlineUsers}</strong><small>Online</small></div>
        <div class="settings-pill"><strong>${data.messages}</strong><small>Messages</small></div>
        <div class="settings-pill"><strong>${data.reels}</strong><small>Reels</small></div>
        <div class="settings-pill"><strong>${data.groups}</strong><small>Groups</small></div>
        <div class="settings-pill"><strong>${data.openReports}</strong><small>Open reports</small></div>
      </div>
    `;
    if(reportsList){
      const reports = await advancedFetch('/reports');
      reportsList.innerHTML = reports.slice(0, 6).map((report) => `
        <div class="advanced-card">
          <strong>${escapeHtml(report.targetType)} report</strong>
          <small>${escapeHtml(report.reporter)} reported ${escapeHtml(report.targetUser || report.targetId || 'item')}</small>
          <small>${escapeHtml(report.reason)}</small>
        </div>
      `).join('') || '<div class="empty-state compact">No reports yet.</div>';
    }
  }catch(error){
    analytics.innerHTML = `<div class="empty-state compact">${escapeHtml(error.message)}</div>`;
  }
}

async function loadAiRecommendations(){
  const container = byId('aiRecommendations');
  if(!container) return;
  try{
    const username = currentUser ? currentUser.username : '';
    const response = await fetch(`${API_BASE_URL}/api/ai/recommendations?username=${encodeURIComponent(username)}`);
    if(!response.ok) throw new Error('Could not load recommendations');
    const data = await response.json();
    container.innerHTML = `
      <h3>People</h3>
      ${data.users.length ? data.users.map((user) => friendActionRow(user.username, `<button onclick="sendFriendRequest('${user.username}')">Add</button>`)).join('') : '<div class="empty-state compact">No users yet.</div>'}
      <h3>Reels</h3>
      ${data.reels.length ? renderSearchReels(data.reels) : '<div class="empty-state compact">No reels yet.</div>'}
      <small>${escapeHtml(data.reason)}</small>
    `;
  }catch(error){
    container.innerHTML = '<div class="empty-state compact">AI recommendations unavailable.</div>';
  }
}

async function moderateAiText(){
  const result = byId('aiToolResult');
  const text = byId('aiTextInput').value;
  const response = await fetch(`${API_BASE_URL}/api/ai/moderate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  const data = await response.json();
  result.innerHTML = `<strong>${data.allowed ? 'Allowed' : 'Blocked'}</strong><small>${escapeHtml(data.message)} Risk: ${escapeHtml(data.risk)}</small>`;
}

async function translateAiText(){
  const result = byId('aiToolResult');
  const text = byId('aiTextInput').value;
  const language = byId('aiLanguageSelect').value;
  const response = await fetch(`${API_BASE_URL}/api/ai/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language })
  });
  const data = await response.json();
  result.innerHTML = `<strong>${escapeHtml(data.language)}</strong><small>${escapeHtml(data.translated)}</small>`;
}

async function captionAiMedia(){
  const result = byId('aiToolResult');
  const file = byId('aiCaptionInput').files[0];
  if(!file){
    result.innerHTML = '<small>Choose a photo or video first.</small>';
    return;
  }
  const response = await fetch(`${API_BASE_URL}/api/ai/caption`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mediaType: file.type, fileName: file.name })
  });
  const data = await response.json();
  result.innerHTML = `<strong>${escapeHtml(data.caption)}</strong><small>${escapeHtml(data.hashtags.join(' '))}</small>`;
}

async function loadStorageStatus(){
  const container = byId('storageStatus');
  if(!container) return;
  try{
    const response = await fetch(`${API_BASE_URL}/api/storage/status`);
    const data = await response.json();
    container.innerHTML = `
      <strong>Active: ${escapeHtml(data.activeProvider)}</strong>
      <small>Cloudinary: ${data.cloudinary ? 'ready' : 'not configured'}</small>
      <small>Firebase Storage: ${data.firebase ? 'ready' : 'not configured'}</small>
      <small>AWS S3: ${data.s3 ? 'ready' : 'not configured'}</small>
      <small>Fallback: ${escapeHtml(data.fallback)}</small>
    `;
  }catch(error){
    container.innerHTML = '<div class="empty-state compact">Storage status unavailable.</div>';
  }
}
