import mongoose from 'mongoose';
import tenantPlugin from '../saas/tenantPlugin.js';

/**
 * CompanyProfile Model
 *
 * Designed for multi-client scalability:
 * - Each company has one profile document (singleton per company slug)
 * - In future, a companyId/tenantId can isolate data per client
 * - All PDF generation reads from this model instead of hardcoded values
 */
const companyProfileSchema = new mongoose.Schema(
  {
    // Unique slug for future multi-tenant support (e.g. "client-a", "client-b")
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      default: 'default'
    },

    // Company Identity
    companyName: {
      type: String,
      required: true,
      trim: true
    },
    tagline: {
      type: String,
      trim: true,
      default: ''
    },

    // Address
    headOfficeAddress: {
      type: String,
      trim: true,
      default: ''
    },
    branchOfficeAddress: {
      type: String,
      trim: true,
      default: ''
    },
    city: {
      type: String,
      trim: true,
      default: ''
    },
    state: {
      type: String,
      trim: true,
      default: ''
    },
    pincode: {
      type: String,
      trim: true,
      default: ''
    },

    // Contact
    phone: {
      type: String,
      trim: true,
      default: ''
    },
    altPhone: {
      type: String,
      trim: true,
      default: ''
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: ''
    },
    website: {
      type: String,
      trim: true,
      default: ''
    },

    // Registrations
    gstin: {
      type: String,
      trim: true,
      default: ''
    },
    msmeNo: {
      type: String,
      trim: true,
      default: ''
    },
    panNo: {
      type: String,
      trim: true,
      default: ''
    },
    udyamNo: {
      type: String,
      trim: true,
      default: ''
    },

    // PDF / Document Settings
    challanTermsAndConditions: {
      type: [String],
      default: [
        'Goods once sold will not be taken back.',
        'Received the goods in good conditions.',
        'All Subject to local Jurisdiction.'
      ]
    },
    challanFooterNote: {
      type: String,
      trim: true,
      default: 'Computer-generated delivery challan'
    },
    signatureLabel: {
      type: String,
      trim: true,
      default: 'For'
    },

    // Branding
    logoUrl: {
      type: String,
      trim: true,
      default: ''
    },
    primaryColor: {
      type: String,
      trim: true,
      default: '#0891b2'
    },

    // Active flag — only one profile should be active at a time
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    collection: 'company_profiles'
  }
);

// slug index is created by unique:true above
companyProfileSchema.index({ isActive: 1 });

companyProfileSchema.plugin(tenantPlugin);

const CompanyProfile = mongoose.model('CompanyProfile', companyProfileSchema);

export default CompanyProfile;
