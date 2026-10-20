// Run only this file: npx mocha tests/saas-smoke.test.js --timeout 180000
// No .env files, external URI, fixed credentials, mocked MongoDB, or production cleanup.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const randomSecret = () => randomBytes(24).toString('hex');
const id = value => String(value?._id || value);
const originalEnv = new Map();
let replset, app, runWithTenant, Company, SuperAdmin, MODULES;
let superToken;
const models = {};
const tenants = [];
const superPassword = randomSecret();
const sharedEmail = 'admin@smoke.invalid';
const api = (method, path, token) => {
  const call = request(app)[method](path);
  return token ? call.set('Authorization', `Bearer ${token}`) : call;
};
function status(response, expected) {
  // Never echo tokens, passwords, or complete response documents on failure.
  assert.equal(response.status, expected, `${response.req.method} ${response.req.path}: ${response.status}; ${response.body?.message || 'no message'}`);
  return response.body.data;
}
function setEnv(key, value) {
  if (!originalEnv.has(key)) originalEnv.set(key, process.env[key]);
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
const scoped = (tenant, fn) => runWithTenant(tenant.id, fn);

async function login(tenant, password = tenant.password) {
  const response = await api('post', '/api/auth/login').send({ companyCode: tenant.code, email: sharedEmail, password });
  status(response, 200);
  assert.equal(typeof response.body.token, 'string');
  return response.body.token;
}

async function createFixtures(tenant) {
  const post = async (path, body) => status(await api('post', path, tenant.token).send(body), 201);
  tenant.category = await post('/api/master-data/categories', { categoryName: 'Shared category' });
  tenant.product = await post('/api/master-data/products', { productName: `Product ${tenant.label}`, category: id(tenant.category) });
  tenant.supplier = await post('/api/master-data/suppliers', { companyName: 'Shared supplier' });
  tenant.customer = await post('/api/master-data/customers', { companyName: 'Shared customer' });
  await scoped(tenant, async () => {
    tenant.unit = await models.Unit.create({ name: 'Bags' });
    tenant.subProduct = await models.SubProduct.create({ name: 'Shared subproduct', product: id(tenant.product) });
    tenant.po = await models.PurchaseOrder.create({
      supplier: id(tenant.supplier), category: id(tenant.category), supplierDetails: { companyName: 'Shared supplier' },
      items: [{ product: id(tenant.product), productName: `Product ${tenant.label}`, quantity: 10, weight: 100, unit: 'Bags' }]
    });
    tenant.grn = await models.GoodsReceiptNote.create({
      purchaseOrder: tenant.po._id, poNumber: tenant.po.poNumber, supplier: id(tenant.supplier),
      items: [{ purchaseOrderItem: tenant.po.items[0]._id, product: id(tenant.product), productName: `Product ${tenant.label}`, receivedQuantity: 5, receivedWeight: 50 }]
    });
    tenant.lot = await models.InventoryLot.create({
      grn: tenant.grn._id, grnNumber: tenant.grn.grnNumber, purchaseOrder: tenant.po._id,
      product: id(tenant.product), productName: `Product ${tenant.label}`, supplier: id(tenant.supplier), supplierName: 'Shared supplier',
      category: id(tenant.category), receivedQuantity: 5, currentQuantity: 5, receivedDate: new Date()
    });
    tenant.so = await models.SalesOrder.create({
      customer: id(tenant.customer), customerName: 'Shared customer', category: id(tenant.category), createdBy: 'smoke',
      items: [{ product: id(tenant.product), productName: `Product ${tenant.label}`, quantity: 2, unit: 'Bags' }]
    });
  });
}

describe('SaaS real MongoDB isolation smoke (ephemeral replica set only)', function () {
  this.timeout(180000);

  before(async function () {
    assert.equal(mongoose.connection.readyState, 0, 'Run the focused file alone: an existing Mongoose connection is forbidden');
    // Ignore all inherited MMS binary/URI/path overrides. MongoDB is pinned and
    // binds only loopback, on a fresh temporary dbPath managed by the library.
    for (const key of Object.keys(process.env)) if (key.startsWith('MONGOMS_')) setEnv(key, undefined);
    setEnv('MONGOMS_VERSION', '7.0.14');
    setEnv('MONGOMS_SYSTEM_BINARY', undefined);
    const dbName = `smoke_${randomBytes(8).toString('hex')}_saas_test`;
    replset = await MongoMemoryReplSet.create({
      binary: { version: '7.0.14' },
      replSet: { count: 1, ip: '127.0.0.1', storageEngine: 'wiredTiger' },
      instanceOpts: [{ ip: '127.0.0.1' }]
    });
    const generatedUri = new URL(replset.getUri(dbName));
    assert.equal(generatedUri.hostname, '127.0.0.1');
    // Config intentionally supports no arbitrary replicaSet URI options; direct
    // connection still supports transactions on this one-node replica set.
    generatedUri.search = '?directConnection=true';
    setEnv('NODE_ENV', 'test');
    setEnv('SAAS_DB_NAME', dbName);
    setEnv('SAAS_MONGODB_URI', generatedUri.href);
    setEnv('SAAS_JWT_SECRET', randomSecret());
    setEnv('SAAS_PORT', '3051');
    setEnv('SAAS_ORIGIN', 'http://127.0.0.1:5174');
    // Block actual dotenv file reads during app imports. Explicit synthetic
    // environment above is the only source of test connection/credential data.
    const originalDotenv = dotenv.config;
    dotenv.config = () => ({ parsed: {} });
    try {
      ({ app } = await import('../index.js'));
      ({ runWithTenant } = await import('../src/saas/tenantContext.js'));
      ({ default: Company } = await import('../src/saas/company.model.js'));
      ({ default: SuperAdmin } = await import('../src/saas/superAdmin.model.js'));
      ({ MODULES } = await import('../src/saas/modules.js'));
      for (const name of ['Category', 'Product', 'SubProduct', 'Supplier', 'Customer', 'Unit', 'Counter', 'PurchaseOrder', 'GoodsReceiptNote', 'InventoryLot', 'SalesOrder', 'CompanyProfile']) {
        models[name] = (await import(`../src/models/${name}.js`)).default;
      }
      models.User = (await import('../src/models/user.model.js')).default;
      models.SavedReport = (await import('../src/reports/savedReport.model.js')).default;
      models.ReportDownload = (await import('../src/reports/reportDownload.model.js')).default;
    } finally {
      dotenv.config = originalDotenv;
    }
    const { getSaasConfig } = await import('../src/saas/config.js');
    const config = getSaasConfig();
    assert.equal(config.uri, generatedUri.href);
    assert.equal(config.dbName, dbName);
    assert.match(config.dbName, /^smoke_[a-f0-9]+_saas_test$/);
    await mongoose.connect(config.uri, { dbName: config.dbName, serverSelectionTimeoutMS: 10000 });
    assert.equal(mongoose.connection.name, dbName);
    await Promise.all(Object.values(mongoose.models).map(model => model.init()));
    await SuperAdmin.create({ email: 'super@smoke.invalid', password: await bcrypt.hash(superPassword, 12) });
    const superLogin = await api('post', '/api/saas/super-admin/login').send({ email: 'super@smoke.invalid', password: superPassword });
    status(superLogin, 200);
    superToken = superLogin.body.token;

    for (const label of ['A', 'B']) {
      const tenant = { label, password: randomSecret() };
      const registration = status(await api('post', '/api/saas/companies').send({
        name: `Smoke company ${label}`, companyType: 'Textile', contactPerson: `Contact ${label}`,
        email: `company-${label}@smoke.invalid`, phone: '9876543210',
        address: 'Synthetic test address', city: 'Surat', state: 'Gujarat', pincode: '395001'
      }), 201);
      assert.equal(registration.status, 'pending');
      tenant.code = registration.companyCode;
      const company = await Company.findOne({ companyCode: tenant.code });
      tenant.id = id(company);
      // Pending login is blocked even with an initial admin and valid credentials.
      tenant.admin = status(await api('post', `/api/saas/companies/${tenant.id}/admin`, superToken).send({ name: `Admin ${label}`, username: 'admin', email: sharedEmail, password: tenant.password }), 201);
      status(await api('post', '/api/auth/login').send({ companyCode: tenant.code, email: sharedEmail, password: tenant.password }), 401);
      status(await api('patch', `/api/saas/companies/${tenant.id}`, superToken).send({ status: 'active', modules: MODULES }), 200);
      tenant.token = await login(tenant);
      tenants.push(tenant);
      await createFixtures(tenant);
    }
  });

  after(async function () {
    // Never dropDatabase/deleteMany. Only shut down resources created above.
    try { if (replset) await mongoose.disconnect(); }
    finally {
      try { if (replset) await replset.stop(); }
      finally {
        for (const [key, value] of originalEnv) {
          if (value === undefined) delete process.env[key]; else process.env[key] = value;
        }
      }
    }
  });

  it('authenticates SuperAdmin and distinct company tokens without role crossover', async () => {
    status(await api('get', '/api/saas/super-admin/verify', superToken), 200);
    for (const tenant of tenants) {
      const verified = await api('get', '/api/auth/verify', tenant.token);
      status(verified, 200);
      assert.equal(id(verified.body.company), tenant.id);
      status(await api('get', '/api/saas/companies', tenant.token), 401);
    }
    status(await api('get', '/api/master-data/products', superToken), 401);
    assert.notEqual(tenants[0].token, tenants[1].token);
    assert.notEqual(tenants[0].id, tenants[1].id);
  });

  it('generates independent duplicate document numbers, units and usernames with real compound indexes', async () => {
    const [a, b] = tenants;
    for (const key of ['poNumber', 'grnNumber', 'soNumber', 'lotNumber']) {
      const fixture = { poNumber: 'po', grnNumber: 'grn', soNumber: 'so', lotNumber: 'lot' }[key];
      assert.equal(a[fixture][key], b[fixture][key]);
    }
    for (const tenant of tenants) await scoped(tenant, async () => {
      assert.equal(await models.Unit.countDocuments({ name: 'Bags' }), 1);
      assert.equal(await models.User.countDocuments({ username: 'admin' }), 1);
      await assert.rejects(models.Unit.create({ name: 'Bags' }), error => error.code === 11000);
      assert.equal((await models.Counter.findById('PO')).seq, 1);
    });
    const indexes = await models.PurchaseOrder.collection.indexes();
    assert.ok(indexes.some(index => index.unique && index.key.tenantId === 1 && index.key.poNumber === 1));
    assert.ok(!indexes.some(index => index.unique && index.key.poNumber && !index.key.tenantId));
  });

  it('isolates real read, update, delete, distinct, count and bulk foreign IDs across ERP models', async () => {
    const pairs = [ ['Product', 'product'], ['Supplier', 'supplier'], ['Customer', 'customer'], ['Category', 'category'], ['SubProduct', 'subProduct'], ['Unit', 'unit'], ['PurchaseOrder', 'po'], ['GoodsReceiptNote', 'grn'], ['InventoryLot', 'lot'], ['SalesOrder', 'so'] ];
    for (const [tenant, foreign] of [[tenants[0], tenants[1]], [tenants[1], tenants[0]]]) {
      await scoped(tenant, async () => {
        for (const [name, fixture] of pairs) {
          const Model = models[name];
          const foreignId = id(foreign[fixture]);
          assert.ok(await Model.findById(id(tenant[fixture])), `${name}: own record exists`);
          assert.equal(await Model.findById(foreignId), null, `${name}: foreign read`);
          assert.equal(await Model.countDocuments(), 1, `${name}: scoped count`);
          assert.deepEqual((await Model.distinct('_id')).map(String), [id(tenant[fixture])]);
          assert.equal((await Model.updateOne({ _id: foreignId }, { $set: { updatedAt: new Date(0) } })).matchedCount, 0, `${name}: foreign update`);
          assert.equal(await Model.findByIdAndUpdate(foreignId, { $set: { updatedAt: new Date(0) } }), null);
          assert.equal((await Model.deleteOne({ _id: foreignId })).deletedCount, 0, `${name}: foreign delete`);
          assert.equal(await Model.findByIdAndDelete(foreignId), null);
          const bulk = await Model.bulkWrite([{ updateOne: { filter: { _id: foreignId }, update: { $set: { updatedAt: new Date(0) } } } }, { deleteOne: { filter: { _id: foreignId } } }]);
          assert.equal(bulk.matchedCount, 0);
          assert.equal(bulk.deletedCount, 0);
        }
      });
    }
  });

  it('isolates HTTP list/read/update/delete requests using foreign product and customer IDs', async () => {
    for (const [tenant, foreign] of [[tenants[0], tenants[1]], [tenants[1], tenants[0]]]) {
      const products = status(await api('get', '/api/master-data/products', tenant.token), 200);
      assert.ok(JSON.stringify(products).includes(id(tenant.product)));
      assert.ok(!JSON.stringify(products).includes(id(foreign.product)));
      for (const [kind, fixture, body] of [['products', 'product', { productName: 'Attempted overwrite', category: id(tenant.category) }], ['customers', 'customer', { companyName: 'Attempted overwrite' }]]) {
        const path = `/api/master-data/${kind}/${id(foreign[fixture])}`;
        status(await api('get', path, tenant.token), 404);
        status(await api('put', path, tenant.token).send(body), 404);
        status(await api('delete', path, tenant.token), 404);
      }
      for (const [path, fixture] of [['purchase-orders', 'po'], ['grn', 'grn'], ['sales-orders', 'so']]) {
        status(await api('get', `/api/${path}/${id(foreign[fixture])}`, tenant.token), 404);
        const list = status(await api('get', `/api/${path}`, tenant.token), 200);
        assert.ok(!JSON.stringify(list).includes(id(foreign[fixture])));
      }
    }
  });

  it('rejects missing context, forged tenant payloads, and cross-company references', async () => {
    const [a, b] = tenants;
    await assert.rejects(models.Product.find().exec(), /tenant/i);
    await assert.rejects(models.Product.aggregate([{ $count: 'n' }]).exec(), /tenant/i);
    for (const body of [{ tenantId: b.id }, { config: { tenantId: b.id } }, { 'tenantId.value': b.id }]) {
      status(await api('post', '/api/master-data/products', a.token).send({ productName: 'Forged', category: id(a.category), ...body }), 400);
    }
    status(await api('get', `/api/master-data/products?tenantId=${b.id}`, a.token), 400);
    status(await api('get', '/api/master-data/products', a.token).set('X-Tenant-ID', b.id), 400);
    await scoped(a, async () => {
      await assert.rejects(models.Product.create({ productName: 'Forged', category: id(a.category), tenantId: b.id }), /tenant/i);
      await assert.rejects(models.Product.updateOne({ _id: id(a.product) }, { $set: { tenantId: b.id } }), /tenant/i);
      await assert.rejects(models.Product.create({ productName: 'Foreign category', category: id(b.category) }), /tenant|reference/i);
      await assert.rejects(models.Product.updateOne({ _id: id(a.product) }, { $set: { category: id(b.category) } }), /tenant|reference/i);
      assert.equal((await models.Product.findById(id(a.product))).productName, 'Product A');
    });
  });

  it('scopes real aggregation roots, lookup subpipelines, facets and populated references', async () => {
    for (const tenant of tenants) await scoped(tenant, async () => {
      const rows = await models.Product.aggregate([
        { $lookup: { from: models.Supplier.collection.name, pipeline: [{ $match: { companyName: 'Shared supplier' } }], as: 'suppliers' } },
        { $lookup: { from: models.Category.collection.name, localField: 'category', foreignField: '_id', as: 'categories' } },
        { $facet: { rows: [{ $project: { suppliers: 1, categories: 1 } }], total: [{ $count: 'n' }] } }
      ]);
      assert.equal(rows[0].total[0].n, 1);
      assert.deepEqual(rows[0].rows[0].suppliers.map(item => id(item)), [id(tenant.supplier)]);
      assert.deepEqual(rows[0].rows[0].categories.map(item => id(item)), [id(tenant.category)]);
      const populated = await models.Product.findById(id(tenant.product)).populate('category');
      assert.equal(id(populated.category), id(tenant.category));
    });
  });

  it('isolates shared saved reports, downloads, report previews and default company profiles', async () => {
    for (const tenant of tenants) {
      const body = { name: `Shared report ${tenant.label}`, reportKey: 'products', config: { selectedFields: ['productName', 'categoryName'] }, isShared: true };
      tenant.report = status(await api('post', '/api/reports/saved', tenant.token).send(body), 201);
      tenant.report = status(await api('put', `/api/reports/saved/${id(tenant.report)}`, tenant.token).send(body), 200);
      assert.equal(tenant.report.isShared, true);
      tenant.profile = status(await api('put', '/api/company-profile', tenant.token).send({ companyName: `Profile ${tenant.label}`, city: `City ${tenant.label}` }), 200);
      tenant.download = await scoped(tenant, () => models.ReportDownload.create({ reportName: 'Products', reportKey: 'products', filename: 'smoke.xlsx', createdBy: sharedEmail, fileData: Buffer.from('synthetic-test-only') }));
    }
    for (const [tenant, foreign] of [[tenants[0], tenants[1]], [tenants[1], tenants[0]]]) {
      assert.deepEqual(status(await api('get', '/api/reports/saved', tenant.token), 200).map(id), [id(tenant.report)]);
      status(await api('get', `/api/reports/saved/${id(foreign.report)}`, tenant.token), 404);
      status(await api('put', `/api/reports/saved/${id(foreign.report)}`, tenant.token).send({ name: 'Foreign overwrite' }), 404);
      status(await api('delete', `/api/reports/saved/${id(foreign.report)}`, tenant.token), 404);
      assert.deepEqual(status(await api('get', '/api/reports/downloads', tenant.token), 200).map(id), [id(tenant.download)]);
      status(await api('get', `/api/reports/downloads/${id(foreign.download)}/file`, tenant.token), 404);
      status(await api('delete', `/api/reports/downloads/${id(foreign.download)}`, tenant.token), 404);
      const preview = status(await api('post', '/api/reports/products/preview', tenant.token).send({ selectedFields: ['productName', 'categoryName'] }), 200);
      assert.equal(preview.total, 1);
      assert.equal(preview.data[0].productName, `Product ${tenant.label}`);
      const profile = status(await api('get', '/api/company-profile', tenant.token), 200);
      assert.equal(profile.companyName, `Profile ${tenant.label}`);
      assert.equal(profile.slug, 'default');
      await scoped(tenant, async () => {
        assert.equal(await models.CompanyProfile.findById(id(foreign.profile)), null);
        assert.equal((await models.CompanyProfile.deleteOne({ _id: id(foreign.profile) })).deletedCount, 0);
      });
    }
  });

  it('revokes old tokens on admin password reset and company suspension, without affecting another tenant', async () => {
    const [a, b] = tenants;
    const oldToken = a.token;
    const password = randomSecret();
    status(await api('patch', `/api/saas/companies/${a.id}/admin`, superToken).send({ password }), 200);
    status(await api('get', '/api/auth/verify', oldToken), 401);
    status(await api('post', '/api/auth/login').send({ companyCode: a.code, email: sharedEmail, password: a.password }), 401);
    a.password = password;
    a.token = await login(a);
    status(await api('get', '/api/auth/verify', b.token), 200);
    const beforeSuspension = a.token;
    status(await api('patch', `/api/saas/companies/${a.id}`, superToken).send({ status: 'suspended' }), 200);
    status(await api('get', '/api/auth/verify', beforeSuspension), 403);
    status(await api('get', '/api/auth/verify', b.token), 200);
    status(await api('patch', `/api/saas/companies/${a.id}`, superToken).send({ status: 'active' }), 200);
    status(await api('get', '/api/auth/verify', beforeSuspension), 401);
    a.token = await login(a);
    status(await api('get', '/api/auth/verify', a.token), 200);
  });

  it('dry-runs the migration without modifying records and refuses unacknowledged apply', async () => {
    const { migrateLegacyData } = await import('../scripts/saas-migrate.js');
    const before = await models.Product.collection.find().toArray();
    const report = await migrateLegacyData({ output: () => {} });
    assert.equal(report.mode, 'dry-run');
    assert.ok(report.blockers.length > 0, 'Existing SaaS tenants must block legacy assignment');
    assert.equal(report.collections.length, 17);
    assert.deepEqual(await models.Product.collection.find().toArray(), before);
    await assert.rejects(migrateLegacyData({ argv: ['--apply'], output: () => {} }), /development|acknowledge/i);
  });
});
