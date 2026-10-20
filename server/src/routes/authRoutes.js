import express from 'express';
import { register, login, verifyToken } from '../controller/authController.js';
import authMiddleware from '../middleware/authMiddleware.js';

import { createRateLimiter } from '../saas/security.js';

const authRoutes = express.Router();
const authLimiter = createRateLimiter();
authRoutes.use((req, res, next) => req.method === 'POST' ? authLimiter(req, res, next) : next());

authRoutes.post('/register', register);
authRoutes.post('/login', login);
authRoutes.get('/verify', authMiddleware, verifyToken);

export default authRoutes;