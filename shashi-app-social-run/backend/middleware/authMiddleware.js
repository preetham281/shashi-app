const User = require('../models/User');
const { verifyAuthToken } = require('../utils/authToken');

module.exports = async (req, res, next) => {

  try {

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : '';

    if(!token){
      return res.status(401).json({
        message: 'Access denied'
      });
    }

    const verified = verifyAuthToken(token);
    const user = await User.findById(verified.id).select('+tokenVersion username role');

    if(!user || (user.tokenVersion || 0) !== Number(verified.tv || 0)){
      return res.status(401).json({
        message: 'Invalid token'
      });
    }

    req.user = {
      id: verified.id,
      username: user.username,
      role: user.role
    };

    next();

  } catch(error){

    res.status(401).json({
      message: 'Invalid token'
    });

  }

};
