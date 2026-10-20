// Usage (server directory): node scripts/saas-migrate.js [--dry-run]
// Apply only to an OFFLINE, freshly copied local development replica-set database:
// node scripts/saas-migrate.js --apply --acknowledge-copied-development-database
// Required: safe SAAS_* configuration, SAAS_MIGRATION_CONFIRM=<SAAS_DB_NAME>.
// Index replacements are reported, never executed. Review/approve them separately.
import mongoose from 'mongoose';
import { pathToFileURL } from 'node:url';
import { getSaasConfig } from '../src/saas/config.js';

const modelFiles = [
  'models/Category.js', 'models/CompanyProfile.js', 'models/Counter.js',
  'models/Customer.js', 'models/GoodsReceiptNote.js', 'models/InventoryLot.js',
  'models/Product.js', 'models/PurchaseOrder.js', 'models/SalesChallan.js',
  'models/SalesOrder.js', 'models/SubProduct.js', 'models/Supplier.js',
  'models/Unit.js', 'models/WarehouseLocation.js', 'models/user.model.js',
  'reports/savedReport.model.js', 'reports/reportDownload.model.js'
];
const unassigned = { tenantId: null }; // MongoDB matches only absent or explicit null.
const defaultCode = 'LEGACY-DEFAULT';
const defaultName = 'Legacy Development Copy';

function refuse(message) {
  const error = new Error(message);
  error.safeMigrationMessage = true;
  throw error;
}

