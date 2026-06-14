require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { jwtSecret, verifyAuthToken } = require('./utils/authToken');
const {
  securityHeaders,
  rateLimit,
  sanitizeInput,
  requireHttps
} = require('./middleware/securityMiddleware');
const authMiddleware = require('./middleware/authMiddleware');

const authRoutes = require('./routes/authRoutes');
const messageRoutes = require('./routes/messageRoutes');
const reelRoutes = require('./routes/reelRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const friendRoutes = require('./routes/friendRoutes');
const storyRoutes = require('./routes/storyRoutes');
const searchRoutes = require('./routes/searchRoutes');
const aiRoutes = require('./routes/aiRoutes');
const storageRoutes = require('./routes/storageRoutes');
const advancedRoutes = require('./routes/advancedRoutes');
const postRoutes = require('./routes/postRoutes');
const accountRoutes = require('./routes/accountRoutes');
const Activity = require('./models/Activity');
const User = require('./models/User');
const Notification = require('./models/Notification');
const { sendPushToUser } = require('./services/pushService');

const app = express();
const server = http.createServer(app);
let mongoConnectionError = '';
let mongoConnecting = false;
const frontendPath = path.join(__dirname, '..', 'frontend');
const bodyLimit = process.env.BODY_LIMIT || '25mb';
const mongoRetryMs = Number(process.env.MONGO_RETRY_MS || 15000);
const mongoServerSelectionTimeoutMs = Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 10000);
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://127.0.0.1:5000,http://localhost:5000,http://10.0.2.2:5000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedSocketGameIds = new Set(['ticTacToe', 'chess', 'checkers', 'ludo', 'carrom']);
const allowedSocketMessageTypes = new Set(['text', 'image', 'video', 'file', 'voice', 'location', 'liveLocation', 'contact']);
const allowedNotificationTypes = new Set([
  'message',
  'friend_request',
  'friend_accept',
  'reel_like',
  'reel_comment',
  'story_reaction',
  'like',
  'comment',
  'post_like',
  'post_comment',
  'follow_request',
  'system'
]);

function assertSecureConfig(){
  jwtSecret();
}

function configuredValue(value){
  const text = String(value || '').trim();
  return Boolean(text && !/your-|replace_|example\.com|google-services\.json/i.test(text));
}

function deploymentStatus(){
  const mongoUri = String(process.env.MONGO_URI || '');
  const atlasMongo = /^mongodb(\+srv)?:\/\/.+\.mongodb\.net/i.test(mongoUri);
  const localMongo = /^mongodb:\/\/(127\.0\.0\.1|localhost)/i.test(mongoUri);
  const cloudinaryReady = configuredValue(process.env.CLOUDINARY_CLOUD_NAME)
    && configuredValue(process.env.CLOUDINARY_UPLOAD_PRESET || process.env.CLOUDINARY_UPLOAD_PRESENT);
  const firebaseBackendReady = configuredValue(process.env.GOOGLE_APPLICATION_CREDENTIALS)
    || configuredValue(process.env.FIREBASE_CONFIG);
  const frontendOriginReady = configuredValue(process.env.CLIENT_ORIGIN);
  const productionMode = process.env.NODE_ENV === 'production';

  const missing = [];
  if(!atlasMongo) missing.push('MongoDB Atlas URI');
  if(!frontendOriginReady) missing.push('public frontend URL');
  if(!cloudinaryReady) missing.push('Cloudinary cloud name/upload preset');
  if(!firebaseBackendReady) missing.push('Firebase backend credentials for push notifications');
  if(!productionMode) missing.push('NODE_ENV=production for hosting');

  return {
    readyForPublicHosting: missing.length === 0,
    productionMode,
    database: {
      configured: configuredValue(mongoUri),
      atlasMongo,
      localMongo
    },
    storage: {
      activeProvider: process.env.STORAGE_PROVIDER || 'local-data-url',
      cloudinaryReady,
      firebaseStorageReady: configuredValue(process.env.FIREBASE_STORAGE_BUCKET),
      s3Ready: configuredValue(process.env.AWS_REGION) && configuredValue(process.env.AWS_S3_BUCKET)
    },
    pushNotifications: {
      backendCredentialsReady: firebaseBackendReady,
      androidFileNeeded: 'android/app/google-services.json'
    },
    hosting: {
      frontendOriginReady,
      httpsRequired: productionMode
    },
    missing
  };
}

function payloadSize(value){
  try{
    return JSON.stringify(value || {}).length;
  }catch(error){
    return Number.MAX_SAFE_INTEGER;
  }
}

function compactString(value, maxLength){
  return String(value || '').trim().slice(0, maxLength);
}

