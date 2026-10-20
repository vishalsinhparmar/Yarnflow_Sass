import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import request from 'supertest';

Object.assign(process.env, {
  NODE_ENV: 'test', SAAS_MONGODB_URI: 'mongodb://127.0.0.1:27017/security_saas_test',
  SAAS_DB_NAME: 'security_saas_test', SAAS_JWT_SECRET: randomBytes(48).toString('hex')
});
const { getSaasConfig } = await import('./config.js');
const { issueToken, verifySaasToken, createRateLimiter, rejectTenantInjection, validPassword } = await import('./security.js');
const { requireModules, validateModules, masterDataAccess } = await import('./modules.js');
const { runWithTenant, requireTenantId } = await import('./tenantContext.js');
const { default: User } = await import('../models/user.model.js');
const { default: Company, registrationFields } = await import('./company.model.js');
const { seedCompanyProfile } = await import('./companyProfileSeed.js');
const { default: CompanyProfile } = await import('../models/CompanyProfile.js');
const { default: SuperAdmin } = await import('./superAdmin.model.js');
const { authMiddleware } = await import('../middleware/authMiddleware.js');
const { app } = await import('../../index.js');
const tenantId = new mongoose.Types.ObjectId();
const identity = { _id: new mongoose.Types.ObjectId(), tokenVersion: 3 };
const response = () => ({ statusCode: 200, headers: {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; }, set(key, value) { this.headers[key] = value; return this; } });

test('configuration refuses legacy, production, remote and unsafe database settings', () => {
  const env = { ...process.env };
  assert.equal(getSaasConfig(env).dbName, 'security_saas_test');
  for (const override of [
    { NODE_ENV: 'production' }, { SAAS_DB_NAME: 'yarnflow' }, { SAAS_DB_NAME: 'security_saas_dev' },
    { SAAS_MONGODB_URI: '' }, { SAAS_MONGODB_URI: 'mongodb+srv://production.example/db' },
    { SAAS_MONGODB_URI: 'mongodb://127.0.0.1:27017/legacy' },
    { SAAS_MONGODB_URI: 'mongodb://127.0.0.1:27017/security_saas_test?authSource=admin' },
    { SAAS_JWT_SECRET: 'short' }, { SAAS_JWT_SECRET: '' }, { JWT_SECRET: env.SAAS_JWT_SECRET },
    { SAAS_PORT: '3020' }, { SAAS_PORT: '3050' }, { SAAS_ORIGIN: 'https://production.example' }
  ]) assert.throws(() => getSaasConfig({ ...env, ...override }));
});

test('tokens require SaaS issuer, audience, HS256, membership and current token version claim', () => {
  const company = issueToken('company', identity, tenantId);
  const admin = issueToken('superAdmin', identity);
  assert.equal(verifySaasToken(company, 'company').tenantId, String(tenantId));
  assert.throws(() => verifySaasToken(admin, 'company'));
  assert.throws(() => verifySaasToken(company, 'superAdmin'));
  const legacy = jwt.sign({ id: String(identity._id), role: 'Admin' }, process.env.SAAS_JWT_SECRET);
  assert.throws(() => verifySaasToken(legacy, 'company'));
  const badIssuer = jwt.sign({ kind: 'company', tenantId: String(tenantId), tokenVersion: 3 }, process.env.SAAS_JWT_SECRET, { subject: String(identity._id), issuer: 'legacy', audience: 'yarnflow-saas-erp' });
  assert.throws(() => verifySaasToken(badIssuer, 'company'));
});

test('module authorization requires BOTH company enablement and explicit user permission', () => {
  for (const [companyModules, permissions, expected] of [
    [['inventory'], ['inventory'], 200], [[], ['inventory'], 403], [['inventory'], [], 403]
  ]) {
    const res = response(); let called = false;
    requireModules('inventory')({ company: { modules: companyModules }, user: { role: 'Admin', permissions } }, res, () => { called = true; });
    assert.equal(res.statusCode, expected);
    assert.equal(called, expected === 200);
  }
  assert.throws(() => validateModules(['users'], ['inventory']));
  assert.throws(() => validateModules({ inventory: true }));
});

test('master data imports and nested subproducts cannot bypass module checks', () => {
  for (const path of ['/import/suppliers', '/products/123/sub-products', '/stats', '/units']) {
    const res = response();
    masterDataAccess({ path, company: { modules: ['products'] }, user: { permissions: ['products'] } }, res, () => assert.fail('Unexpected access'));
    assert.equal(res.statusCode, 403);
  }
});

