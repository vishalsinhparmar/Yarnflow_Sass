import mongoose from 'mongoose';
import { MODULES } from './modules.js';
import { fail, validEmail } from './security.js';

const bounded = (value, field, max, required = true) => {
  if (value === undefined || value === null) {
    if (!required) return '';
    throw fail(400, `${field} is required`);
  }
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) throw fail(400, `${field} must be ${required ? 'a nonempty string' : 'a string'} of at most ${max} characters`);
  return value.trim();
};
const validWebsite = value => {
  if (!value) return true;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname) && !url.username && !url.password;
  } catch { return false; }
};
const phonePattern = /^[+\d][\d\s().-]{6,39}$/;
const gstinPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export function registrationFields(body = {}) {
  const fields = {
    name: bounded(body.name ?? body.companyName, 'Company name', 160),
    companyType: bounded(body.companyType, 'Company type', 80),
    contactPerson: bounded(body.contactPerson ?? body.contactName, 'Contact person', 120),
    phone: bounded(body.phone, 'Phone', 40),
    email: validEmail(body.email),
    address: bounded(body.address, 'Address', 500),
    city: bounded(body.city, 'City', 100),
    state: bounded(body.state, 'State', 100),
    pincode: bounded(body.pincode, 'Pincode', 6),
    gstin: bounded(body.gstin, 'GSTIN', 15, false).toUpperCase(),
    website: bounded(body.website, 'Website', 500, false)
  };
  if (!phonePattern.test(fields.phone) || fields.phone.replace(/\D/g, '').length < 7) throw fail(400, 'Phone must contain at least 7 digits and only phone punctuation');
  if (!/^\d{6}$/.test(fields.pincode)) throw fail(400, 'Pincode must contain exactly 6 digits');
  if (fields.gstin && !gstinPattern.test(fields.gstin)) throw fail(400, 'GSTIN must be a valid 15-character GST registration number');
  if (!validWebsite(fields.website)) throw fail(400, 'Website must be an http or https URL without credentials');
  return fields;
}

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 160, unique: true },
  companyCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
  companyType: { type: String, trim: true, maxlength: 80, default: '' },
  contactPerson: { type: String, trim: true, maxlength: 120, default: '', alias: 'contactName' },
  email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  phone: { type: String, trim: true, maxlength: 40, default: '', validate: value => !value || (phonePattern.test(value) && value.replace(/\D/g, '').length >= 7) },
  address: { type: String, trim: true, maxlength: 500, default: '' },
  city: { type: String, trim: true, maxlength: 100, default: '' },
  state: { type: String, trim: true, maxlength: 100, default: '' },
  pincode: { type: String, trim: true, maxlength: 6, default: '', validate: value => !value || /^\d{6}$/.test(value) },
  gstin: { type: String, trim: true, uppercase: true, maxlength: 15, default: '', validate: value => !value || gstinPattern.test(value) },
  website: { type: String, trim: true, maxlength: 500, default: '', validate: validWebsite },
  status: { type: String, enum: ['pending', 'active', 'inactive', 'suspended', 'rejected'], default: 'pending' },
  modules: { type: [{ type: String, enum: MODULES }], default: [] },
  authVersion: { type: Number, default: 0, min: 0 },
  initialAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true, collection: 'saas_companies' });
export default mongoose.models.SaasCompany || mongoose.model('SaasCompany', schema);
