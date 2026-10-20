import mongoose from 'mongoose';
import tenantPlugin from '../saas/tenantPlugin.js';
import { generateDocumentNumber } from '../utils/generateDocumentNumber.js';

const purchaseOrderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: {
    type: String,
    required: true // Store name for historical reference
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  subProduct: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubProduct',
    default: null
  },
  subProductName: {
    type: String,
    default: null
  },
  // Per-unit weights when sub-product tracking is used (e.g., weight per bag/roll)
  subProductWeights: {
    type: [Number],
    default: []
  },
  productCode: {
    type: String
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  weight: {
    type: Number,
    default: 0,
    min: 0
  },
  unit: {
    type: String,
    default: 'Bags',
    trim: true
  },
  receivedQuantity: {
    type: Number,
    default: 0,
    min: 0
  },
  receivedWeight: {
    type: Number,
    default: 0,
    min: 0
  },
  pendingQuantity: {
    type: Number,
    default: 0
  },
  pendingWeight: {
    type: Number,
    default: 0
  },
  receiptStatus: {
    type: String,
    enum: ['Pending', 'Partial', 'Complete'],
    default: 'Pending'
  },
  notes: {
    type: String,
    trim: true
  },
  // Manual completion fields
  manuallyCompleted: {
    type: Boolean,
    default: false
  },
  completionReason: {
    type: String,
    trim: true
  }
});