test('tenant payload and header injection is rejected recursively', () => {
  for (const body of [{ tenantId: String(tenantId) }, { nested: [{ tenant_id: String(tenantId) }] }, { 'other.tenantId': String(tenantId) }]) {
    const res = response();
    rejectTenantInjection({ body, query: {}, headers: {} }, res, () => assert.fail('Injection accepted'));
    assert.equal(res.statusCode, 400);
  }
  const res = response();
  rejectTenantInjection({ headers: { 'x-tenant-id': String(tenantId) } }, res, () => assert.fail('Header accepted'));
  assert.equal(res.statusCode, 400);
});

test('rate limiter fails closed when quota or bounded storage is exhausted', () => {
  const limiter = createRateLimiter({ limit: 1, maxKeys: 1 });
  limiter({ ip: 'a' }, response(), () => {});
  for (const ip of ['a', 'b']) {
    const res = response();
    limiter({ ip }, res, () => assert.fail('Rate limit bypassed'));
    assert.equal(res.statusCode, 429);
    assert.ok(res.headers['Retry-After']);
  }
});

test('passwords do not silently exceed bcrypt limits', () => {
  assert.throws(() => validPassword('short'));
  assert.throws(() => validPassword('x'.repeat(73)));
  assert.throws(() => validPassword('é'.repeat(37)));
  assert.equal(validPassword('x'.repeat(24)), 'x'.repeat(24));
});

test('User schema is tenant-owned while control-plane models are global', async () => {
  assert.equal(User.schema.path('tenantId').isRequired, true);
  assert.equal(Company.schema.path('tenantId'), undefined);
  assert.equal(SuperAdmin.schema.path('tenantId'), undefined);
  assert.ok(User.schema.indexes().filter(([, options]) => options.unique).every(([fields]) => fields.tenantId === 1));
  assert.throws(() => requireTenantId());
  await runWithTenant(String(tenantId), async () => {
    assert.equal(String(requireTenantId()), String(tenantId));
    const user = new User({ email: 'user@example.invalid', password: 'hash' });
    assert.equal(String(user.tenantId), String(tenantId));
    await user.validate();
  });
});

test('HTTP legacy registration is denied and super-admin tokens are rejected by ERP before database access', async () => {
  await request(app).post('/api/auth/register').send({ email: 'user@example.invalid', password: 'untrusted', role: 'Admin' }).expect(403);
  await request(app).get('/api/inventory').set('Authorization', `Bearer ${issueToken('superAdmin', identity)}`).expect(401);
  await request(app).get('/api/auth/verify').expect(401);
  await request(app).post('/api/saas/companies').send({ tenantId: String(tenantId) }).expect(400);
  const catalog = await request(app).get('/api/saas/modules').expect(200);
  assert.ok(catalog.body.data.some(module => module.id === 'users'));
});

test('public company registration forces pending status, no modules and no token regardless of submitted privileges', async () => {
  const original = Company.create;
  let created;
  Company.create = async value => { created = value; return value; };
  try {
    const result = await request(app).post('/api/saas/companies').send({ companyName: 'Untrusted Company', companyType: 'Trader', contactPerson: 'Contact', phone: '1234567890', email: 'contact@example.invalid', address: 'Test Address', city: 'Test City', state: 'Test State', pincode: '110001', gstin: '27ABCDE1234F1Z5', website: 'https://example.invalid', status: 'active', modules: ['users'], role: 'Admin' }).expect(201);
    assert.equal(created.status, 'pending');
    assert.equal(created.name, 'Untrusted Company');
    assert.equal(created.contactPerson, 'Contact');
    assert.equal(created.address, 'Test Address');
    assert.equal(created.pincode, '110001');
    assert.equal(created.gstin, '27ABCDE1234F1Z5');
    assert.equal(created.website, 'https://example.invalid');
    assert.deepEqual(created.modules, []);
    assert.equal(created.role, undefined);
    assert.equal(result.body.token, undefined);
    assert.equal(result.body.data.status, 'pending');
    assert.match(result.body.data.companyCode, /^YF-/);
  } finally { Company.create = original; }
});

test('registration validates required bounded fields and accepts legacy contactName alias', () => {
  const body = { companyName: 'Company', companyType: 'Trader', contactName: 'Contact', phone: '1234567890', email: 'test@example.invalid', address: 'Address', city: 'City', state: 'State', pincode: '110001' };
  assert.equal(registrationFields(body).contactPerson, 'Contact');
  for (const fields of [{ companyType: '' }, { contactName: [] }, { address: 'x'.repeat(501) }, { city: '' }, { state: {} }, { pincode: '123' }, { gstin: 'invalid' }, { phone: 'letters' }, { website: 'javascript:alert(1)' }, { website: 'https://user:pass@example.invalid' }]) {
    assert.throws(() => registrationFields({ ...body, ...fields }));
  }
});

