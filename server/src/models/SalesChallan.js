import mongoose from 'mongoose';
import tenantPlugin from '../saas/tenantPlugin.js';
import { generateDocumentNumber } from '../utils/generateDocumentNumber.js';

const salesChallanSchema = new mongoose.Schema({
  // Basic Information
  challanNumber: {
    type: String,
    unique: true
  },
  challanDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  
  // Reference to Sales Order
  salesOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SalesOrder',
    required: true
  },
  soNumber: {
    type: String,
    required: false,  // Made optional temporarily
  },
  
  // Customer Information (cached from SO)
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: false  // Made optional temporarily
  },
  customerName: String,
  
  // Warehouse Information (NEW - like GRN)
  warehouseLocation: {
    type: String,
    required: true
  },
  
  // Expected Delivery Date
  expectedDeliveryDate: Date,
  
  // Items to be dispatched
  items: [{
    salesOrderItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SalesOrder.items',
      required: true
    },
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
    
    // Sub-product tracking
    subProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubProduct',
      default: null
    },
    subProductName: { type: String, default: null },
    subProductWeights: {
      type: [Number],
      default: []
    },
    
    // Quantities
    orderedQuantity: { type: Number, required: true, min: 0 },
    dispatchQuantity: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true },
    weight: { type: Number, default: 0 },
    
    // Manual completion support
    manuallyCompleted: { type: Boolean, default: false },
    
    // Item-specific notes (from Sales Order)
    notes: {
      type: String,
      default: '',
      trim: true
    }
  }],
  
  // Status and Workflow (Simplified)
  status: {
    type: String,
    enum: ['Prepared', 'Dispatched', 'Delivered', 'Cancelled'],
    default: 'Prepared'
  },
  
  // Workflow History
  statusHistory: [{
    status: {
      type: String,
      enum: ['Prepared', 'Dispatched', 'Delivered', 'Cancelled']
    },
    timestamp: { type: Date, default: Date.now },
    updatedBy: String,
    notes: String
  }],
  
  // Dispatch Notes
  notes: { type: String, default: '' },
  
  // Audit
  createdBy: { type: String, required: true }
}, {
  timestamps: true
});

salesChallanSchema.index({ challanDate: -1 });
salesChallanSchema.index({ status: 1, challanDate: -1 });
salesChallanSchema.index({ customer: 1, challanDate: -1 });
salesChallanSchema.index({ expectedDeliveryDate: 1 });

// Pre-save middleware to generate challan number and handle status history
salesChallanSchema.pre('save', async function(next) {
  try {
    /* ===============================
       1️⃣ Generate Challan Number
    ================================ */
    if (this.isNew && !this.challanNumber) {
      this.challanNumber = await generateDocumentNumber({
        type: 'SC',        // Sales Challan
        prefix: '',  // No prefix - generates SC/001, SC/002, etc.
        pad: 3
      });
    }

    /* ===============================
       2️⃣ Status History Tracking
    ================================ */
    if (this.isModified('status') && !this.isNew) {
      this.statusHistory.push({
        status: this.status,
        timestamp: new Date(),
        updatedBy: 'System',
        notes: `Status changed to ${this.status}`
      });
    }

    next();
  } catch (error) {
    next(error);
  }
});


// Static method to get statistics
salesChallanSchema.statics.getStats = async function() {
  try {
    const stats = await Promise.all([
      // Total challans
      this.countDocuments(),
      
      // Status breakdown
      this.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      
      // This month challans
      this.countDocuments({
        challanDate: {
          $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          $lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
        }
      }),
      
      // In transit challans (Dispatched only)
      this.countDocuments({
        status: 'Dispatched'
      }),
      
      // Delivered this month
      this.countDocuments({
        status: 'Delivered',
        challanDate: {
          $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          $lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
        }
      })
    ]);
    
    const [totalChallans, statusBreakdown, thisMonth, inTransit, deliveredThisMonth] = stats;
    
    // Calculate Pending, Partial, Delivered stats based on item completion
    // Use aggregation for better performance with large datasets
    const completionStats = await this.aggregate([
      {
        $project: {
          items: 1,
          completionStatus: {
            $cond: {
              if: { $eq: [{ $size: '$items' }, 0] },
              then: 'pending',
              else: {
                $let: {
                  vars: {
                    allComplete: {
                      $allElementsTrue: {
                        $map: {
                          input: '$items',
                          as: 'item',
                          in: {
                            $or: [
                              { $eq: ['$$item.manuallyCompleted', true] },
                              { $gte: ['$$item.dispatchQuantity', '$$item.orderedQuantity'] }
                            ]
                          }
                        }
                      }
                    },
                    anyPartial: {
                      $anyElementTrue: {
                        $map: {
                          input: '$items',
                          as: 'item',
                          in: {
                            $and: [
                              { $gt: ['$$item.dispatchQuantity', 0] },
                              { $lt: ['$$item.dispatchQuantity', '$$item.orderedQuantity'] }
                            ]
                          }
                        }
                      }
                    }
                  },
                  in: {
                    $cond: {
                      if: '$$allComplete',
                      then: 'completed',
                      else: {
                        $cond: {
                          if: '$$anyPartial',
                          then: 'partial',
                          else: 'pending'
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      {
        $group: {
          _id: '$completionStatus',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Extract counts from aggregation result
    let pending = 0;
    let partial = 0;
    let completed = 0;
    
    completionStats.forEach(stat => {
      if (stat._id === 'pending') pending = stat.count;
      else if (stat._id === 'partial') partial = stat.count;
      else if (stat._id === 'completed') completed = stat.count;
    });
    
    return {
      overview: {
        totalChallans: totalChallans || 0,
        thisMonth: thisMonth || 0,
        inTransit: inTransit || 0,
        deliveredThisMonth: deliveredThisMonth || 0
      },
      statusBreakdown: statusBreakdown || [],
      pending: pending,
      partial: partial,
      completed: completed
    };
  } catch (error) {
    console.error('Error calculating stats:', error);
    return {
      overview: {
        totalChallans: 0,
        thisMonth: 0,
        inTransit: 0,
        deliveredThisMonth: 0
      },
      statusBreakdown: [],
      pending: 0,
      partial: 0,
      completed: 0
    };
  }
};

// Virtual fields for frontend compatibility
salesChallanSchema.virtual('soReference').get(function() {
  return this.soNumber || (this.salesOrder?.soNumber) || 'N/A';
});

salesChallanSchema.virtual('customerDetails').get(function() {
  if (this.customer && typeof this.customer === 'object' && this.customer.companyName) {
    return {
      companyName: this.customer.companyName,
      contactPerson: this.customer.contactPerson,
      email: this.customer.email,
      phone: this.customer.phone
    };
  }
  return {
    companyName: this.customerName || 'Unknown',
    contactPerson: '',
    email: '',
    phone: ''
  };
});

// Ensure virtuals are included in JSON output
salesChallanSchema.set('toJSON', { virtuals: true });
salesChallanSchema.set('toObject', { virtuals: true });

salesChallanSchema.plugin(tenantPlugin);

const SalesChallan = mongoose.model('SalesChallan', salesChallanSchema);

export default SalesChallan;
