import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('../../.env.saas', import.meta.url)), quiet: true });

export function getSaasConfig(env = process.env) {
  const mode = env.NODE_ENV || 'development';
  if (!['development', 'test'].includes(mode)) throw new Error('SaaS is development/test only');
  
  const dbName = env.SAAS_DB_NAME;
  console.log('db name', dbName);
  if (!dbName || typeof dbName !== 'string') {
    throw new Error('SAAS_DB_NAME is required');
  }
  
  const uri = env.SAAS_MONGODB_URI;
  if (!uri || typeof uri !== 'string') {
    throw new Error('SAAS_MONGODB_URI is required');
  }
  if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
    throw new Error('SAAS_MONGODB_URI must start with mongodb:// or mongodb+srv://');
  }
  
  const jwtSecret = env.SAAS_JWT_SECRET;
  if (typeof jwtSecret !== 'string' || jwtSecret.length < 32) {
    throw new Error('SAAS_JWT_SECRET requires a secret of at least 32 characters');
  }
  
  const port = Number(env.SAAS_PORT || 3051);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('Invalid SAAS_PORT (must be between 1024 and 65535)');
  }
  
  const origin = env.SAAS_ORIGIN || 'http://localhost:5174';
  
  return { mode, uri, dbName, jwtSecret, port, origin };
}
