import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import tenantPlugin from '../src/saas/tenantPlugin.js';
import { requireTenantId, runWithTenant } from '../src/saas/tenantContext.js';
import Counter from '../src/models/Counter.js';

const tenantA = new mongoose.Types.ObjectId();
const tenantB = new mongoose.Types.ObjectId();
const foreignId = new mongoose.Types.ObjectId();

function fixture(connection) {
  const referenceSchema = new mongoose.Schema({ name: String }, { bufferCommands: false });
  referenceSchema.plugin(tenantPlugin);
  const Reference = connection.model('TenantReference', referenceSchema);
  const schema = new mongoose.Schema({
    code: { type: String, unique: true },
    optional: { type: String, unique: true, sparse: true },
    value: Number,
    reference: { type: mongoose.Schema.Types.ObjectId, ref: 'TenantReference' },
    items: [{ reference: { type: mongoose.Schema.Types.ObjectId, ref: 'TenantReference' } }],
    references: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TenantReference' }]
  }, { bufferCommands: false });
  schema.plugin(tenantPlugin);
  return { Model: connection.model('TenantFixture', schema), Reference };
}

function containsTenant(value, tenantId) {
  if (!value || typeof value !== 'object') return false;
  if (String(value.tenantId) === String(tenantId)) return true;
  return Object.values(value).some(child => containsTenant(child, tenantId));
}

async function rejects(operation, pattern = /tenant|unsupported|pipeline/i) {
  await assert.rejects(async () => operation(), pattern);
}

