import mongoose from 'mongoose';
import { requireTenantId } from './tenantContext.js';

const protectedSchemas = new WeakSet();
const invalidDocuments = new WeakSet();
const documentTenants = new WeakMap();
const safeUpdateOperators = new Set(['$set', '$setOnInsert', '$unset', '$inc', '$mul', '$min', '$max', '$currentDate', '$push', '$addToSet', '$pop', '$pull', '$pullAll', '$bit']);
const safeStages = new Set(['$match', '$project', '$addFields', '$set', '$unset', '$group', '$sort', '$skip', '$limit', '$unwind', '$count', '$sortByCount', '$replaceRoot', '$replaceWith', '$bucket', '$bucketAuto', '$sample', '$redact', '$setWindowFields', '$densify', '$fill']);

function fail(message) {
  throw new Error(`Tenant isolation: ${message}`);
}

function sameId(a, b) {
  return a != null && b != null && String(a) === String(b);
}

function plain(value) {
  return value instanceof mongoose.Document ? value.toObject({ depopulate: true, virtuals: false, getters: false, transform: false }) : value;
}

function walk(value, visit) {
  if (value == null || typeof value !== 'object' || value instanceof mongoose.Types.ObjectId || value instanceof Date || Buffer.isBuffer(value)) return;
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit);
    return;
  }
  for (const [key, child] of Object.entries(plain(value))) {
    visit(key, child);
    walk(child, visit);
  }
}

function rejectTenantPayload(value) {
  walk(value, (key, child) => {
    if (key.split('.').includes('tenantId')) fail('tenantId cannot be supplied or modified in write payloads');
    if (key === '$rename' || key === '$function' || key === '$accumulator' || key === '$where') fail(`unsupported write expression ${key}`);
    if (key === '$setField' || key === '$unsetField') fail(`unsupported write expression ${key}`);
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') fail('unsafe payload key');
    if (typeof child === 'function') fail('executable payloads are forbidden');
  });
}

function rejectExecutable(value) {
  walk(value, key => {
    if (['$where', '$function', '$accumulator'].includes(key)) fail(`unsupported expression ${key}`);
  });
}

function scopedFilter(filter, tenantId) {
  rejectExecutable(filter);
  return { $and: [filter || {}, { tenantId }] };
}

function references(schema, prefix = '') {
  const result = [];
  schema.eachPath((name, path) => {
    const full = prefix ? `${prefix}.${name}` : name;
    const options = path.options?.ref || path.options?.refPath ? path.options : path.caster?.options;
    if (options?.refPath || (options?.ref && typeof options.ref !== 'string')) fail(`dynamic reference ${full} is unsupported`);
    if (options?.ref) result.push({ path: full, ref: options.ref });
    if (path.schema) result.push(...references(path.schema, full));
  });
  return result;
}

function targetModel(connection, ref) {
  const [name, ...embedded] = ref.split('.');
  const model = connection.models[name];
  if (!model || !protectedSchemas.has(model.schema)) fail(`reference target ${name} is not tenant protected`);
  return { model, idPath: embedded.length ? `${embedded.join('.')}._id` : '_id' };
}

function valuesAt(value, parts) {
  if (!parts.length) return Array.isArray(value) ? value.flatMap(item => valuesAt(item, [])) : [value];
  if (Array.isArray(value)) return value.flatMap(item => valuesAt(item, parts));
  if (value == null) return [];
  const object = plain(value);
  const joined = parts.join('.');
  if (Object.hasOwn(object, joined)) return valuesAt(object[joined], []);
  return valuesAt(object[parts[0]], parts.slice(1));
}

