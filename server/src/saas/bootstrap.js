import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import connectDB from '../../db.js';
import { getSaasConfig } from './config.js';
import Company from './company.model.js';
import { seedCompanyProfile } from './companyProfileSeed.js';
import SuperAdmin from './superAdmin.model.js';
import User from '../models/user.model.js';
import { MODULES } from './modules.js';
import { runWithTenant } from './tenantContext.js';
import { validEmail, validPassword } from './security.js';

async function bootstrap() {
  getSaasConfig();
  if (process.env.SAAS_BOOTSTRAP_CONFIRM !== 'CREATE_LOCAL_SAAS_DEMO') throw new Error('Explicit SAAS_BOOTSTRAP_CONFIRM is required');
  const superEmail = validEmail(process.env.SAAS_SUPER_ADMIN_EMAIL);
  const superPassword = validPassword(process.env.SAAS_SUPER_ADMIN_PASSWORD);
  const demos = [
    { letter: 'A', name: 'Demo Textile Pvt Ltd', companyCode: 'DEMO-A' },
    { letter: 'B', name: 'ABC Yarn Industries', companyCode: 'DEMO-B' }
  ].map(demo => ({
    ...demo,
    email: validEmail(process.env[`SAAS_DEMO_${demo.letter}_ADMIN_EMAIL`]),
    password: validPassword(process.env[`SAAS_DEMO_${demo.letter}_ADMIN_PASSWORD`])
  }));
  const passwords = [superPassword, ...demos.map(demo => demo.password)];
  if (new Set(passwords).size !== passwords.length || passwords.some(password => /replace.?me|placeholder|example/i.test(password))) {
    throw new Error('Provide distinct, non-placeholder bootstrap passwords');
  }
  await connectDB();
  await Promise.all([Company.init(), SuperAdmin.init(), User.init()]);
  if (!(await SuperAdmin.exists({ email: superEmail }))) {
    await SuperAdmin.create({ email: superEmail, password: await bcrypt.hash(superPassword, 12) });
  }
  for (const demo of demos) {
    let company = await Company.findOne({ companyCode: demo.companyCode });
    if (!company) company = await Company.create({
      name: demo.name, companyCode: demo.companyCode, email: demo.email,
      companyType: 'Other', contactPerson: `${demo.name} Admin`,
      phone: demo.companyCode === 'DEMO-A' ? '0000000001' : '0000000002',
      address: `${demo.name} Development Address`, city: `${demo.name} City`, state: 'Development State',
      pincode: demo.companyCode === 'DEMO-A' ? '110001' : '110002', gstin: '', website: '',
      status: 'active', modules: MODULES
    });
    await seedCompanyProfile(company);
    if (company.initialAdminId) continue;
    await runWithTenant(String(company._id), async () => {
      if (await User.exists({ email: demo.email })) throw new Error('Demo user exists without an initial admin link; manual review required');
      const user = await User.create({ tenantId: company._id, name: `${demo.name} Admin`, username: 'admin', email: demo.email, password: await bcrypt.hash(demo.password, 12), role: 'Admin', permissions: MODULES });
      const result = await Company.updateOne({ _id: company._id, initialAdminId: null }, { $set: { initialAdminId: user._id } });
      if (!result.modifiedCount) {
        await User.deleteOne({ _id: user._id });
        throw new Error('Concurrent bootstrap detected; no existing administrator was overwritten');
      }
    });
  }
  console.log('SaaS bootstrap complete. Demo company codes: DEMO-A, DEMO-B. Existing credentials were not overwritten.');
}

bootstrap().catch(error => {
  console.error(`SaaS bootstrap failed: ${error.name === 'ValidationError' ? 'Invalid bootstrap data' : error.message}`);
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
