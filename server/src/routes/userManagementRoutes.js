import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import { getUsers, createUser, updateUser, toggleUserActive, deleteUser, resetPassword } from '../controller/userManagementController.js';

import { requireCompanyAdmin, requireModules } from '../saas/modules.js';
import { createRateLimiter } from '../saas/security.js';

const router = express.Router();
router.use(authMiddleware, requireCompanyAdmin, requireModules('users'));
const writeLimiter = createRateLimiter({ limit: 60 });
router.use((req, res, next) => req.method !== 'GET' ? writeLimiter(req, res, next) : next());
router.patch('/:id', updateUser);

router.get('/',                       getUsers);
router.post('/',                      createUser);
router.put('/:id',                    updateUser);
router.patch('/:id/toggle-active',    toggleUserActive);
router.patch('/:id/reset-password',   resetPassword);
router.delete('/:id',                 deleteUser);

export default router;
