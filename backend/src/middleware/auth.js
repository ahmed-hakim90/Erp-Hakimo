import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const extractBearerToken = (authHeader = '') => {
  const [type, token] = authHeader.split(' ');
  if (type?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
};

export const verifySupabaseJwt = (req, res, next) => {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  try {
    const payload = jwt.verify(token, env.supabaseJwtSecret, {
      algorithms: ['HS256'],
    });
    req.user = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
