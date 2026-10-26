import jwt from 'jsonwebtoken';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || 'us-east-1_EE6qnKupa';
const CLIENT_ID = process.env.COGNITO_CLIENT_ID || '4b2v1q288blr77t2dmdc3nhats';

// Initialize Cognito JWT verifier (accepts both ID and Access tokens)
let _cognitoVerifier = null;
try {
  if (USER_POOL_ID && CLIENT_ID) {
    _cognitoVerifier = CognitoJwtVerifier.create({
      userPoolId: USER_POOL_ID,
      clientId: CLIENT_ID,
      tokenUse: null, // Accepts both 'id' and 'access' tokens
    });
  }
} catch (e) {
  console.warn('[Cognito Auth] Verifier initialization warning:', e.message);
}

export async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  // 1. Try verifying with Amazon Cognito JWT Verifier
  if (_cognitoVerifier) {
    try {
      const payload = await _cognitoVerifier.verify(token);
      req.userId = payload.sub || payload['cognito:username'] || payload.email;
      req.userEmail = payload.email;
      req.cognitoUser = payload;
      return next();
    } catch {
      // Not a Cognito token or expired, try fallback
    }
  }

  // 2. Fallback to standard HMAC JWT verification (for backward compatibility)
  try {
    const jwtSecret = process.env.JWT_SECRET || 'sahaya_default_jwt_secret_2026';
    const decoded = jwt.verify(token, jwtSecret);
    req.userId = decoded.userId || decoded.sub || decoded.email;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
