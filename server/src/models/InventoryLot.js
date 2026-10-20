import mongoose from 'mongoose';
import tenantPlugin from '../saas/tenantPlugin.js';
import Counter from './Counter.js';

// ============ INVENTORY LOT SCHEMA ============
// Tracks inventory from GRN (Stock In) and Sales Challan (Stock Out)
// 
// FLOW: PurchaseOrder → GRN → InventoryLot → SalesChallan
// - When GRN is created: InventoryLot is created with receivedQuantity
// - When Challan is created: currentQuantity is reduced, movement is added
//
const inventoryLotSchema = new mongoose.Schema({
  lotNumber: {
    type: String,
    unique: true,
    uppercase: true
  },
  
  // ===== REFERENCE INFORMATION =====
  // Links to GRN (source of stock)
  grn: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GoodsReceiptNote',
    required: true
  },
  grnNumber: {
    type: String,
    required: true
  },
  // Links to Purchase Order
  purchaseOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseOrder'
  },
  poNumber: {
    type: String
  },
  
  // ===== PRODUCT INFORMATION =====
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  // Sub-product tracking (optional)
  subProduct: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubProduct',
    default: null
  },
  subProductName: {
    type: String,
    default: null
  },
  subProductWeights: {
    type: [Number],
    default: []
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  },
  
  // ===== SUPPLIER INFORMATION =====
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true
  },
  supplierName: {
    type: String,
    required: true
  },
  
  // ===== QUANTITY INFORMATION =====
  receivedQuantity: {
    type: Number,
    required: true,
    min: 0
  },
  currentQuantity: {
    type: Number,
    required: true,
    min: 0
  },
  reservedQuantity: {
    type: Number,
    default: 0,
    min: 0
  },
  availableQuantity: {
    type: Number,
    default: 0,
    min: 0
  },
  unit: {
    type: String,
    default: 'Bags',
    trim: true
  },
  totalWeight: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // ===== STORAGE INFORMATION =====
  warehouse: {
    type: String,
    trim: true
  },
  
  // ===== DATE INFORMATION =====
  receivedDate: {
    type: Date,
    required: true
  },
  
  // ===== STATUS =====
  status: {
    type: String,
    enum: ['Active', 'Reserved', 'Consumed'],
    default: 'Active'
  },
  
  // ===== MOVEMENT HISTORY =====
  // Tracks Stock In (from GRN) and Stock Out (via Challan)
  movements: [{
    type: {
      type: String,
      enum: ['Received', 'Issued', 'Returned', 'Adjusted']
    },
    quantity: Number,
    weight: {
      type: Number,
      default: 0
    },
    date: {
      type: Date,
      default: Date.now
    },
    reference: String, // GRN number or Challan number
    notes: String,
    performedBy: String
  }],
  
  // ===== IDEMPOTENCY PROTECTION (PHASE 6 FIX) =====
  // Unique key to prevent duplicate inventory creation from same GRN
  idempotencyKey: {
    type: String,
    unique: true,
    sparse: true
  },
  
  // ===== ADDITIONAL INFORMATION =====
  notes: {
    type: String,
    trim: true
  },
  
  // ===== AUDIT TRAIL =====
  createdBy: {
    type: String,
    required: true,
    default: 'System'
  },
  lastModifiedBy: {
    type: String
  }
}, {
  timestamps: true
});

// ===== PRE-SAVE HOOKS =====

// Auto-generate lot number before saving
inventoryLotSchema.pre("save", async function(next) {
    try {

        if (!this.lotNumber) {

            const year = new Date().getFullYear();
            const month = String(new Date().getMonth() + 1).padStart(2,"0");

            const counter = await Counter.findByIdAndUpdate(
                `LOT-${year}${month}`,
                { $inc: { seq: 1 } },
                {
                    new: true,
                    upsert: true
                }
            );

            this.lotNumber =
            `LOT${year}${month}${String(counter.seq).padStart(4,"0")}`;

        }

        next();

    } catch(err){
        next(err);
    }
});

// Calculate available quantity and update status before saving
inventoryLotSchema.pre('save', function(next) {
  // Calculate available quantity
  this.availableQuantity = Math.max(0, this.currentQuantity - this.reservedQuantity);
  
  // Update status based on quantity
  if (this.currentQuantity <= 0) {
    this.status = 'Consumed';
  } else if (this.reservedQuantity >= this.currentQuantity) {
    this.status = 'Reserved';
  } else if (this.status === 'Reserved' && this.reservedQuantity < this.currentQuantity) {
    this.status = 'Active';
  }
  
  next();
});

// ===== INDEXES ===== (lotNumber index is created by unique:true)
inventoryLotSchema.index({ product: 1 });
inventoryLotSchema.index({ supplier: 1 });
inventoryLotSchema.index({ grn: 1 });
inventoryLotSchema.index({ status: 1 });
inventoryLotSchema.index({ receivedDate: -1 });

// PHASE 6 FIX: Prevent duplicate inventory from same GRN
inventoryLotSchema.index({ grn: 1, product: 1, subProduct: 1 }, { unique: true, sparse: true });

// ===== STATIC METHODS =====

// Find lots by product
inventoryLotSchema.statics.findByProduct = function(productId, options = {}) {
  const query = { product: productId };
  
  if (options.status) {
    query.status = options.status;
  }
  
  return this.find(query)
    .populate('product', 'productName')
    .populate('supplier', 'companyName')
    .sort({ receivedDate: -1 });
};

// Ensure virtuals are included in JSON output
inventoryLotSchema.set('toJSON', { virtuals: true });
inventoryLotSchema.set('toObject', { virtuals: true });

inventoryLotSchema.plugin(tenantPlugin);

export default mongoose.model('InventoryLot', inventoryLotSchema);