export async function migrateLegacyData({ argv = [], env = process.env, output = console.log } = {}) {
  const allowedFlags = new Set(['--dry-run', '--apply', '--acknowledge-copied-development-database']);
  if (argv.some(flag => !allowedFlags.has(flag)) || new Set(argv).size !== argv.length) refuse('Unknown or duplicate migration flag');
  if (argv.includes('--apply') && argv.includes('--dry-run')) refuse('Choose --dry-run or --apply, not both');
  const apply = argv.includes('--apply');
  const config = getSaasConfig(env); // Rejects non-local, legacy, production and mismatched DB configuration.
  if (apply && (config.mode !== 'development' || !config.dbName.endsWith('_saas_dev'))) {
    refuse('Apply requires an explicitly named local _saas_dev development copy');
  }
  if (apply && (!argv.includes('--acknowledge-copied-development-database') || env.SAAS_MIGRATION_CONFIRM !== config.dbName)) {
    refuse('Apply requires --acknowledge-copied-development-database and SAAS_MIGRATION_CONFIRM equal to SAAS_DB_NAME');
  }
  const uri = new URL(config.uri);
  if (decodeURIComponent(uri.pathname.slice(1)) !== config.dbName) refuse('Migration URI must explicitly name the isolated database');

  // Import schemas for the allowlist/index plan only. Do not connect Mongoose,
  // call init/syncIndexes, or import db.js/index.js (which can initialize indexes).
  const models = [];
  for (const file of modelFiles) models.push((await import(new URL(`../src/${file}`, import.meta.url))).default);
  const Company = (await import('../src/saas/company.model.js')).default;
  const client = new mongoose.mongo.MongoClient(config.uri, {
    serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000, maxPoolSize: 2,
    directConnection: true, appName: 'yarnflow-copy-only-migration'
  });
  try {
    await client.connect();
    const db = client.db(config.dbName);
    const collections = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(item => item.name));
    const companies = db.collection(Company.collection.name);
    const existingCompany = await companies.findOne({ companyCode: defaultCode });
    const tenantId = existingCompany?._id || new mongoose.Types.ObjectId();
    const blockers = [];
    if (existingCompany && (existingCompany.name !== defaultName || existingCompany.status !== 'pending' || existingCompany.initialAdminId)) {
      blockers.push('The default company has already been administered; use a fresh offline development copy');
    }
    if (await companies.countDocuments({ companyCode: { $ne: defaultCode } })) {
      blockers.push('Other SaaS companies already exist; migration requires a fresh offline development copy');
    }
    const summary = [];
    const indexReplacements = [];
    const counterPlans = [];
    for (const model of models) {
      const name = model.collection.name;
      const collection = db.collection(name);
      const present = collections.has(name);
      const total = present ? await collection.countDocuments() : 0;
      const count = present ? await collection.countDocuments(unassigned) : 0;
      const foreign = present ? await collection.countDocuments({ tenantId: { $nin: [null, tenantId] } }) : 0;
      if (foreign) blockers.push(`${name}: assigned or malformed tenant IDs need manual review`);
      summary.push({ collection: name, total, unassigned: count, alreadyAssigned: total - count });
      const desired = model.schema.indexes();
      if (present) {
        for (const index of await collection.listIndexes().toArray()) {
          if (index.name === '_id_') continue;
          if (index.expireAfterSeconds != null) blockers.push(`${name}: TTL index requires separate retention review`);
          if (!index.unique || Object.hasOwn(index.key, 'tenantId')) continue;
          const replacement = desired.find(([keys, options]) => options.unique && JSON.stringify(keys) === JSON.stringify({ tenantId: 1, ...index.key }));
          indexReplacements.push({
            collection: name,
            existing: { name: index.name, key: index.key, unique: true, ...(index.sparse ? { sparse: true } : {}) },
            proposed: replacement ? { key: replacement[0], options: replacement[1] } : { key: { tenantId: 1, ...index.key }, options: { unique: true }, requiresSchemaReview: true }
          });
        }
      }
      if (model.modelName === 'Counter' && count) {
        // _id is immutable. Preserve the old counter record and create a namespaced
        // counterpart; never delete/rekey the source. $max cannot lower a sequence.
        for await (const counter of collection.find(unassigned, { projection: { _id: 1, seq: 1 } })) {
          if (typeof counter._id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(counter._id) || !Number.isSafeInteger(counter.seq) || counter.seq < 0) {
            blockers.push('counters: unexpected legacy key or sequence requires manual review');
            continue;
          }
          const targetId = `${tenantId.toHexString()}:${counter._id}`;
          const target = await collection.findOne({ _id: targetId });
          if (target && (String(target.tenantId) !== String(tenantId) || !Number.isSafeInteger(target.seq) || target.seq < 0)) {
            blockers.push('counters: namespaced target conflicts with the legacy copy');
          }
          counterPlans.push({ sourceId: counter._id, targetId, seq: counter.seq });
        }
      }
    }
    if (indexReplacements.length) blockers.push('Legacy global unique indexes must be reviewed and replaced separately on the development copy before apply');
    const report = {
      mode: apply ? 'apply' : 'dry-run',
      collections: summary,
      defaultCompany: existingCompany ? 'reuse pending migration company' : 'create pending migration company',
      countersToNamespace: counterPlans.length,
      migratedUsers: 'disabled; password reset and explicit activation required',
      unknownCollectionsUntouched: [...collections].filter(name => !models.some(model => model.collection.name === name) && !['saas_companies', 'saas_super_admins'].includes(name)).length,
      indexReplacements,
      blockers: [...new Set(blockers)]
    };
    output(JSON.stringify(report, null, 2)); // Counts/index metadata only: no rows, credentials, URI or IDs.
    if (!apply) return report;
    if (report.blockers.length) refuse('Apply blocked; no records or indexes were changed. Review the dry-run plan on a fresh development copy');
    const hello = await db.command({ hello: 1 });
    if (!hello.setName) refuse('Apply requires a local development replica set for an atomic transaction; no records were changed');

    // All assignments and counter copies commit together. The application must be
    // stopped: an acknowledgement cannot itself prove that a DB was copied.
    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        if (!existingCompany) {
          await companies.insertOne({
            _id: tenantId, name: defaultName, companyCode: defaultCode,
            email: 'migration-review@localhost.invalid', status: 'pending', modules: [],
            initialAdminId: null, createdAt: new Date(), updatedAt: new Date()
          }, { session });
        }
        for (const model of models) {
          const collection = db.collection(model.collection.name);
          if (model.modelName === 'Counter') {
            for (const plan of counterPlans) {
              await collection.updateOne({ _id: plan.targetId, tenantId }, {
                $max: { seq: plan.seq }, $setOnInsert: { tenantId }
              }, { session, upsert: true });
              await collection.updateOne({ _id: plan.sourceId, ...unassigned }, {
                $set: { tenantId, legacyCounterArchive: true }
              }, { session });
            }
          } else {
            const fields = { tenantId };
            if (model.modelName === 'User') fields.isActive = false;
            await collection.updateMany(unassigned, { $set: fields }, { session });
          }
        }
      });
    } finally {
      await session.endSession();
    }
    output('Migration committed. No records deleted and no indexes changed. Default company remains pending; migrated users remain disabled.');
    return report;
  } finally {
    await client.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  migrateLegacyData({ argv: process.argv.slice(2) }).catch(error => {
    // Mongo errors may contain copied records or credentials; never print them.
    console.error(error.safeMigrationMessage ? error.message : 'Migration refused or failed; check isolated configuration and the reviewed development-copy plan. No sensitive error details are printed.');
    process.exitCode = 1;
  });
}