function safeSocketMessage(data, actorUsername){
  if(!data || payloadSize(data) > 20000) return null;
  const sender = compactString(data.sender, 32);
  const receiver = compactString(data.receiver, 80);
  const text = compactString(data.text, 4000);
  const messageType = compactString(data.messageType || 'text', 30);
  if(sender !== actorUsername || !receiver) return null;
  if(!allowedSocketMessageTypes.has(messageType)) return null;
  return {
    ...data,
    sender,
    receiver,
    text,
    messageType,
    mediaUrl: compactString(data.mediaUrl, 2048),
    mediaType: compactString(data.mediaType, 120),
    fileName: path.basename(compactString(data.fileName, 180))
  };
}

function safeSocketGameAction(data, actorUsername){
  if(!data || payloadSize(data) > 60000) return null;
  if(compactString(data.sender, 32) !== actorUsername) return null;
  if(!allowedSocketGameIds.has(data.gameId)) return null;
  if(!Array.isArray(data.players) || data.players.length !== 2 || !data.players.includes(actorUsername)) return null;
  if(!data.state || typeof data.state !== 'object') return null;
  if(data.state.gameId !== data.gameId || !data.players.includes(data.state.turn)) return null;
  data.state.players = data.players;
  return data;
}

function safeSocketNotification(data, actorUsername){
  if(!data || payloadSize(data) > 5000) return null;
  const type = compactString(data.type, 40);
  const recipient = compactString(data.recipient, 80);
  if(!recipient || !allowedNotificationTypes.has(type)) return null;
  return {
    recipient,
    sender: actorUsername,
    type,
    text: compactString(data.text, 240)
  };
}

function requireJsonApi(req, res, next){
  const needsBody = ['POST', 'PUT', 'PATCH'].includes(req.method);
  if(!needsBody || !req.path.startsWith('/api')){
    return next();
  }
  if(req.is('application/json') || req.is('multipart/form-data')){
    return next();
  }
  return res.status(415).json({ message: 'Unsupported content type' });
}

function requireAdmin(req, res, next){
  if(!req.user || req.user.role !== 'admin'){
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
}

assertSecureConfig();

const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? allowedOrigins : true
  },
  maxHttpBufferSize: 1e6,
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000
  }
});

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if(!token) return next(new Error('Authentication required'));
    const verified = verifyAuthToken(token);
    const user = await User.findById(verified.id).select('+tokenVersion username role');
    if(!user || (user.tokenVersion || 0) !== Number(verified.tv || 0)){
      return next(new Error('Invalid socket token'));
    }
    socket.authUser = {
      id: String(user._id),
      username: user.username,
      role: user.role
    };
    next();
  } catch(error) {
    next(new Error('Invalid socket token'));
  }
});

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(requireHttps);
app.use(securityHeaders);
app.use(rateLimit);
app.use(cors({
  origin(origin, callback){
    if(process.env.NODE_ENV !== 'production'){
      return callback(null, true);
    }

    if(!origin || allowedOrigins.includes(origin)){
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  }
}));
app.use(requireJsonApi);
app.use(express.json({ limit: bodyLimit, strict: true }));
app.use(sanitizeInput);
app.use('/uploads', (req, res, next) => {
  if(/\.(json|env|js|map)$/i.test(req.path)){
    return res.status(404).send('Not found');
  }
  next();
}, express.static(path.join(__dirname, 'uploads'), {
  dotfiles: 'deny',
  fallthrough: false,
  setHeaders(res){
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=86400');
  }
}));
app.use(express.static(frontendPath, {
  dotfiles: 'deny',
  setHeaders(res, filePath){
    if(filePath.endsWith('.html')){
      res.setHeader('Cache-Control', 'no-store');
    }
  }
}));

async function connectMongo() {
  if (!process.env.MONGO_URI) {
    mongoConnectionError = 'MONGO_URI is not configured';
    return;
  }

  if (mongoConnecting || mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
    return;
  }

  mongoConnecting = true;
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: mongoServerSelectionTimeoutMs
    });
    mongoConnectionError = '';
    console.log('MongoDB Connected');
  } catch (error) {
    mongoConnectionError = error.message || 'MongoDB connection failed';
    console.log(`MongoDB connection failed: ${mongoConnectionError}`);
  } finally {
    mongoConnecting = false;
  }
}

mongoose.connection.on('connected', () => {
  mongoConnectionError = '';
});

mongoose.connection.on('error', (error) => {
  mongoConnectionError = error.message || 'MongoDB connection error';
});

mongoose.connection.on('disconnected', () => {
  if (process.env.MONGO_URI && !mongoConnectionError) {
    mongoConnectionError = 'MongoDB disconnected; retrying...';
  }
});

connectMongo();
setInterval(connectMongo, mongoRetryMs);

app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/reels', reelRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/storage', storageRoutes);
app.use('/api/advanced', advancedRoutes);

app.get('/api/health', (req, res) => {
  const mongoStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({
    ok: true,
    backend: 'online',
    mongo: mongoStates[mongoose.connection.readyState] || 'unknown',
    messageStorage: mongoose.connection.readyState === 1 ? 'mongodb' : 'local-fallback'
    ,
    mongoError: mongoose.connection.readyState === 1 ? '' : mongoConnectionError,
    uptimeSeconds: Math.round(process.uptime()),
    memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024)
  });
});

