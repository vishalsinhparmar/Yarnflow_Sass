import mongoose from 'mongoose';
import tenantPlugin from '../saas/tenantPlugin.js';
import { generateDocumentNumber } from '../utils/generateDocumentNumber.js';

const salesOrderSchema = new mongoose.Schema({
  // Order Identification
  soNumber: {
    type: String,
    unique: true
  },
  
  // Customer Information
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  customerName: {
    type: String,
    required: true,
    default: 'Unknown Company'
  },

  // Category (NEW - for inventory integration)
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },

  // Order Dates
  orderDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  expectedDeliveryDate: {
    type: Date,
    required: false
  },

  // Order Items
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    productName: { type: String, required: true },
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
    subProductWeights: {
      type: [Number],
      default: []
    },
    
    // Quantities
    quantity: { type: Number, required: true, min: 0 },
    shippedQuantity: { type: Number, default: 0, min: 0 },
    deliveredQuantity: { type: Number, default: 0, min: 0 },
    
    unit: { type: String, required: true },
    weight: { type: Number, default: 0 },
    dispatchedWeight: { type: Number, default: 0 },
    manuallyCompleted: { type: Boolean, default: false },
    
    // Item-specific notes
    notes: {
      type: String,
      default: '',
      trim: true
    }
  }],

  // Order Status
  status: {
    type: String,
    enum: ['Draft', 'Pending', 'Processing', 'Delivered', 'Cancelled'],
    default: 'Draft'
  },
  
  // Audit
  createdBy: { type: String, required: true }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance (soNumber index is created by unique:true)
salesOrderSchema.index({ customer: 1 });
salesOrderSchema.index({ status: 1 });
salesOrderSchema.index({ orderDate: -1 });
salesOrderSchema.index({ expectedDeliveryDate: 1 });
salesOrderSchema.index({ customerName: 1 });

// Virtual for backward compatibility with PDF generator
salesOrderSchema.virtual('customerDetails').get(function() {
  return {
    companyName: this.customerName || 'Unknown Company'
  };
});

// Virtual for order completion percentage
salesOrderSchema.virtual('completionPercentage').get(function() {
  if (!this.items || this.items.length === 0) return 0;
  
  const totalQuantity = this.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const deliveredQuantity = this.items.reduce((sum, item) => sum + (item.deliveredQuantity || 0), 0);
  
  return totalQuantity > 0 ? Math.round((deliveredQuantity / totalQuantity) * 100) : 0;
});

// Method to update dispatch status based on challan data
// Note: This is called from controller after fetching challans to avoid circular dependency
salesOrderSchema.methods.updateDispatchStatus = function(challans) {
  if (!challans || challans.length === 0) {
    return;
  }
  
  // Calculate dispatched quantities and actual weights per SO item.
  // Weight is summed from per-bag subProductWeights when available (exact),
  // otherwise from the stored challan item weight field (for non-sub-product items).
  const dispatchedMap = {};
  const dispatchedWeightMap = {};
  const manuallyCompletedMap = {};
  
  challans.forEach(challan => {
    if (!challan.items || !Array.isArray(challan.items)) {
      return;
    }
    
    challan.items.forEach(item => {
      const key = item.salesOrderItem.toString();
      
      if (!dispatchedMap[key]) {
        dispatchedMap[key] = 0;
        dispatchedWeightMap[key] = 0;
      }
      dispatchedMap[key] += item.dispatchQuantity || 0;

      // Use exact bag weight sum when available, otherwise fall back to stored weight
      const itemWeight = Array.isArray(item.subProductWeights) && item.subProductWeights.length > 0
        ? item.subProductWeights.reduce((s, w) => s + (Number(w) || 0), 0)
        : (item.weight || 0);
      dispatchedWeightMap[key] += itemWeight;
      
      // Track if any challan marked this item as manually completed
      if (item.manuallyCompleted) {
        manuallyCompletedMap[key] = true;
      }
    });
  });
  
  // Update each SO item's dispatch status
  let allItemsCompleted = true;
  let anyItemDispatched = false;
  
  for (let i = 0; i < this.items.length; i++) {
    const item = this.items[i];
    const itemId = item._id.toString();
    const dispatched = dispatchedMap[itemId] || 0;
    const manuallyCompleted = manuallyCompletedMap[itemId] || false;
    
    // Save dispatched quantities to SO item (like GRN saves receivedQuantity to PO item)
    item.deliveredQuantity = dispatched;
    item.shippedQuantity = dispatched; // Keep both in sync
    item.manuallyCompleted = manuallyCompleted;

    // Use actual summed dispatched weight — never averaged
    item.dispatchedWeight = dispatchedWeightMap[itemId] || 0;
    
    if (dispatched > 0) {
      anyItemDispatched = true;
    }
    
    if (manuallyCompleted) {
      // Item manually marked as complete
      console.log(`✅ Item ${item.productName || 'Unknown'} manually completed (${dispatched}/${item.quantity})`);
      // Consider it complete regardless of quantity
    } else if (dispatched < item.quantity) {
      // Not fully dispatched and not manually completed
      allItemsCompleted = false;
    }
  }
  
  // Update SO status based on dispatch progress
  if (allItemsCompleted && this.status !== 'Delivered') {
    this.status = 'Delivered';
    console.log(`📦 Sales Order ${this.soNumber} marked as Delivered`);
  } else if (anyItemDispatched && (this.status === 'Draft' || this.status === 'Pending')) {
    // If any items dispatched and status is Draft or Pending, move to Processing
    this.status = 'Processing';
    console.log(`📦 Sales Order ${this.soNumber} marked as Processing (${Object.keys(dispatchedMap).length} items dispatched)`);
  }
  
  this.markModified('status');
};

