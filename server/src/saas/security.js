import jwt from 'jsonwebtoken';
import { getSaasConfig } from './config.js';

const ISSUER = 'yarnflow-saas-development';
const audiences = { company: 'yarnflow-saas-erp', superAdmin: 'yarnflow-saas-control-plane' };
export function issueToken(kind, identity, tenantId, companyAuthVersion = 0) {
  return jwt.sign({ kind, tokenVersion: identity.tokenVersion, ...(kind === 'company' ? { tenantId: String(tenantId), companyAuthVersion } : {}) }, getSaasConfig().jwtSecret, {
    algorithm: 'HS256', issuer: ISSUER, audience: audiences[kind], subject: String(identity._id), expiresIn: '8h'
  });
}
export function verifySaasToken(token, kind) {
  const claims = jwt.verify(token, getSaasConfig().jwtSecret, { algorithms: ['HS256'], issuer: ISSUER, audience: audiences[kind] });
  if (claims.kind !== kind || !/^[a-f\d]{24}$/i.test(claims.sub || '') || !Number.isInteger(claims.exp) || !Number.isInteger(claims.tokenVersion) || claims.tokenVersion < 0 || (kind === 'company' && (!/^[a-f\d]{24}$/i.test(claims.tenantId || '') || !Number.isInteger(claims.companyAuthVersion) || claims.companyAuthVersion < 0))) {
    throw new Error('Invalid SaaS identity');
  }
  return claims;
}
export function bearerToken(req) {
  const match = /^Bearer ([^\s]+)$/.exec(req.headers.authorization || '');
  if (!match) throw new Error('Invalid authorization');
  return match[1];
}

export const fail = (status, message) => Object.assign(new Error(message), { status });
export const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
export const text = (value, max = 160) => typeof value === 'string' && value.trim().length <= max ? value.trim() : '';
export function validPassword(value) {
  if (typeof value !== 'string' || value.length < 12 || Buffer.byteLength(value, 'utf8') > 72) throw fail(400, 'Password must be at least 12 characters and at most 72 UTF-8 bytes');
  return value;
}
export function validEmail(value) {
  const email = text(value, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail(400, 'A valid email is required');
  return email;
}
export function rejectTenantInjection(req, res, next) {
  const stack = [req.body, req.query];
  let count = 0;
  while (stack.length) {
    const value = stack.pop();
    if (!value || typeof value !== 'object') continue;
    if (++count > 10000) return res.status(400).json({ success: false, message: 'Request is too complex' });
    for (const [key, child] of Object.entries(value)) {
      if (key.split(/[.\[\]]/).some(part => /^tenant_?id$/i.test(part)) || ['__proto__', 'constructor', 'prototype'].includes(key)) {
        return res.status(400).json({ success: false, message: 'Tenant identifiers cannot be supplied in requests' });
      }
      if (child && typeof child === 'object') stack.push(child);
    }
  }
  if (req.headers['x-tenant-id'] || req.headers['tenantid'] || req.headers['tenant-id']) return res.status(400).json({ success: false, message: 'Tenant headers are not accepted' });
  next();
}

export function createRateLimiter({ limit = 20, windowMs = 15 * 60 * 1000, maxKeys = 5000 } = {}) {
  const clients = new Map();
  return (req, res, next) => {
    const now = Date.now();
    for (const [key, value] of clients) if (value.until <= now) clients.delete(key);
    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    let entry = clients.get(key);
    if (!entry && clients.size < maxKeys) {
      entry = { count: 0, until: now + windowMs };
      clients.set(key, entry);
    }
    if (!entry || ++entry.count > limit) {
      res.set('Retry-After', String(Math.ceil(((entry?.until || now + windowMs) - now) / 1000)));
      return res.status(429).json({ success: false, message: 'Too many attempts. Try again later.' });
    }
    next();
  };
}
