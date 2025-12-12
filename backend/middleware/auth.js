import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'mchain-mvp-secret-key-2024';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Erişim reddedildi. Token gerekli.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Geçersiz token.' });
    }
    req.user = user;
    next();
  });
};

export const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Bu işlem için admin yetkisi gerekli.' });
  }
  next();
};

export const requireUser = (req, res, next) => {
  if (req.user.role !== 'user') {
    return res.status(403).json({ error: 'Bu işlem için tedarikçi yetkisi gerekli.' });
  }
  next();
};

export { JWT_SECRET };