test('company profile seeding is tenant scoped and insert only without conflicting defaults', async () => {
  const original = CompanyProfile.findOneAndUpdate;
  let calls = 0;
  CompanyProfile.findOneAndUpdate = async (filter, update, options) => {
    calls++;
    assert.equal(String(requireTenantId()), String(tenantId));
    assert.deepEqual(filter, { slug: 'default' });
    assert.deepEqual(Object.keys(update), ['$setOnInsert']);
    assert.equal(update.$setOnInsert.companyName, 'Tenant Company');
    assert.equal(update.$setOnInsert.headOfficeAddress, 'Tenant Address');
    assert.equal(update.$setOnInsert.tenantId, undefined);
    assert.equal(options.setDefaultsOnInsert, false);
    assert.equal(options.upsert, true);
    return update.$setOnInsert;
  };
  try {
    const company = { _id: tenantId, name: 'Tenant Company', address: 'Tenant Address' };
    await seedCompanyProfile(company);
    await seedCompanyProfile(company);
    assert.equal(calls, 2);
  } finally { CompanyProfile.findOneAndUpdate = original; }
});

test('atomic company authVersion prevents session revival when user synchronization fails', async () => {
  const originals = { updateCompany: Company.findByIdAndUpdate, company: Company.findById, admin: SuperAdmin.findById, users: User.updateMany };
  const company = new Company({ _id: tenantId, name: 'Revocation Test', companyCode: 'REVOKE', email: 'test@example.invalid', status: 'active', modules: ['inventory'], authVersion: 0 });
  const oldToken = issueToken('company', identity, tenantId, company.authVersion);
  Company.findByIdAndUpdate = async (id, update, options) => {
    assert.equal(id, String(tenantId));
    assert.equal(update.$inc.authVersion, 1);
    assert.equal(options.runValidators, true);
    Object.assign(company, update.$set);
    company.authVersion++;
    return company;
  };
  Company.findById = async () => company;
  SuperAdmin.findById = async () => ({ ...identity, isActive: true });
  User.updateMany = async () => { throw new Error('Simulated user synchronization failure'); };
  try {
    const superToken = issueToken('superAdmin', identity);
    for (const status of ['inactive', 'active']) {
      const result = await request(app).patch(`/api/saas/companies/${tenantId}`).set('Authorization', `Bearer ${superToken}`).send({ status }).expect(200);
      assert.equal(result.body.permissionsSyncPending, true);
    }
    assert.equal(company.authVersion, 2);
    const res = response();
    await authMiddleware({ headers: { authorization: `Bearer ${oldToken}` } }, res, () => assert.fail('Revoked company session accepted'));
    assert.equal(res.statusCode, 401);
  } finally {
    Company.findByIdAndUpdate = originals.updateCompany;
    Company.findById = originals.company;
    SuperAdmin.findById = originals.admin;
    User.updateMany = originals.users;
  }
});

test('middleware revalidates active company, user, revocation and live permissions inside signed membership context', async () => {
  const originalCompany = Company.findById;
  const originalUser = User.findById;
  const company = { _id: tenantId, status: 'active', name: 'Test', companyCode: 'TEST', modules: ['inventory'], authVersion: 0 };
  const user = { ...identity, tenantId, isActive: true, role: 'Admin', permissions: ['inventory', 'users'] };
  Company.findById = async () => company;
  User.findById = () => ({ select: async () => user });
  const token = issueToken('company', identity, tenantId);
  const call = async () => {
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = response(); let called = false;
    await authMiddleware(req, res, error => {
      if (error) throw error;
      called = true;
      assert.equal(String(requireTenantId()), String(tenantId));
    });
    return { req, res, called };
  };
  try {
    let result = await call();
    assert.equal(result.called, true);
    assert.deepEqual(result.req.user.permissions, ['inventory']);
    user.tokenVersion++;
    result = await call(); assert.equal(result.res.statusCode, 401); assert.equal(result.called, false);
    user.tokenVersion--; user.isActive = false;
    result = await call(); assert.equal(result.res.statusCode, 401);
    user.isActive = true; company.status = 'suspended';
    result = await call(); assert.equal(result.res.statusCode, 403);
    company.status = 'active'; user.tenantId = new mongoose.Types.ObjectId();
    result = await call(); assert.equal(result.res.statusCode, 401);
  } finally {
    Company.findById = originalCompany;
    User.findById = originalUser;
  }
});
