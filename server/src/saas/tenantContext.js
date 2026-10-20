import { AsyncLocalStorage } from 'node:async_hooks';
import mongoose from 'mongoose';

const tenantStorage = new AsyncLocalStorage();

function objectId(value) {
  if (value instanceof mongoose.Types.ObjectId) return new mongoose.Types.ObjectId(value.toHexString());
  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) {
    throw new Error('A valid tenant ID is required');
  }
  return new mongoose.Types.ObjectId(value);
}

export function runWithTenant(tenantId, callback) {
  if (typeof callback !== 'function') throw new TypeError('A tenant callback is required');
  const id = objectId(tenantId).toHexString();
  const current = tenantStorage.getStore();
  if (current && current !== id) throw new Error('Cannot switch tenants inside an active tenant context');
  return tenantStorage.run(id, callback);
}

export function requireTenantId() {
  const id = tenantStorage.getStore();
  if (!id) throw new Error('Tenant context is required');
  return new mongoose.Types.ObjectId(id);
}
