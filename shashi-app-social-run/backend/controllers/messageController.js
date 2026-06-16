const Message = require('../models/Message');
const User = require('../models/User');
const Group = require('../models/Group');
const Notification = require('../models/Notification');
const { sendPushToUser } = require('../services/pushService');
const mongoose = require('mongoose');
const fs = require('fs/promises');
const path = require('path');

const fallbackFile = path.join(__dirname, '..', 'data', 'local-messages.json');
const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;
const MAX_TEXT_LENGTH = 4000;
const MAX_MEDIA_URL_LENGTH = Number(process.env.MAX_MEDIA_URL_LENGTH || 8 * 1024 * 1024);
const MAX_FILE_NAME_LENGTH = 180;

function fail(message, status = 400){
  const error = new Error(message);
  error.status = status;
  throw error;
}

function compactString(value, maxLength){
  return String(value || '').trim().slice(0, maxLength);
}

function mongoReady(){
  return Message.db.readyState === 1;
}

async function readFallbackMessages(){
  try {
    const text = await fs.readFile(fallbackFile, 'utf8');
    return JSON.parse(text);
  } catch(error) {
    return [];
  }
}

async function writeFallbackMessages(messages){
  await fs.mkdir(path.dirname(fallbackFile), { recursive: true });
  await fs.writeFile(fallbackFile, JSON.stringify(messages, null, 2));
}