describe('Tenant isolation without a database', function() {
  let connection;
  let Model;
  let Reference;
  let calls;

  beforeEach(function() {
    connection = mongoose.createConnection();
    ({ Model, Reference } = fixture(connection));
    calls = [];
    for (const name of ['findOne', 'findOneAndUpdate', 'findOneAndReplace', 'findOneAndDelete', 'countDocuments', 'distinct', 'updateOne', 'updateMany', 'replaceOne', 'deleteOne', 'deleteMany', 'insertOne', 'insertMany', 'bulkWrite']) {
      Model.collection[name] = async (...args) => {
        calls.push({ name, args });
        if (name === 'countDocuments') return 0;
        if (name === 'distinct') return [];
        if (name.startsWith('find')) return null;
        return { acknowledged: true, matchedCount: 1, modifiedCount: 1, deletedCount: 1, insertedId: args[0]?._id };
      };
    }
    for (const name of ['find', 'aggregate']) {
      Model.collection[name] = (...args) => {
        calls.push({ name, args });
        return { toArray: async () => [] };
      };
    }
    Reference.collection.findOne = async () => null;
  });

  afterEach(async function() {
    await connection.close();
  });

  it('validates context and isolates concurrent async tasks', async function() {
    assert.throws(() => requireTenantId(), /context/i);
    assert.throws(() => runWithTenant('bad', () => {}), /valid tenant/i);
    await Promise.all([tenantA, tenantB].map(id => runWithTenant(id, async () => {
      await new Promise(resolve => setTimeout(resolve, 2));
      assert.ok(requireTenantId() instanceof mongoose.Types.ObjectId);
      assert.equal(String(requireTenantId()), String(id));
      assert.throws(() => runWithTenant(id.equals(tenantA) ? tenantB : tenantA, () => {}), /switch tenants/i);
    })));
    assert.throws(() => requireTenantId(), /context/i);
  });

  it('fails closed for reads, writes, aggregates, and bulk APIs without context', async function() {
    for (const operation of [
      () => Model.find(), () => Model.findOne(), () => Model.countDocuments(),
      () => Model.distinct('code'), () => Model.updateMany({}, { value: 1 }),
      () => Model.deleteMany({}), () => Model.create({ code: 'x' }),
      () => Model.insertMany([{ code: 'x' }]),
      () => Model.bulkWrite([{ deleteMany: { filter: {} } }]),
      () => Model.aggregate([{ $match: {} }])
    ]) await rejects(operation);
    assert.equal(calls.length, 0);
  });

  it('scopes all supported query operation filters', async function() {
    await runWithTenant(tenantA, async () => {
      const queries = [
        Model.find({ $or: [{ _id: foreignId }, {}] }), Model.findOne({}),
        Model.countDocuments({}), Model.distinct('code', {}),
        Model.updateOne({}, { value: 1 }), Model.updateMany({}, { $inc: { value: 1 } }),
        Model.findOneAndUpdate({}, { value: 1 }), Model.replaceOne({}, { code: 'new' }),
        Model.findOneAndReplace({}, { code: 'new' }), Model.deleteOne({}), Model.deleteMany({}),
        Model.findOneAndDelete({})
      ];
      for (const query of queries) await query;
    });
    assert.equal(calls.length, 12);
    for (const { name, args } of calls) assert.ok(containsTenant(name === 'distinct' ? args[1] : args[0], tenantA), name);
  });

  it('rejects tenant mutations, pipelines, rename and unsafe upsert predicates', async function() {
    await runWithTenant(tenantA, async () => {
      for (const update of [
        { tenantId: tenantB }, { $set: { tenantId: tenantA } }, { $unset: { tenantId: 1 } },
        { $rename: { code: 'tenantId' } }, { $set: { 'items.0.tenantId': tenantB } },
        { $set: { items: [{ tenantId: tenantB }] } }, [{ $set: { value: 1 } }]
      ]) await rejects(() => Model.updateOne({}, update));
      await rejects(() => Model.replaceOne({}, { tenantId: tenantB, code: 'x' }));
      await rejects(() => Model.updateOne({ $and: [{ reference: foreignId }] }, { value: 1 }, { upsert: true }));
      await rejects(() => Model.estimatedDocumentCount());
      await rejects(() => Model.insertMany([{ code: 'x' }], { lean: true }));
      assert.throws(() => Model.watch(), /unsupported/i);
    });
    assert.equal(calls.length, 0);
  });

  it('guards document saves and scopes document update/delete operations', async function() {
    let document;
    await runWithTenant(tenantA, async () => {
      document = await Model.create({ code: 'x' });
      assert.equal(String(document.tenantId), String(tenantA));
      document.value = 2;
      await document.save({ validateBeforeSave: false });
      await document.updateOne({ value: 3 });
      await document.deleteOne();
    });
    await runWithTenant(tenantB, async () => {
      await rejects(() => document.save({ validateBeforeSave: false }));
      await rejects(() => document.deleteOne());
    });
    for (const call of calls) assert.ok(containsTenant(call.args[0], tenantA), call.name);
    await runWithTenant(tenantA, async () => {
      const modified = new Model({ code: 'bad' });
      modified.tenantId = tenantB;
      await rejects(() => modified.save({ validateBeforeSave: false }));
    });
  });

  it('checks references in documents, arrays, positional and bulk updates', async function() {
    await runWithTenant(tenantA, async () => {
      for (const operation of [
        () => Model.create({ code: 'x', reference: foreignId }),
        () => Model.insertMany([{ code: 'x', items: [{ reference: foreignId }] }]),
        () => Model.updateOne({}, { $set: { 'items.$[item].reference': foreignId } }, { arrayFilters: [{ 'item._id': foreignId }] }),
        () => Model.updateOne({}, { $push: { items: { $each: [{ reference: foreignId }] } } }),
        () => Model.updateOne({}, { $addToSet: { references: foreignId } }),
        () => Model.replaceOne({}, { code: 'x', reference: foreignId }),
        () => Model.bulkWrite([{ updateMany: { filter: {}, update: { reference: foreignId } } }])
      ]) await rejects(operation, /reference/i);
    });
    assert.equal(calls.length, 0);
  });

  it('guards insertMany and bulkWrite before any driver calls', async function() {
    await runWithTenant(tenantA, async () => {
      await Model.insertMany([{ code: 'a' }]);
      await Model.bulkWrite([
        { insertOne: { document: { code: 'b' } } },
        { updateMany: { filter: {}, update: { $inc: { value: 1 } } } },
        { replaceOne: { filter: {}, replacement: { code: 'c' } } },
        { deleteMany: { filter: {} } }
      ]);
      const priorCalls = calls.length;
      await rejects(() => Model.bulkWrite([
        { deleteMany: { filter: {} } },
        { updateOne: { filter: {}, update: { $set: { tenantId: tenantB } } } }
      ], { ordered: false }));
      assert.equal(calls.length, priorCalls);
    });
    assert.ok(containsTenant(calls[0].args[0], tenantA));
    for (const operation of calls.find(call => call.name === 'bulkWrite').args[0]) {
      const payload = Object.values(operation)[0];
      assert.ok(containsTenant(payload.document || payload.filter, tenantA));
    }
  });

  it('recursively scopes lookup, facet and union pipelines and blocks unsafe stages', async function() {
    await runWithTenant(tenantA, async () => {
      const pipeline = [{ $facet: { branch: [
        { $lookup: { from: Reference.collection.name, as: 'joined', pipeline: [
          { $unionWith: Reference.collection.name }
        ] } }
      ] } }];
      await Model.aggregate(pipeline);
      const scoped = calls[0].args[0];
      assert.ok(containsTenant(scoped[0], tenantA));
      const lookup = scoped[1].$facet.branch[0].$lookup;
      assert.ok(containsTenant(lookup.pipeline[0], tenantA));
      assert.ok(containsTenant(lookup.pipeline[1].$unionWith.pipeline[0], tenantA));
      for (const stage of [{ $out: 'leak' }, { $merge: 'leak' }, { $graphLookup: {} }, { $changeStream: {} }, { $documents: [] }]) {
        await rejects(() => Model.aggregate([{ $facet: { unsafe: [stage] } }]));
      }
      await rejects(() => Model.aggregate([{ $lookup: { from: 'companies', as: 'secret', pipeline: [] } }]));
    });
  });

  it('converts global path uniqueness and sparse indexes to tenant compound indexes', function() {
    const indexes = Model.schema.indexes();
    assert.ok(indexes.some(([fields]) => fields.tenantId === 1 && fields.code === 1));
    const sparse = indexes.find(([fields]) => fields.optional === 1);
    assert.equal(sparse[1].sparse, undefined);
    assert.deepEqual(sparse[1].partialFilterExpression, { optional: { $exists: true } });
    assert.equal(Model.schema.path('code').options.unique, undefined);
    for (const [fields] of indexes) assert.equal(fields.tenantId, 1);
  });

  it('namespaces Counter IDs transparently and rejects foreign prefixes', function() {
    runWithTenant(tenantA, () => {
      assert.equal(new Counter({ _id: 'PO' })._id, `${tenantA}:PO`);
      assert.equal(new Counter({ _id: `${tenantA}:PO` })._id, `${tenantA}:PO`);
      assert.ok(new Counter({ _id: `${tenantB}:PO` }).validateSync());
    });
  });
});