/**
 * Generate unique SO number - PRODUCTION SAFE
 * 
 * This method ensures NO duplicate SO numbers even when documents are deleted.
 * 
 * Example scenarios:
 * - Existing SOs: 1, 2, 3, 4, 5, 6, 7
 *   Delete: 4
 *   Next SO: 8 (NOT 4!) ✅
 * 
 * - Existing SOs: 1, 2, 5, 7, 10
 *   (3, 4, 6, 8, 9 were deleted)
 *   Next SO: 11 (uses max + 1) ✅
 * 
 * - Empty database (all deleted)
 *   Next SO: 1 ✅
 * 
 * How it works:
 * 1. Fetch ALL existing SO numbers from database
 * 2. Extract numeric part from each (e.g., "PKRK/SO/15" → 15)
 * 3. Find the MAXIMUM number
 * 4. Return MAX + 1
 * 
 * This guarantees:
 * ✅ Never reuses deleted SO numbers
 * ✅ Handles any deletion pattern (single, multiple, gaps)
 * ✅ Works with empty database
 * ✅ Thread-safe (uses database as source of truth)
 * ✅ Scalable for production
 */
// salesOrderSchema.statics.generateSONumber = async function() {
//   try {
//     // Fetch all SO numbers from database (only soNumber field for performance)
//     const allSOs = await this.find({}, { soNumber: 1 })
//       .lean()
//       .exec();
    
//     let maxNumber = 0;
    
//     // Extract numeric part from each SO number and find maximum
//     // Example: "PKRK/SO/15" → extract 15 → compare with max
//     allSOs.forEach(so => {
//       if (so.soNumber) {
//         // Match pattern: PKRK/SO/[digits]
//         const match = so.soNumber.match(/PKRK\/SO\/(\d+)/);
//         if (match) {
//           const num = parseInt(match[1], 10);
//           if (num > maxNumber) {
//             maxNumber = num;
//           }
//         }
//       }
//     });
    
//     // Next number is always max + 1
//     // This ensures we NEVER reuse deleted numbers
//     const nextNumber = maxNumber + 1;
    
//     // Format: PKRK/SO/1, PKRK/SO/2, ..., PKRK/SO/100000, etc.
//     // No padding limit - supports unlimited SO numbers
//     const newSONumber = `PKRK/SO/${nextNumber}`;
    
//     // Log for debugging and audit trail
//     console.log(`🔢 Generated SO Number: ${newSONumber} (previous max: ${maxNumber}, total SOs: ${allSOs.length})`);
    
//     return newSONumber;
//   } catch (error) {
//     // Fallback mechanism in case of database errors
//     console.error('❌ Error generating SO number:', error);
    
//     // Use timestamp-based unique number as fallback
//     // This ensures SO creation never fails completely
//     const timestamp = Date.now().toString().slice(-6);
//     const fallbackNumber = `PKRK/SO/${timestamp}`;
    
//     console.warn(`⚠️  Using fallback SO number: ${fallbackNumber}`);
    
//     return fallbackNumber;
//   }
// };

// Static method to get order statistics

salesOrderSchema.pre('save',async function (next) {
        try {
          // Generate PO number ONLY on first save
          if (!this.soNumber) {
            this.soNumber = await generateDocumentNumber({
              type: 'SO',
              prefix: '',  // No prefix - generates SO/001, SO/002, etc.
              pad: 3
            });
          }
          next();
        } catch (error) {
          next(error);
        }
})
salesOrderSchema.statics.getOrderStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 }
      }
    }
  ]);
  
  const statusStats = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const monthlyStats = await this.aggregate([
    {
      $match: {
        orderDate: {
          $gte: new Date(new Date().getFullYear(), 0, 1) // Current year
        }
      }
    },
    {
      $group: {
        _id: {
          month: { $month: '$orderDate' },
          year: { $year: '$orderDate' }
        },
        orders: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);
  
  return {
    overview: stats[0] || { totalOrders: 0 },
    statusBreakdown: statusStats,
    monthlyTrends: monthlyStats
  };
};


salesOrderSchema.plugin(tenantPlugin);

const SalesOrder = mongoose.model('SalesOrder', salesOrderSchema);

export default SalesOrder;