function extractTags(text){
  const value = String(text || '');
  return {
    hashtags: [...new Set((value.match(/#[a-zA-Z0-9_]+/g) || []).map((tag) => tag.slice(1).toLowerCase()))],
    mentions: [...new Set((value.match(/@[a-zA-Z0-9_]+/g) || []).map((tag) => tag.slice(1)))]
  };
}

function cleanMessage(body){
  const sender = compactString(body.sender, 32);
  const receiver = compactString(body.receiver, 80);
  const text = compactString(body.text, MAX_TEXT_LENGTH);
  const messageType = String(body.messageType || (body.mediaUrl ? 'file' : 'text')).trim();

  if(!sender || !receiver){
    fail('Sender and receiver are required');
  }

  if(!USERNAME_RE.test(sender)){
    fail('Invalid sender');
  }

  if(!text && !body.mediaUrl){
    fail('Message text or media is required');
  }

  const allowedTypes = ['text', 'image', 'video', 'file', 'voice', 'location', 'liveLocation', 'contact'];
  const mediaUrl = compactString(body.mediaUrl, MAX_MEDIA_URL_LENGTH + 1);
  if(mediaUrl.length > MAX_MEDIA_URL_LENGTH){
    fail('Media payload is too large');
  }

  const mediaType = compactString(body.mediaType, 120);
  const fileName = path.basename(compactString(body.fileName, MAX_FILE_NAME_LENGTH));

  return {
    clientId: compactString(body.clientId, 80),
    sender,
    receiver,
    groupId: compactString(body.groupId, 80),
    text,
    messageType: allowedTypes.includes(messageType) ? messageType : 'file',
    mediaUrl,
    mediaType,
    fileName,
    emoji: compactString(body.emoji, 80),
    status: 'sent',
    ...extractTags(text)
  };
}

function messageNotificationText(message){
  if(message.messageType === 'image') return `${message.sender} sent you a photo`;
  if(message.messageType === 'video') return `${message.sender} sent you a video`;
  if(message.messageType === 'file') return `${message.sender} sent you a file`;
  if(message.messageType === 'voice') return `${message.sender} sent you a voice message`;
  if(message.messageType === 'location' || message.messageType === 'liveLocation') return `${message.sender} sent you a location`;
  if(message.messageType === 'contact') return `${message.sender} sent you a contact`;
  const text = String(message.text || '').trim();
  return text ? `${message.sender}: ${text.slice(0, 120)}` : `${message.sender} sent you a message`;
}

async function notifyDirectMessage(message){
  if(!mongoReady()) return;
  if(!message || !message.sender || !message.receiver) return;
  if(message.sender === message.receiver || String(message.receiver).startsWith('group:')) return;

  const clientId = message.clientId || String(message._id || '');
  const existing = clientId
    ? await Notification.findOne({
      recipient: message.receiver,
      sender: message.sender,
      type: 'message',
      clientId
    })
    : null;
  if(existing) return;

  const notification = await Notification.create({
    recipient: message.receiver,
    sender: message.sender,
    type: 'message',
    text: messageNotificationText(message),
    clientId
  });
  const push = await sendPushToUser(notification.recipient, {
    title: 'shashi',
    body: notification.text,
    type: notification.type,
    sender: notification.sender
  });
  notification.pushSent = push.sent > 0;
  await notification.save();
}

exports.saveMessage = async (req, res) => {

  try {
    const payload = cleanMessage(req.body);
    const senderUser = await User.findById(req.user.id).select('username blockedUsers');
    if(!senderUser || senderUser.username !== payload.sender){
      return res.status(403).json({ message: 'You can only send messages from your own account' });
    }

    if(mongoReady() && String(payload.receiver).startsWith('group:')){
      const groupId = String(payload.receiver).replace('group:', '');
      const group = await Group.findById(groupId);
      if(!group){
        return res.status(404).json({ message: 'Group not found' });
      }
      if(!group.members.includes(payload.sender)){
        return res.status(403).json({ message: 'You are not a member of this group' });
      }
      payload.groupId = groupId;
    }

    if(mongoReady() && payload.sender && payload.receiver && payload.sender !== payload.receiver && !String(payload.receiver).startsWith('group:')){
      const receiver = await User.findOne({ username: payload.receiver }).select('blockedUsers privacy friends');
      if(receiver && receiver.blockedUsers.includes(payload.sender)){
        return res.status(403).json({ message: 'This user has blocked messages from you' });
      }
      if(receiver && receiver.privacy && (
        receiver.privacy.allowMessagesFrom === 'nobody' ||
        receiver.privacy.allowMessagesFrom === 'friends' && !receiver.friends.includes(payload.sender)
      )){
        return res.status(403).json({ message: 'This user only accepts messages allowed by their privacy settings' });
      }
    }

    if(!mongoReady()){
      const messages = await readFallbackMessages();
      const message = {
        _id: `local_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        ...payload,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        storage: 'local-fallback'
      };
      messages.push(message);
      await writeFallbackMessages(messages);
      return res.status(201).json(message);
    }

    const message = await Message.create(payload);
    notifyDirectMessage(message).catch((error) => console.log(error.message));

    res.status(201).json(message);

  } catch(error){

    res.status(error.status || 500).json({
      message: error.message
    });

  }

};

exports.getMessages = async (req, res) => {

  try {
    const { sender, receiver } = req.query;
    const limit = Math.min(Math.max(Number(req.query.limit) || 150, 1), 500);
    const requestingUser = await User.findById(req.user.id).select('username');
    if(!requestingUser || (sender && sender !== requestingUser.username)){
      return res.status(403).json({ message: 'You can only load your own chats' });
    }
    const isGroupChat = String(receiver || '').startsWith('group:');

    if(mongoReady() && isGroupChat){
      const groupId = String(receiver).replace('group:', '');
      const group = await Group.findById(groupId);
      if(!group){
        return res.status(404).json({ message: 'Group not found' });
      }
      if(!group.members.includes(requestingUser.username)){
        return res.status(403).json({ message: 'You are not a member of this group' });
      }
    }

    if(!mongoReady()){
      const messages = await readFallbackMessages();
      const filteredMessages = isGroupChat
        ? messages.filter((message) => message.receiver === receiver)
        : sender && receiver
        ? messages.filter((message) => (
          (message.sender === sender && message.receiver === receiver) ||
          (message.sender === receiver && message.receiver === sender)
        ))
        : messages;
      return res.json(filteredMessages.slice(-limit));
    }

    const query = isGroupChat
      ? { receiver }
      : sender && receiver
      ? {
        $or: [
          { sender, receiver },
          { sender: receiver, receiver: sender }
        ]
      }
      : {};

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json(messages.reverse());

  } catch(error){

    res.status(500).json({
      message: error.message
    });

  }

};

exports.deleteConversation = async (req, res) => {

  try {
    const { sender, receiver } = req.query;
    const requestingUser = await User.findById(req.user.id).select('username');

    if(!sender || !receiver){
      return res.status(400).json({ message: 'Sender and receiver are required' });
    }

    if(!requestingUser || sender !== requestingUser.username){
      return res.status(403).json({ message: 'You can only clear your own chats' });
    }

    const matchesConversation = (message) => (
      (message.sender === sender && message.receiver === receiver) ||
      (message.sender === receiver && message.receiver === sender) ||
      (message.sender === 'You' && message.receiver === receiver)
    );

    const isGroupChat = String(receiver).startsWith('group:');
    if(mongoReady() && isGroupChat){
      const groupId = String(receiver).replace('group:', '');
      const group = await Group.findById(groupId);
      if(!group){
        return res.status(404).json({ message: 'Group not found' });
      }
      if(!group.admins.includes(sender)){
        return res.status(403).json({ message: 'Only group admins can clear group chat' });
      }
    }

    if(!mongoReady()){
      const messages = await readFallbackMessages();
      const remainingMessages = messages.filter((message) => (
        isGroupChat
          ? message.receiver !== receiver
          : !matchesConversation(message)
      ));
      await writeFallbackMessages(remainingMessages);
      return res.json({
        message: 'Chat cleared',
        deletedCount: messages.length - remainingMessages.length
      });
    }

    const result = isGroupChat
      ? await Message.deleteMany({ receiver })
      : await Message.deleteMany({
        $or: [
          { sender, receiver },
          { sender: receiver, receiver: sender },
          { sender: 'You', receiver }
        ]
      });

    res.json({
      message: 'Chat cleared',
      deletedCount: result.deletedCount || 0
    });

  } catch(error){

    res.status(error.status || 500).json({
      message: error.message
    });

  }

};

exports.deleteMessage = async (req, res) => {

  try {
    const { id } = req.params;
    const requestingUser = await User.findById(req.user.id).select('username');

    if(!requestingUser){
      return res.status(403).json({ message: 'Login required' });
    }

    const matchesMessage = (message) => (
      String(message._id) === String(id) ||
      String(message.clientId || '') === String(id)
    );

    if(!mongoReady()){
      const messages = await readFallbackMessages();
      const remainingMessages = messages.filter((message) => !(
        matchesMessage(message) &&
        (message.sender === requestingUser.username || message.receiver === requestingUser.username)
      ));
      await writeFallbackMessages(remainingMessages);
      return res.json({
        message: 'Message deleted',
        deletedCount: messages.length - remainingMessages.length
      });
    }

    const lookup = mongoose.Types.ObjectId.isValid(id)
      ? { $or: [{ _id: id }, { clientId: id }] }
      : { clientId: id };

    const result = await Message.deleteOne({
      $and: [
        lookup,
        {
          $or: [
            { sender: requestingUser.username },
            { receiver: requestingUser.username }
          ]
        }
      ]
    });

    res.json({
      message: 'Message deleted',
      deletedCount: result.deletedCount || 0
    });

  } catch(error){

    res.status(error.status || 500).json({
      message: error.message
    });

  }

};