const mongoUri = process.env.TENANT_ISOLATION_TEST_URI;
(mongoUri ? describe : describe.skip)('Tenant isolation on an explicitly configured disposable database', function() {
  this.timeout(30000);
  let connection;
  let Model;
  let Reference;
  let ScopedCounter;
  let ownReference;
  let foreignReference;
  let foreignDocument;

  before(async function() {
    const databaseName = `yarnflow_tenant_isolation_${randomUUID().replaceAll('-', '')}`;
    connection = await mongoose.createConnection(mongoUri, { dbName: databaseName, serverSelectionTimeoutMS: 10000 }).asPromise();
    ({ Model, Reference } = fixture(connection));
    ScopedCounter = connection.model('Counter', Counter.schema);
    await Promise.all([Model.init(), Reference.init(), ScopedCounter.init()]);
  });

  beforeEach(async function() {
    for (const id of [tenantA, tenantB]) await runWithTenant(id, async () => {
      await Model.deleteMany({});
      await Reference.deleteMany({});
      await ScopedCounter.deleteMany({});
    });
    ownReference = await runWithTenant(tenantA, () => Reference.create({ name: 'A' }));
    foreignReference = await runWithTenant(tenantB, () => Reference.create({ name: 'B' }));
    foreignDocument = await runWithTenant(tenantB, () => Model.create({ code: 'shared', reference: foreignReference._id }));
  });

  after(async function() {
    if (!connection) return;
    try {
      assert.match(connection.name, /^yarnflow_tenant_isolation_[a-f\d]+$/);
      await connection.dropDatabase();
    } finally {
      await connection.close();
    }
  });

  it('isolates reads, count, distinct, updates, deletes and same-key unique values', async function() {
    await runWithTenant(tenantA, async () => {
      await Model.create({ code: 'shared', reference: ownReference._id });
      await Model.create({ code: 'another' });
      await rejects(() => Model.create({ code: 'shared' }), /duplicate key/i);
      assert.equal(await Model.findById(foreignDocument._id), null);
      assert.equal(await Model.countDocuments(), 2);
      assert.deepEqual((await Model.distinct('code')).sort(), ['another', 'shared']);
      assert.equal((await Model.updateMany({ _id: foreignDocument._id }, { value: 5 })).matchedCount, 0);
      assert.equal((await Model.deleteMany({ _id: foreignDocument._id })).deletedCount, 0);
      await Model.bulkWrite([{ updateMany: { filter: {}, update: { value: 7 } } }]);
    });
    await runWithTenant(tenantB, async () => assert.equal((await Model.findById(foreignDocument._id)).value, undefined));
  });

  it('rejects foreign references and hides corrupt legacy references during populate', async function() {
    await runWithTenant(tenantA, async () => {
      await rejects(() => Model.create({ code: 'bad', items: [{ reference: foreignReference._id }] }), /reference/i);
      const own = await Model.create({ code: 'own', reference: ownReference._id });
      assert.equal((await Model.findById(own._id).populate('reference')).reference.name, 'A');
      await Model.collection.updateOne({ _id: own._id }, { $set: { reference: foreignReference._id } });
      assert.equal((await Model.findById(own._id).populate('reference')).reference, null);
      const loaded = await Model.findById(own._id);
      await loaded.populate('reference');
      assert.equal(loaded.reference, null);
      await rejects(() => Model.populate(loaded, { path: 'reference', model: Model }), /override/i);
    });
  });

  it('isolates recursive aggregate lookups, facets and unions', async function() {
    await runWithTenant(tenantA, async () => {
      await Model.create({ code: 'own' });
      const result = await Model.aggregate([{ $facet: { joined: [
        { $lookup: { from: Reference.collection.name, as: 'refs', pipeline: [{ $unionWith: Reference.collection.name }] } }
      ] } }]);
      assert.equal(result[0].joined.length, 1);
      assert.deepEqual(result[0].joined[0].refs.map(ref => ref.name), ['A', 'A']);
    });
  });

  it('allocates independent tenant counters and safe upserts', async function() {
    for (const id of [tenantA, tenantB]) await runWithTenant(id, async () => {
      const counter = await ScopedCounter.findByIdAndUpdate('PO', { $inc: { seq: 1 } }, { upsert: true, new: true });
      assert.equal(counter.seq, 1);
      assert.equal(counter._id, `${id}:PO`);
      const next = await ScopedCounter.findByIdAndUpdate({ _id: 'PO' }, { $inc: { seq: 1 } }, { upsert: true, new: true });
      assert.equal(next.seq, 2);
      const upserted = await Model.findOneAndUpdate({ code: 'upserted' }, { value: 9 }, { upsert: true, new: true });
      assert.equal(String(upserted.tenantId), String(id));
    });
  });
});