async function checkReference(connection, descriptor, values, tenantId, session) {
  const ids = values.flatMap(value => Array.isArray(value) ? value : [value])
    .filter(value => value != null)
    .map(value => value instanceof mongoose.Document ? value._id : (value && typeof value === 'object' && !(value instanceof mongoose.Types.ObjectId) ? value._id : value));
  if (!ids.length) return;
  const { model, idPath } = targetModel(connection, descriptor.ref);
  for (const id of new Map(ids.map(value => [String(value), value])).values()) {
    if (id == null || !mongoose.isObjectIdOrHexString(id)) fail(`invalid reference at ${descriptor.path}`);
    let query = model.exists({ [idPath]: id, tenantId });
    if (session) query = query.session(session);
    if (!await query) fail(`reference at ${descriptor.path} does not belong to the active tenant`);
  }
}

async function checkDocumentReferences(connection, refs, document, tenantId, session) {
  const object = plain(document);
  for (const descriptor of refs) {
    await checkReference(connection, descriptor, valuesAt(object, descriptor.path.split('.')), tenantId, session);
  }
}

function normalizedPath(path) {
  return path.split('.').filter(part => !/^\d+$/.test(part) && part !== '$' && !/^\$\[.*\]$/.test(part)).join('.');
}

async function checkAssignments(connection, refs, operator, assignments, tenantId, session) {
  if (!assignments || typeof assignments !== 'object' || Array.isArray(assignments)) fail(`invalid ${operator} update`);
  for (const [rawPath, rawValue] of Object.entries(assignments)) {
    const path = normalizedPath(rawPath);
    for (const descriptor of refs) {
      const related = path === descriptor.path || descriptor.path.startsWith(`${path}.`) || path.startsWith(`${descriptor.path}.`);
      if (!related) continue;
      if (['$unset', '$pop', '$pull', '$pullAll'].includes(operator)) continue;
      if (!['$set', '$setOnInsert', '$push', '$addToSet'].includes(operator)) fail(`unsupported reference update ${operator} at ${path}`);
      if (path.startsWith(`${descriptor.path}.`)) fail(`cannot modify part of a reference at ${path}`);
      let value = rawValue;
      if (operator === '$push' || operator === '$addToSet') {
        value = value && typeof value === 'object' && Object.hasOwn(value, '$each') ? value.$each : value;
      }
      const parts = path === descriptor.path ? [] : descriptor.path.slice(path.length + 1).split('.');
      await checkReference(connection, descriptor, valuesAt(value, parts), tenantId, session);
    }
  }
}

async function checkUpsertFilter(connection, refs, filter, tenantId, session) {
  const assignments = { ...filter };
  if (Object.hasOwn(assignments, 'tenantId')) {
    if (!sameId(assignments.tenantId, tenantId)) fail('upsert tenant mismatch');
    delete assignments.tenantId;
  }
  rejectTenantPayload(assignments);
  walk(assignments, key => {
    if (key.startsWith('$')) fail('upsert filters must use literal equality predicates');
  });
  await checkAssignments(connection, refs, '$set', assignments, tenantId, session);
}

function guardWriteOptions(options = {}) {
  if (options.overwriteImmutable || options.overwrite || options.skipTenant || options.tenantId || options.lean || options.bypassDocumentValidation) {
    fail('unsafe write options');
  }
}

async function prepareUpdate(connection, refs, update, options, tenantId, replacement = false) {
  guardWriteOptions(options);
  if (Array.isArray(update)) fail('update pipelines are unsupported');
  if (!update || typeof update !== 'object') fail('a write payload is required');
  rejectTenantPayload(update);
  if (replacement) {
    await checkDocumentReferences(connection, refs, update, tenantId, options.session);
    return { ...plain(update), tenantId };
  }
  const prepared = {};
  const implicitSet = {};
  for (const [key, value] of Object.entries(update)) {
    if (key.startsWith('$')) prepared[key] = value;
    else implicitSet[key] = value;
  }
  // Mongoose's own timestamps middleware injects operators (e.g. $currentDate) alongside
  // plain top-level fields for non-operator update payloads; treat those as an implicit $set.
  if (Object.keys(implicitSet).length) prepared.$set = { ...implicitSet, ...prepared.$set };
  for (const [operator, assignments] of Object.entries(prepared)) {
    if (!safeUpdateOperators.has(operator)) fail(`unsupported update operator ${operator}`);
    await checkAssignments(connection, refs, operator, assignments, tenantId, options.session);
  }
  if (options.upsert) prepared.$setOnInsert = { ...prepared.$setOnInsert, tenantId };
  return prepared;
}

