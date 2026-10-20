import CompanyProfile from '../models/CompanyProfile.js';
import { runWithTenant } from './tenantContext.js';

export function seedCompanyProfile(company) {
  return runWithTenant(String(company._id), async () => CompanyProfile.findOneAndUpdate(
    { slug: 'default' },
    { $setOnInsert: {
      slug: 'default', companyName: company.name, headOfficeAddress: company.address || '',
      city: company.city || '', state: company.state || '', pincode: company.pincode || '',
      phone: company.phone || '', email: company.email || '', gstin: company.gstin || '',
      website: company.website || '', isActive: true
    } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: false }
  ));
}
