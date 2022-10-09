import { config } from '../../config';

const jwt = require('jsonwebtoken');

export const createToken = (req, callback) => {
  const payload = {
    iss: req.results[0].username,
    sub: 'HR System Web API',
    ...req.results[0],
  };

  const token = jwt.sign(payload, config.auth.secret, {
    algorithm: 'HS256',
    expiresIn: `${config.auth.increaseTime}s`, // JWT 的到期時間 (當前 UNIX 時間戳 + 設定的時間)。必須加上時間單位，否則預設為 ms (毫秒)
  });

  // JSON 格式符合 OAuth 2.0 標準，除自訂 info 屬性是為了讓前端取得額外資訊 (例如使用者名稱)，
  const nowUnix = Date.parse(new Date()) / 1000;
  return callback({
    status: 1,
    access_token: token,
    token_type: 'bearer',
    expires_in: nowUnix + config.auth.increaseTime, // UNIX 時間戳 + config.increaseTime
    scope: req.results[0].role,
    info: {
      ...req.results[0],
    },
  });
};

export const tokenVerify = (req, res, next) => {
  try {
    const { authorization } = req.headers;
    if (!authorization) {
      return res.status(401).json({
        error: 'invalid_client',
        error_description: '沒有 token！',
        display_description: '請先登入',
      });
    }

    if (authorization.substr(0, 7) !== 'Bearer ') {
      return res.status(401).json({
        error: 'invalid_client',
        error_description: '錯誤 token 型式！',
        display_description: '請先登入',
      });
    }

    const decoded = jwt.verify(
      authorization.split(' ')[1],
      config.auth.secret,
    );

    req.user = decoded;
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'invalid_grant',
        error_description: 'token 過期！',
        display_description: '請重新登入',
      });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'invalid_grant',
        error_description: 'token 無效！',
        display_description: '請先登入',
      });
    }
    return res.status(401).json({
      error: 'invalid_grant',
    });
  }
};

// Web API 存取控制
export const accessControl = (req, res, next) => {
  // 如不是 admin，則無權限
  switch (req.user.role) {
    case null:
    case 'admin':
    case 'user':
      res.customStatus = 400;
      res.customError = {
        error: 'unauthorized_client',
        error_description: '無權限！',
      };
      break;
    default: break;
  }

  next();
};

export const sendToken = async (req, res) => {
  createToken(req, (results) => {
    // 確保客戶端瀏覽器不緩存此請求 (OAuth 2.0 標準)
    res.header('Cache-Control', 'no-store');
    res.header('Pragma', 'no-cache');

    res.json(results);
  });
};