function protectedCollection(connection, name) {
  if (typeof name !== 'string' || !Object.values(connection.models).some(model => model.collection.name === name && protectedSchemas.has(model.schema))) {
    fail('aggregation collection is not a registered tenant-owned collection');
  }
}

function scopePipeline(pipeline, connection, tenantId, root = true) {
  if (!Array.isArray(pipeline)) fail('invalid aggregation pipeline');
  for (const [index, stage] of pipeline.entries()) {
    if (!stage || typeof stage !== 'object' || Object.keys(stage).length !== 1) fail('invalid aggregation stage');
    const [operator, body] = Object.entries(stage)[0];
    rejectExecutable(body);
    if (operator === '$lookup') {
      protectedCollection(connection, body.from);
      if (typeof body.as !== 'string' || body.as.split('.').includes('tenantId')) fail('unsafe lookup output');
      body.pipeline = body.pipeline || [];
      scopePipeline(body.pipeline, connection, tenantId);
    } else if (operator === '$unionWith') {
      const union = typeof body === 'string' ? { coll: body, pipeline: [] } : body;
      if (!union || typeof union !== 'object') fail('invalid union');
      protectedCollection(connection, union.coll);
      union.pipeline = union.pipeline || [];
      scopePipeline(union.pipeline, connection, tenantId);
      stage.$unionWith = union;
    } else if (operator === '$facet') {
      if (!body || typeof body !== 'object' || Array.isArray(body)) fail('invalid facet');
      for (const branch of Object.values(body)) scopePipeline(branch, connection, tenantId, false);
    } else if (operator === '$geoNear') {
      if (!root || index !== 0) fail('$geoNear is only supported at a collection pipeline root');
      body.query = scopedFilter(body.query, tenantId);
    } else if (!safeStages.has(operator)) {
      fail(`unsupported aggregation stage ${operator}`);
    }
  }
  if (root && !pipeline[0]?.$geoNear) pipeline.unshift({ $match: { tenantId } });
}

function clearDeclaredIndexes(schema) {
  schema.eachPath((name, path) => {
    if (name !== '_id') {
      path._index = null;
      delete path.options.unique;
      delete path.options.sparse;
      delete path.options.index;
    }
    if (path.schema) clearDeclaredIndexes(path.schema);
  });
  schema.clearIndexes();
}

function scopeIndexes(schema) {
  const indexes = schema.indexes().map(([fields, options]) => [{ ...fields }, { ...options }]);
  clearDeclaredIndexes(schema);
  for (const [fields, options] of indexes) {
    if (Object.keys(fields).length === 1 && Object.hasOwn(fields, '_id')) continue;
    if (options.expireAfterSeconds != null) fail('TTL indexes require a separate reviewed retention policy');
    if (options.sparse) {
      delete options.sparse;
      const exists = Object.keys(fields).filter(key => key !== 'tenantId').map(key => ({ [key]: { $exists: true } }));
      if (!exists.length) fail('invalid sparse tenant index');
      const presence = exists.length === 1 ? exists[0] : { $or: exists };
      options.partialFilterExpression = options.partialFilterExpression ? { $and: [options.partialFilterExpression, presence] } : presence;
    }
    delete options.name;
    schema.index({ tenantId: 1, ...fields }, options);
  }
  schema.index({ tenantId: 1 });
}

