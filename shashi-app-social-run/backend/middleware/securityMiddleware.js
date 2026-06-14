const visitors = new Map();
const MAX_BODY_DEPTH = 8;
const MAX_STRING_LENGTH = 25000;

function securityHeaders(req, res, next){
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(self)');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('Origin-Agent-Cluster', '?1');
  if(process.env.NODE_ENV === 'production'){
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.gstatic.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; font-src 'self' https://cdnjs.cloudflare.com; img-src 'self' data: blob: https:; media-src 'self' data: blob: https:; connect-src 'self' http: https: ws: wss:; worker-src 'self' blob:; frame-ancestors 'none'"
  );
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}

function rateLimit(req, res, next){
  const windowMs = 15 * 60 * 1000;
  const maxRequests = req.path.includes('/api/auth/') || req.path.includes('/api/account/')
    ? 60
    : 300;
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = visitors.get(ip) || { count: 0, resetAt: now + windowMs };

  if(now > entry.resetAt){
    entry.count = 0;
    entry.resetAt = now + windowMs;
  }

  entry.count += 1;
  visitors.set(ip, entry);

  if(visitors.size > 5000){
    for(const [key, value] of visitors.entries()){
      if(now > value.resetAt) visitors.delete(key);
    }
  }

  if(entry.count > maxRequests){
    return res.status(429).json({ message: 'Too many requests. Please try again later.' });
  }

  next();
}

function cleanValue(value, depth = 0){
  if(depth > MAX_BODY_DEPTH) return undefined;

  if(typeof value === 'string'){
    return value
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/[<>]/g, '')
      .trim()
      .slice(0, MAX_STRING_LENGTH);
  }

  if(Array.isArray(value)){
    return value.slice(0, 200).map((item) => cleanValue(item, depth + 1));
  }

  if(value && typeof value === 'object'){
    return Object.keys(value).slice(0, 100).reduce((safe, key) => {
      if(key.startsWith('$') || key.includes('.')){
        return safe;
      }
      if((key === 'file' || key === 'mediaUrl') && typeof value[key] === 'string'){
        safe[key] = value[key].trim();
        return safe;
      }
      const cleaned = cleanValue(value[key], depth + 1);
      if(cleaned !== undefined) safe[key] = cleaned;
      return safe;
    }, {});
  }

  return value;
}

function sanitizeInput(req, res, next){
  if(req.body){
    req.body = cleanValue(req.body);
  }
  if(req.query){
    req.query = cleanValue(req.query);
  }
  next();
}

function requireHttps(req, res, next){
  if(process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] === 'http'){
    return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
  }
  next();
}

module.exports = {
  securityHeaders,
  rateLimit,
  sanitizeInput,
  requireHttps
};