const purchaseOrderSchema = new mongoose.Schema({
  poNumber: {
    type: String,
    unique: true,
    uppercase: true
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  supplierDetails: {
    companyName: {
      type: String,
      required: true
    }
  },
  orderDate: {
    type: Date,
    default: Date.now,
    required: true
  },
  expectedDeliveryDate: {
    type: Date
    // No default - will be null if not provided
  },
  items: [purchaseOrderItemSchema],
  
  // Status
  status: {
    type: String,
    enum: ['Draft', 'Partially_Received', 'Fully_Received', 'Cancelled'],
    default: 'Draft'
  },
  
  // Receipt Tracking
  totalGRNs: {
    type: Number,
    default: 0
  },
  completionPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  // Audit
  createdBy: {
    type: String,
    required: true,
    default: 'System'
  }
}, {
  timestamps: true
});

/**
 * Generate unique PO number - PRODUCTION SAFE
 * 
 * This method ensures NO duplicate PO numbers even when documents are deleted.
 * Same approach as SalesOrder to prevent E11000 duplicate key errors.
 */
// purchaseOrderSchema.statics.generatePONumber = async function() {
//   try {
//     // Fetch all PO numbers from database (only poNumber field for performance)
//     const allPOs = await this.find({}, { poNumber: 1 })
//       .lean()
//       .exec();
    
//     let maxNumber = 0;
    
    // Extract numeric part from each PO number and find maximum
    // Example: "PKRK/PO/15" → extract 15 → compare with max
    // allPOs.forEach(po => {
    //   if (po.poNumber) {
    //     // Match pattern: PKRK/PO/[digits]
    //     const match = po.poNumber.match(/PKRK\/PO\/(\d+)/);
    //     if (match) {
    //       const num = parseInt(match[1], 10);
    //       if (num > maxNumber) {
    //         maxNumber = num;
    //       }
    //     }
    //   }
    // });
    
    // Next number is always max + 1
    // This ensures we NEVER reuse deleted numbers
    // const nextNumber = maxNumber + 1;
    
    // Format: PKRK/PO/1, PKRK/PO/2, ..., PKRK/PO/100000, etc.
    // No padding limit - supports unlimited PO numbers
    // const newPONumber = `PKRK/PO/${nextNumber}`;
    
    // Log for debugging and audit trail
    // console.log(`🔢 Generated PO Number: ${newPONumber} (previous max: ${maxNumber}, total POs: ${allPOs.length})`);
    
    // return newPONumber;
  // } catch (error) {
    // Fallback mechanism in case of database errors
    // console.error('❌ Error generating PO number:', error);
    
    // Use timestamp-based unique number as fallback
//     const timestamp = Date.now().toString().slice(-6);
//     const fallbackNumber = `PKRK/PO/${timestamp}`;
    
//     console.warn(`⚠️  Using fallback PO number: ${fallbackNumber}`);
    
//     return fallbackNumber;
//   }
// };

purchaseOrderSchema.pre('save', async function (next) {
  try {
    // Generate PO number ONLY on first save
    if (!this.poNumber) {
      this.poNumber = await generateDocumentNumber({
        type: 'PO',
        prefix: '',  // No prefix - generates PO/001, PO/002, etc.
        pad: 3
      });
    }
    next();
  } catch (error) {
    next(error);
  }
});
// Pre-save hook for calculating quantities and status
purchaseOrderSchema.pre('save', async function(next) {
  // Calculate pending quantities for items
  this.items.forEach(item => {
    item.pendingQuantity = item.quantity - item.receivedQuantity;
  });
  
  // Update status based on received quantities
  const totalItems = this.items.length;
  const fullyReceivedItems = this.items.filter(item => item.receivedQuantity >= item.quantity).length;
  const partiallyReceivedItems = this.items.filter(item => item.receivedQuantity > 0 && item.receivedQuantity < item.quantity).length;
  
  if (fullyReceivedItems === totalItems) {
    this.status = 'Fully_Received';
  } else if (partiallyReceivedItems > 0 || fullyReceivedItems > 0) {
    this.status = 'Partially_Received';
  }
  
  next();
});


// Indexes for better query performance (poNumber index is created by unique:true)
purchaseOrderSchema.index({ supplier: 1 });
purchaseOrderSchema.index({ status: 1 });
purchaseOrderSchema.index({ orderDate: -1 });
purchaseOrderSchema.index({ expectedDeliveryDate: 1 });
purchaseOrderSchema.index({ createdAt: -1 });

// Virtual for checking if PO is overdue
purchaseOrderSchema.virtual('isOverdue').get(function() {
  if (!this.expectedDeliveryDate || !this.status) {
    return false;
  }
  return this.expectedDeliveryDate < new Date() && !['Fully_Received', 'Cancelled'].includes(this.status);
});

// Method to update receipt status and calculations
purchaseOrderSchema.methods.updateReceiptStatus = function() {
  // Update each item's status and pending quantities
  // Use direct index access to force Mongoose to track changes
  for (let i = 0; i < this.items.length; i++) {
    const item = this.items[i];
    
    // Update item receipt status (consider manual completion FIRST)
    if (item.manuallyCompleted) {
      // If manually completed, mark as Complete regardless of qty
      console.log(`✅ Item ${item.productName} manually completed - setting status to Complete`);
      
      // Use set() method to ensure Mongoose tracks the change
      this.items[i].set('receiptStatus', 'Complete');
      this.items[i].set('pendingQuantity', 0);
      this.items[i].set('pendingWeight', 0);
    } else {
      // PHASE 5 FIX: Calculate pending quantities from actual GRN values
      const pendingQty = item.quantity - (item.receivedQuantity || 0);
      const pendingWt = item.weight - (item.receivedWeight || 0);
      
      this.items[i].set('pendingQuantity', pendingQty);
      this.items[i].set('pendingWeight', Math.max(0, pendingWt));
      
      // Set status based on received quantity
      if (item.receivedQuantity === 0) {
        this.items[i].set('receiptStatus', 'Pending');
      } else if (item.receivedQuantity < item.quantity) {
        console.log(`ℹ️  Item ${item.productName} partial: ${item.receivedQuantity}/${item.quantity}, manuallyCompleted: ${item.manuallyCompleted}`);
        this.items[i].set('receiptStatus', 'Partial');
      } else {
        this.items[i].set('receiptStatus', 'Complete');
      }
    }
  }
  
  // Calculate overall completion percentage
  const totalQuantity = this.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const receivedQuantity = this.items.reduce((sum, item) => sum + (item.receivedQuantity || 0), 0);
  this.completionPercentage = totalQuantity > 0 ? Math.round((receivedQuantity / totalQuantity) * 100) : 0;
  
  // Update overall PO status
  const totalItems = this.items.length;
  const completedItems = this.items.filter(item => item.receiptStatus === 'Complete').length;
  const partialItems = this.items.filter(item => item.receiptStatus === 'Partial').length;
  
  if (completedItems === totalItems) {
    this.status = 'Fully_Received';
  } else if (partialItems > 0 || completedItems > 0) {
    this.status = 'Partially_Received';
  }
  
  // Mark all modified fields explicitly for Mongoose
  this.markModified('status');
  this.markModified('completionPercentage');
  this.markModified('items');
};

// Virtual for completion percentage (kept for backward compatibility)
purchaseOrderSchema.virtual('completionPercent').get(function() {
  // Safety check for items array
  if (!this.items || !Array.isArray(this.items)) {
    return 0;
  }
  
  const totalQuantity = this.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const receivedQuantity = this.items.reduce((sum, item) => sum + (item.receivedQuantity || 0), 0);
  return totalQuantity > 0 ? Math.round((receivedQuantity / totalQuantity) * 100) : 0;
});

// Ensure virtuals are included in JSON output
purchaseOrderSchema.set('toJSON', { virtuals: true });
purchaseOrderSchema.set('toObject', { virtuals: true });

purchaseOrderSchema.plugin(tenantPlugin);

export default mongoose.model('PurchaseOrder', purchaseOrderSchema);