function populateSpecs(value) {
  if (typeof value === 'string') return value.split(/\s+/).filter(Boolean).map(path => ({ path }));
  if (Array.isArray(value)) return value.flatMap(populateSpecs);
  if (value && typeof value === 'object' && typeof value.path === 'string') {
    return value.path.split(/\s+/).filter(Boolean).map(path => ({ ...value, path }));
  }
  fail('unsupported populate options');
}

function guardPopulate(model, value, tenantId) {
  return populateSpecs(value).map(spec => {
    const descriptor = references(model.schema).find(ref => ref.path === spec.path);
    const virtual = model.schema.virtuals[spec.path]?.options;
    const ref = descriptor?.ref || virtual?.ref;
    if (typeof ref !== 'string' || ref.includes('.')) fail(`unsupported populate path ${spec.path}`);
    const { model: target } = targetModel(model.db, ref);
    if (spec.model && spec.model !== target && spec.model !== target.modelName) fail('populate model overrides are forbidden');
    if (spec.options?.skipTenant || spec.options?.tenantId) fail('populate tenant overrides are forbidden');
    const match = spec.match;
    spec.match = typeof match === 'function'
      ? function(...args) { return scopedFilter(match.apply(this, args), tenantId); }
      : scopedFilter(match, tenantId);
    if (spec.populate) spec.populate = guardPopulate(target, spec.populate, tenantId);
    return spec;
  });
}

