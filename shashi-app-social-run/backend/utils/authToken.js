const jwt = require('jsonwebtoken');

function jwtSecret(){
  if(!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32){
    throw new Error('JWT secret is not configured safely');
  }
  return process.env.JWT_SECRET;
}

function signAuthToken(user){
  return jwt.sign(
    {
      id: user._id,
      tv: user.tokenVersion || 0
    },
    jwtSecret(),
    {
      expiresIn: '7d',
      algorithm: 'HS256'
    }
  );
}

function verifyAuthToken(token){
  return jwt.verify(token, jwtSecret(), {
    algorithms: ['HS256']
  });
}

module.exports = {
  jwtSecret,
  signAuthToken,
  verifyAuthToken
};