app.get('/api/deployment/status', (req, res) => {
  res.json(deploymentStatus());
});

app.get('/api/monitoring', authMiddleware, requireAdmin, async (req, res) => {
  const [crashes24h, logins24h] = await Promise.all([
    Activity.countDocuments({ type: 'crash', createdAt: { $gte: new Date(Date.now() - 86400000) } }),
    Activity.countDocuments({ type: 'login', createdAt: { $gte: new Date(Date.now() - 86400000) } })
  ]);
  res.json({
    server: 'online',
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptimeSeconds: Math.round(process.uptime()),
    memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    crashes24h,
    logins24h
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.get('/api', (req, res) => {
  res.json({
    app: 'shashi',
    backend: 'online',
    health: '/api/health'
  });
});

app.use('/api', (req, res) => {
  res.status(404).json({
    message: 'API route not found. Use the shashi app on http://127.0.0.1:5000 only.',
    path: req.originalUrl
  });
});

app.use((error, req, res, next) => {
  if(res.headersSent){
    return next(error);
  }

  if(req.path.startsWith('/api')){
    if(error.type === 'entity.too.large'){
      return res.status(413).json({ message: 'Request is too large' });
    }
    if(error instanceof SyntaxError){
      return res.status(400).json({ message: 'Invalid JSON' });
    }
    return res.status(error.status || 500).json({
      message: process.env.NODE_ENV === 'production' && !error.status
        ? 'Server error'
        : error.message || 'Server error'
    });
  }

  return next(error);
});

io.on('connection', (socket) => {

  console.log('User Connected');

  socket.on('register_user', async (userId) => {
    try {
      if(String(socket.authUser.id) !== String(userId)) return;
      socket.userId = userId;
      await User.findByIdAndUpdate(userId, {
        online: true,
        lastSeen: new Date()
      });

      io.emit('presence_update', {
        userId,
        online: true
      });
    } catch(error) {
      console.log(error.message);
    }
  });

  socket.on('send_message', async (data) => {
    const safeData = safeSocketMessage(data, socket.authUser.username);
    if(!safeData) return;
    io.emit('receive_message', safeData);
    try {
      const notification = await Notification.create({
        recipient: safeData.receiver,
        sender: safeData.sender,
        type: 'message',
        text: `${safeData.sender} sent you a message`
      });
      const push = await sendPushToUser(notification.recipient, {
        title: 'shashi',
        body: notification.text,
        type: notification.type,
        sender: notification.sender
      });
      notification.pushSent = push.sent > 0;
      await notification.save();
      io.emit('new_notification', notification);
    } catch(error) {
      console.log(error.message);
    }
  });

  socket.on('send_notification', async (data) => {
    try {
      const safeData = safeSocketNotification(data, socket.authUser.username);
      if(!safeData) return;
      const notification = await Notification.create(safeData);
      const push = await sendPushToUser(notification.recipient, {
        title: 'shashi',
        body: notification.text,
        type: notification.type,
        sender: notification.sender
      });
      notification.pushSent = push.sent > 0;
      await notification.save();
      io.emit('new_notification', notification);
    } catch(error) {
      console.log(error.message);
    }
  });

  socket.on('reel_update', (data) => {
    if(payloadSize(data) > 2000) return;
    io.emit('reel_updated', data);
  });

  socket.on('typing', (data) => {
    if(payloadSize(data) > 1000) return;
    socket.broadcast.emit('typing_update', {
      sender: socket.authUser.username,
      receiver: compactString(data && data.receiver, 80),
      typing: Boolean(data && data.typing)
    });
  });

  socket.on('message_seen', (data) => {
    if(payloadSize(data) > 2000) return;
    io.emit('message_seen_update', {
      sender: socket.authUser.username,
      receiver: compactString(data && data.receiver, 80),
      messageId: compactString(data && data.messageId, 120)
    });
  });

  socket.on('game_action', async (data) => {
    try {
      const safeData = safeSocketGameAction(data, socket.authUser.username);
      if(!safeData) return;
      io.emit('game_action', safeData);
    } catch(error) {
      console.log(error.message);
    }
  });

  socket.on('disconnect', async () => {
    console.log('User Disconnected');

    if(socket.userId){
      try {
        await User.findByIdAndUpdate(socket.userId, {
          online: false,
          lastSeen: new Date()
        });

        io.emit('presence_update', {
          userId: socket.userId,
          online: false
        });
      } catch(error) {
        console.log(error.message);
      }
    }
  });

});

const port = Number(process.env.PORT) || 5000;
server.listen(port, '0.0.0.0', () => {
  console.log(`shashi app running at http://127.0.0.1:${port}`);
});

server.on('error', (error) => {
  if(error.code === 'EADDRINUSE'){
    console.error(`Port ${port} is already in use. Close the old shashi server and try again.`);
  }else{
    console.error(error);
  }
  process.exit(1);
});