export function tenantPlugin(schema) {
  if (mongoose.version !== '8.19.1') fail('tenantPlugin requires reviewed Mongoose version 8.19.1');
  if (protectedSchemas.has(schema)) return;
  if (schema.path('tenantId')) fail('apply tenantPlugin before defining a separate tenantId path');
  const refs = references(schema);
  scopeIndexes(schema);
  schema.add({ tenantId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true, default: () => requireTenantId() } });
  schema.path('tenantId').set(function(value) {
    const tenantId = requireTenantId();
    if (!sameId(value, tenantId)) {
      if (this instanceof mongoose.Document) invalidDocuments.add(this);
      fail('tenantId does not match the active tenant');
    }
    return tenantId;
  });
  protectedSchemas.add(schema);

  schema.post('init', function(document) {
    documentTenants.set(document, document.tenantId ? String(document.tenantId) : null);
  });

  function guardDocument(document) {
    const tenantId = requireTenantId();
    if (invalidDocuments.has(document) || document.$errors?.tenantId) fail('tenantId modification was rejected');
    if (!sameId(document.tenantId, tenantId)) fail('document does not belong to the active tenant');
    if (documentTenants.has(document) && !sameId(documentTenants.get(document), tenantId)) fail('document tenant cannot change');
    const object = plain(document);
    delete object.tenantId;
    rejectTenantPayload(object);
    return tenantId;
  }

  schema.pre('validate', function() {
    guardDocument(this);
  });
  schema.pre('save', async function() {
    const tenantId = guardDocument(this);
    this.$where = { ...this.$where, tenantId };
    await checkDocumentReferences(this.constructor.db, refs, this, tenantId, this.$session());
  });
  schema.post('save', function(document) {
    documentTenants.set(document, String(document.tenantId));
  });
  schema.methods.deleteOne = function(options = {}) {
    const tenantId = guardDocument(this);
    return this.constructor.deleteOne({ _id: this._id, tenantId }, { session: this.$session(), ...options });
  };
  schema.methods.updateOne = function(update, options = {}) {
    const tenantId = guardDocument(this);
    return this.constructor.updateOne({ _id: this._id, tenantId }, update, { session: this.$session(), ...options });
  };

  const queryOperations = ['find', 'findOne', 'count', 'countDocuments', 'distinct', 'updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace', 'deleteOne', 'deleteMany', 'findOneAndDelete'];
  for (const operation of queryOperations) {
    schema.pre(operation, { query: true, document: false }, async function() {
      const tenantId = requireTenantId();
      const options = this.getOptions();
      if (options.overwriteImmutable || options.overwrite || options.skipTenant || options.tenantId) fail('unsafe query options');
      const originalFilter = this.getFilter();
      if (options.upsert) {
        await checkUpsertFilter(this.model.db, refs, originalFilter, tenantId, options.session);
      }
      this.setQuery(scopedFilter(originalFilter, tenantId));
      if (['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace'].includes(operation)) {
        this.setUpdate(await prepareUpdate(this.model.db, refs, this.getUpdate(), options, tenantId, ['replaceOne', 'findOneAndReplace'].includes(operation)));
        this.setOptions({ runValidators: true });
      }
    });
  }
  schema.pre('estimatedDocumentCount', function() {
    requireTenantId();
    fail('estimatedDocumentCount cannot be tenant scoped; use countDocuments');
  });

  schema.pre('aggregate', function() {
    const tenantId = requireTenantId();
    scopePipeline(this.pipeline(), this._model.db, tenantId);
  });

  schema.statics.insertMany = async function(documents, options = {}) {
    const tenantId = requireTenantId();
    guardWriteOptions(options);
    const prepared = [];
    for (const document of Array.isArray(documents) ? documents : [documents]) {
      let candidate;
      if (document instanceof mongoose.Document) {
        guardDocument(document);
        candidate = document;
      } else {
        if (!document || typeof document !== 'object') fail('insertMany requires documents');
        rejectTenantPayload(document);
        candidate = new this({ ...document, tenantId });
        guardDocument(candidate);
      }
      await checkDocumentReferences(this.db, refs, candidate, tenantId, options.session);
      prepared.push(candidate);
    }
    return mongoose.Model.insertMany.call(this, prepared, options);
  };

  schema.statics.bulkWrite = async function(operations, options = {}) {
    const tenantId = requireTenantId();
    guardWriteOptions(options);
    if (!Array.isArray(operations)) fail('bulkWrite requires an array');
    const prepared = [];
    for (const operation of operations) {
      if (!operation || Object.keys(operation).length !== 1) fail('invalid bulk operation');
      const [kind, input] = Object.entries(operation)[0];
      if (!input || typeof input !== 'object') fail('invalid bulk payload');
      const payload = { ...input };
      guardWriteOptions(payload);
      if (kind === 'insertOne') {
        if (payload.document instanceof mongoose.Document) guardDocument(payload.document);
        else {
          if (!payload.document || typeof payload.document !== 'object') fail('insertOne requires a document');
          rejectTenantPayload(payload.document);
          payload.document = new this({ ...payload.document, tenantId });
          guardDocument(payload.document);
        }
        await checkDocumentReferences(this.db, refs, payload.document, tenantId, options.session);
      } else if (['updateOne', 'updateMany', 'replaceOne', 'deleteOne', 'deleteMany'].includes(kind)) {
        if (payload.upsert) await checkUpsertFilter(this.db, refs, payload.filter, tenantId, options.session);
        payload.filter = scopedFilter(payload.filter, tenantId);
        if (kind === 'replaceOne') payload.replacement = await prepareUpdate(this.db, refs, payload.replacement, { ...options, ...payload }, tenantId, true);
        else if (kind.startsWith('update')) payload.update = await prepareUpdate(this.db, refs, payload.update, { ...options, ...payload }, tenantId);
      } else fail(`unsupported bulk operation ${kind}`);
      prepared.push({ [kind]: payload });
    }
    return mongoose.Model.bulkWrite.call(this, prepared, options);
  };

  schema.statics.bulkSave = async function() {
    requireTenantId();
    fail('bulkSave is unsupported; use save or explicit bulkWrite operations');
  };
  schema.statics.watch = function() {
    requireTenantId();
    fail('change streams are unsupported on tenant models');
  };

  schema.statics.populate = function(documents, paths) {
    const tenantId = requireTenantId();
    const guarded = guardPopulate(this, paths, tenantId);
    return mongoose.Model.populate.call(this, documents, guarded);
  };
}

export default tenantPlugin;
