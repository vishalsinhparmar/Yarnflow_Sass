  import mongoose from 'mongoose';
  import GoodsReceiptNote from '../models/GoodsReceiptNote.js';
  import InventoryLot from '../models/InventoryLot.js';
  import PurchaseOrder from '../models/PurchaseOrder.js';
  import Product from '../models/Product.js';
  import Supplier from '../models/Supplier.js';
  import WarehouseLocation from '../models/WarehouseLocation.js';
  import { validateAllGRNItems } from '../utils/grnValidation.js';

  // Reduce a (possibly populated) reference field down to its raw ObjectId.
  // Never write a populated subdocument back to the database - only the reference belongs there.
  const refId = (value) => (value && typeof value === 'object' && value._id !== undefined ? value._id : value) ?? null;

  // Build a plain, write-safe PO item payload from a purchase order item subdocument.
  // Only includes the exact fields GRN processing is allowed to touch; references are
  // reduced to raw ObjectIds so populated documents never get embedded/written back.
  const toPoItemWritePayload = (item) => ({
    _id: item._id,
    product: refId(item.product),
    productName: item.productName,
    category: refId(item.category),
    subProduct: refId(item.subProduct),
    subProductName: item.subProductName,
    subProductWeights: item.subProductWeights,
    productCode: item.productCode,
    quantity: item.quantity,
    weight: item.weight,
    unit: item.unit,
    receivedQuantity: item.receivedQuantity,
    receivedWeight: item.receivedWeight,
    pendingQuantity: item.manuallyCompleted ? 0 : item.pendingQuantity,
    pendingWeight: item.manuallyCompleted ? 0 : item.pendingWeight,
    receiptStatus: item.receiptStatus,
    notes: item.notes,
    manuallyCompleted: item.manuallyCompleted,
    completionReason: item.completionReason,
    completedAt: item.completedAt
  });

  // InventoryLot.warehouse is a display String, but the GRN form submits the
  // WarehouseLocation _id (needed so the dropdown can re-select it when editing).
  // Resolve the id to its friendly name here so PDFs/reports never show a raw ObjectId.
  const resolveWarehouseName = async (value, session) => {
    if (!value) return value;
    if (mongoose.Types.ObjectId.isValid(value)) {
      const wh = await WarehouseLocation.findById(value).session(session || null).select('name').lean();
      if (wh?.name) return wh.name;
    }
    return value;
  };

  // ============ GRN CONTROLLERS ============

  // Get all GRNs with pagination and filters
  export const getAllGRNs = async (req, res) => {
    try {
      const { 
        page = 1, 
        limit = 10, 
        search, 
        supplier, 
        status, 
        qualityStatus,
        dateFrom,
        dateTo,
        poNumber 
      } = req.query;
      
      let query = {};
      
      // Search functionality
      if (search) {
        query.$or = [
          { grnNumber: { $regex: search, $options: 'i' } },
          { poNumber: { $regex: search, $options: 'i' } },
          { invoiceNumber: { $regex: search, $options: 'i' } },
          { 'supplierDetails.companyName': { $regex: search, $options: 'i' } }
        ];
      }
      
      // Filter by supplier
      if (supplier) {
        query.supplier = supplier;
      }
      
      // Filter by receipt status (Pending, Partial, Complete)
      if (status) {
        query.receiptStatus = status;
      }
      
      // Filter by PO number
      if (poNumber) {
        query.poNumber = { $regex: poNumber, $options: 'i' };
      }
      
      // Date range filter
      if (dateFrom || dateTo) {
        query.receiptDate = {};
        if (dateFrom) query.receiptDate.$gte = new Date(dateFrom);
        if (dateTo) query.receiptDate.$lte = new Date(dateTo);
      }
      
      const grns = await GoodsReceiptNote.find(query)
        .populate('supplier', 'companyName gstNumber')
        .populate({
          path: 'purchaseOrder',
          select: 'poNumber orderDate expectedDeliveryDate category items',
          populate: [
            {
              path: 'category',
              select: 'categoryName name'
            },
            {
              path: 'items.product',
              select: 'productName productCode category',
              populate: {
                path: 'category',
                select: 'categoryName name'
              }
            },
            {
              path: 'items.subProduct',
              select: 'name'
            }
          ]
        })
        .populate({
          path: 'items.product',
          select: 'productName productCode specifications category',
          populate: {
            path: 'category',
            select: 'categoryName name'
          }
        })
        .populate({
          path: 'items.subProduct',
          select: 'name'
        })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ createdAt: -1 });
      
      const total = await GoodsReceiptNote.countDocuments(query);
      
      res.status(200).json({
        success: true,
        data: grns,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
          limit: parseInt(limit)
        }
      });
    } catch (error) {
      console.error('Error fetching GRNs:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch GRNs',
        error: error.message
      });
    }
  };

  // Get GRN by ID
  export const getGRNById = async (req, res) => {
    try {
      const { id } = req.params;
      
      const grn = await GoodsReceiptNote.findById(id)
        .populate('supplier', 'companyName gstNumber')
        .populate('purchaseOrder', 'poNumber orderDate expectedDeliveryDate items')
        .populate('items.product', 'productName')
        .populate('items.subProduct', 'name');
      
      if (!grn) {
        return res.status(404).json({
          success: false,
          message: 'GRN not found'
        });
      }
      
      res.status(200).json({
        success: true,
        data: grn
      });
    } catch (error) {
      console.error('Error fetching GRN:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch GRN',
        error: error.message
      });
    }
  };

  // Create new GRN from Purchase Order
  // Uses MongoDB transactions for atomic operations ensuring data consistency
  export const createGRN = async (req, res) => {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();
      console.log('Creating GRN with data:', req.body);
      
      const {
        purchaseOrder: poId,
        receiptDate = new Date(),
        items,
        warehouseLocation,
        generalNotes,
        createdBy = 'System'
      } = req.body;
      
      // Validate and fetch Purchase Order (within transaction)
      const purchaseOrder = await PurchaseOrder.findById(poId)
        .populate('supplier')
        .populate('items.product')
        .session(session);
      console.log('purchaseOrder',purchaseOrder);
      if (!purchaseOrder) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Purchase Order not found'
        });
      }
      
      // Resolve warehouse location - if it's an ObjectId, fetch the warehouse name
      let resolvedWarehouseLocation = warehouseLocation;
      if (warehouseLocation && mongoose.Types.ObjectId.isValid(warehouseLocation)) {
        const WarehouseLocation = mongoose.model('WarehouseLocation');
        const warehouse = await WarehouseLocation.findById(warehouseLocation).session(session);
        if (warehouse) {
          resolvedWarehouseLocation = warehouse.name;
          console.log(`📍 Resolved warehouse ObjectId to name: ${resolvedWarehouseLocation}`);
        }
      }
      
      // PHASE 3-4 FIX: Comprehensive validation of all GRN items
      const validationResult = validateAllGRNItems(items, purchaseOrder.items);
      if (!validationResult.valid) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'GRN validation failed',
          errors: validationResult.errors
        });
      }
      console.log(`✅ All GRN items passed validation`);
      
      // Validate items against PO
      const validatedItems = [];
      for (const item of items) {
        // console.log('item',item);
        const poItem = purchaseOrder.items.find(pi => pi._id.toString() === item.purchaseOrderItem);
        console.log('poItem',poItem);
        if (!poItem) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: `Invalid PO item reference: ${item.purchaseOrderItem}`
          });
        }
        
        const product = await Product.findById(poItem.product).session(session);
        console.log('proudct detail description from a pO',product);
        if (!product) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: `Product not found: ${poItem.product}`
          });
        }
        
        // Get ordered weight from PO item (prefer explicit weight, fallback to specifications for legacy)
        const orderedWeight = poItem.weight || poItem.specifications?.weight || 0;
        console.log('orderWeight',orderedWeight);      // Calculate previously received (from PO's receivedQuantity, excluding this GRN)
        const previouslyReceived = poItem.receivedQuantity || 0;
        console.log("previouslyReceived",previouslyReceived)
        // Calculate previous weight
        // Sub-product weights from PO (ordered weights) and this GRN
        const orderedSubProductWeights = Array.isArray(poItem.subProductWeights)
          ? poItem.subProductWeights
          : [];
        const isSubProduct = Boolean(poItem.subProduct);
        const previousWeight = isSubProduct
          ? orderedSubProductWeights
              .slice(0, previouslyReceived)
              .reduce((sum, weight) => sum + (Number(weight) || 0), 0)
          : poItem.receivedWeight || 0;
        console.log('previousWeight',previousWeight);
        const receivedSubProductWeights = Array.isArray(item.receivedSubProductWeights)
          ? item.receivedSubProductWeights.slice(0, item.receivedQuantity)
          : isSubProduct
            ? orderedSubProductWeights.slice(
                previouslyReceived,
                previouslyReceived + item.receivedQuantity,
              )
            : [];
        
        // Calculate received weight for this GRN
        let receivedWeight = item.receivedWeight || 0;
        console.log('before receivedWeight',receivedWeight);
        if (receivedSubProductWeights.length > 0) {
          receivedWeight = receivedSubProductWeights.reduce((sum, w) => sum + (Number(w) || 0), 0);
        }
        
        console.log('after receivedWeight',receivedWeight);

        // Calculate pending
        const pendingQuantity = Math.max(0, poItem.quantity - (previouslyReceived + item.receivedQuantity));
        const pendingWeight = Math.max(0, orderedWeight - (previousWeight + receivedWeight));
        console.log('pendingQuantity',pendingQuantity);
        console.log('pendingWeight',pendingWeight);
        validatedItems.push({
          purchaseOrderItem: item.purchaseOrderItem,
          product: product._id,
          productName: product.productName,
          category: product.category || null,
          subProduct: poItem.subProduct || null,
          subProductName: poItem.subProductName || null,
          orderedQuantity: poItem.quantity,
          orderedWeight: orderedWeight,
          orderedSubProductWeights: orderedSubProductWeights,
          previouslyReceived: previouslyReceived,
          previousWeight: previousWeight,
          receivedQuantity: item.receivedQuantity,
          receivedWeight: receivedWeight,
          receivedSubProductWeights: receivedSubProductWeights,
          pendingQuantity: pendingQuantity,
          pendingWeight: pendingWeight,
          unit: poItem.unit || product.inventory?.unit || 'Bags',
          // Manual completion support
          manuallyCompleted: item.markAsComplete || false,
          completionReason: item.markAsComplete ? 'Marked as complete by user (losses/damages accepted)' : ''
        });
        
        // Log what we're storing
        console.log(`📝 GRN Item ${item.productName}:`, {
          markAsComplete: item.markAsComplete,
          manuallyCompleted: item.markAsComplete || false,
          receivedQuantity: item.receivedQuantity,
          orderedQuantity: item.orderedQuantity
        });
      }
      console.log('validateItem list',validatedItems);``
      // Calculate receipt status (consider manual completion)
      const allItemsComplete = validatedItems.every(item => 
        item.pendingQuantity === 0 || item.manuallyCompleted
      );
      const anyItemReceived = validatedItems.some(item => 
        item.receivedQuantity > 0 || item.manuallyCompleted
      );
      
      console.log(`📊 GRN Status Calculation:`);
      console.log(`   allItemsComplete: ${allItemsComplete}`);
      console.log(`   anyItemReceived: ${anyItemReceived}`);
      validatedItems.forEach(item => {
        console.log(`   - ${item.productName}: pending=${item.pendingQuantity}, manuallyCompleted=${item.manuallyCompleted}`);
      });
      
      let receiptStatus = 'Pending';
      if (allItemsComplete && anyItemReceived) {
        receiptStatus = 'Complete';
        console.log(`✅ GRN Status: Complete`);
      } else if (anyItemReceived) {
        receiptStatus = 'Partial';
        console.log(`⚠️  GRN Status: Partial`);
      } else {
        console.log(`ℹ️  GRN Status: Pending`);
      }
      
      
      
      // Create GRN
      // Set status based on receipt completion
      // Note: GRN status enum values are: Draft, Received, Partial, Complete
      const grnStatus = receiptStatus === 'Complete' ? 'Complete' : (anyItemReceived ? 'Received' : 'Draft');
      
      const grn = new GoodsReceiptNote({
        purchaseOrder: poId,
        poNumber: purchaseOrder.poNumber,
        supplier: purchaseOrder.supplier._id,
        supplierDetails: {
          companyName: purchaseOrder.supplier.companyName
        },
        receiptDate,
        items: validatedItems,
        warehouseLocation: resolvedWarehouseLocation,
        storageInstructions: req.body.storageInstructions || '',
        generalNotes,
        createdBy,
        receiptStatus,
        status: grnStatus
      });
      
      await grn.save({ session });
      
      // Update PO with received quantities and manual completion flags FIRST
      for (const grnItem of grn.items) {
        const poItem = purchaseOrder.items.find(pi => pi._id.toString() === grnItem.purchaseOrderItem.toString());
        if (poItem) {
          // Update received quantities
          poItem.receivedQuantity = (poItem.receivedQuantity || 0) + grnItem.receivedQuantity;
          poItem.receivedWeight = (poItem.receivedWeight || 0) + grnItem.receivedWeight;
          
          // Mark as manually completed if user checked the box (BEFORE updateReceiptStatus)
          if (grnItem.manuallyCompleted) {
            console.log(`✅ Marking PO item as manually completed: ${poItem.productName}`);
            poItem.manuallyCompleted = true;
            poItem.completionReason = grnItem.completionReason;
            poItem.completedAt = grnItem.completedAt;
          } else {
            console.log(`ℹ️  PO item NOT manually completed: ${poItem.productName}, flag: ${grnItem.manuallyCompleted}`);
          }
        }
      }
      
      // Update PO receipt status (this will calculate pending and status based on manuallyCompleted flag)
      await purchaseOrder.updateReceiptStatus();
      console.log(`📦 PO Status after update: ${purchaseOrder.status}`);
      console.log(`📦 PO Completion: ${purchaseOrder.completionPercentage}%`);
      console.log(`📦 PO Items:`, purchaseOrder.items.map(i => ({
        name: i.productName,
        status: i.receiptStatus,
        manuallyCompleted: i.manuallyCompleted,
        received: i.receivedQuantity,
        pending: i.pendingQuantity
      })));
      
      // Direct database update to force changes (bypass Mongoose save issues) - within transaction.
      // purchaseOrder was fetched with .populate('items.product'), so item.product is a full
      // Product document in memory - it must NEVER be written back as-is (that would embed a
      // whole document, including its own tenantId, in place of a plain ObjectId reference).
      // toPoItemWritePayload() rebuilds each item from explicit fields with references reduced
      // back to raw ObjectIds, so only real Product refs, never populated docs, reach the DB.
      await PurchaseOrder.updateOne(
        { _id: purchaseOrder._id },
        {
          $set: {
            status: purchaseOrder.status,
            completionPercentage: purchaseOrder.completionPercentage,
            items: purchaseOrder.items.map(toPoItemWritePayload)
          }
        },
        { session }
      );
      console.log(`💾 PO saved successfully (direct update)`);
      
      // Verify the save by re-fetching from database
      const verifyPO = await PurchaseOrder.findById(purchaseOrder._id).session(session);
      console.log(`🔍 Verification - PO from DB:`);
      console.log(`   Status: ${verifyPO.status}`);
      console.log(`   Items:`, verifyPO.items.map(i => ({
        name: i.productName,
        status: i.receiptStatus,
        manuallyCompleted: i.manuallyCompleted,
        received: i.receivedQuantity,
        pending: i.pendingQuantity
      })));
      
      // PHASE 4 FIX: Create inventory immediately for ALL received quantities
      // NOT just when item becomes complete
      // Each GRN creates inventory only for its own received quantity
      const inventoryLots = [];
      for (const item of grn.items) {
        // Create inventory for ANY received quantity, even if partial
        if (item.receivedQuantity > 0) {
          const product = await Product.findById(item.product).session(session);
          
          // Check if inventory already exists for this GRN, product, subProduct combination
          // This prevents duplicate inventory if the same GRN is processed twice
          const existingLot = await InventoryLot.findOne({
            grn: grn._id,
            product: item.product,
            subProduct: item.subProduct || null
          }).session(session);
          
          if (existingLot) {
            console.log(`⚠️  Inventory lot already exists for GRN ${grn.grnNumber}, product ${product.productName}. Skipping duplicate creation.`);
            inventoryLots.push(existingLot);
            continue;
          }
          
          // Create idempotency key to prevent duplicates
          const idempotencyKey = `${grn._id}-${item.product}-${item.subProduct || 'none'}`;
          
          // Resolve warehouse location
          const currentLotWarehouse = await resolveWarehouseName(
            grn.warehouseLocation || item.warehouseLocation || undefined,
            session
          );
          console.log(`📍 Warehouse for ${item.productName}: ${currentLotWarehouse}`);

          // PHASE 4 FIX: Create inventory immediately, even for partial GRN
          const lot = new InventoryLot({
            grn: grn._id,
            grnNumber: grn.grnNumber,
            purchaseOrder: grn.purchaseOrder,
            poNumber: grn.poNumber,
            product: item.product,
            productName: product.productName,
            subProduct: item.subProduct || null,
            subProductName: item.subProductName || null,
            subProductWeights: item.receivedSubProductWeights || [],
            category: product.category,
            supplier: grn.supplier,
            supplierName: grn.supplierDetails.companyName,
            supplierBatchNumber: item.batchNumber,
            specifications: item.specifications,
            receivedQuantity: item.receivedQuantity,
            currentQuantity: item.receivedQuantity,
            unit: item.unit,
            totalWeight: item.receivedWeight || 0,
            qualityStatus: 'Approved',
            qualityNotes: 'Auto-approved (Received via GRN)',
            warehouse: currentLotWarehouse,
            receivedDate: grn.receiptDate,
            expiryDate: item.expiryDate,
            unitCost: item.unitPrice,
            notes: `Received via GRN ${grn.grnNumber}`,
            createdBy: 'System',
            idempotencyKey: idempotencyKey
          });
          
          // Add initial movement record
          lot.movements.push({
            type: 'Received',
            quantity: item.receivedQuantity,
            weight: item.receivedWeight || 0,
            date: grn.receiptDate,
            reference: grn.grnNumber,
            notes: `Received via GRN ${grn.grnNumber}`,
            performedBy: createdBy || 'System'
          });
          
          await lot.save({ session });
          inventoryLots.push(lot);
          console.log(`📦 Created inventory lot for ${item.productName}: ${item.receivedQuantity} ${item.unit}`);
          console.log(`✅ Lot saved with warehouse: ${lot.warehouse} (LotNumber: ${lot.lotNumber})`);
          
          // Update product inventory
          await Product.findByIdAndUpdate(
            item.product,
            { $inc: { 'inventory.currentStock': item.receivedQuantity } },
            { session }
          );
        }
      }
      
      if (inventoryLots.length > 0) {
        console.log(`✅ Created ${inventoryLots.length} inventory lot(s) immediately for received quantities`);
      } else {
        console.log(`ℹ️  No inventory lots created (no received quantities)`);
      }
      
      // PHASE 8 FIX: Set inventoryCreated flag and store inventory lot IDs
      // This must happen INSIDE the transaction before commit
      // Only set to true if inventory was actually created
      if (inventoryLots.length > 0) {
        grn.inventoryCreated = true;
        grn.inventoryLots = inventoryLots.map(lot => lot._id);
        await grn.save({ session });
        console.log(`✅ Marked GRN as inventoryCreated=true with ${inventoryLots.length} lot(s)`);
      }
      
      // Commit the transaction - all operations succeeded
      await session.commitTransaction();
      console.log('✅ Transaction committed successfully');
      
      // Populate the saved GRN for response (outside transaction)
      const populatedGRN = await GoodsReceiptNote.findById(grn._id)
        .populate('supplier', 'companyName gstNumber')
        .populate('purchaseOrder', 'poNumber orderDate expectedDeliveryDate')
        .populate('items.product', 'productName')
        .populate('items.subProduct', 'name');
      
      res.status(201).json({
        success: true,
        message: 'GRN created successfully',
        data: populatedGRN
      });
    } catch (error) {
      // Abort transaction on any error
      await session.abortTransaction();
      console.error('❌ Transaction aborted - Error creating GRN:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create GRN',
        error: error.message
      });
    } finally {
      // Always end the session
      session.endSession();
    }
  };

  // Update GRN
  export const updateGRN = async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      const grn = await GoodsReceiptNote.findById(id);
      if (!grn) {
        return res.status(404).json({
          success: false,
          message: 'GRN not found'
        });
      }
      
      // PHASE 7-8 FIX: Comprehensive protection for inventory-affecting fields
      // Once inventory is created, these fields cannot be modified through any method
      if (grn.inventoryCreated) {
        const inventoryAffectingFields = [
          'items',
          'receivedQuantity',
          'receivedWeight',
          'receivedSubProductWeights',
          'product',
          'subProduct',
          'purchaseOrderItem',
          'orderedQuantity',
          'orderedWeight',
          'pendingQuantity',
          'pendingWeight',
          'orderedSubProductWeights'
        ];
        
        // Check top-level fields
        const updateKeys = Object.keys(updateData);
        const hasInventoryAffectingFields = updateKeys.some(key => inventoryAffectingFields.includes(key));
        
        if (hasInventoryAffectingFields) {
          return res.status(400).json({
            success: false,
            message: 'Cannot modify inventory-affecting fields after inventory has been created. Protected fields: ' + inventoryAffectingFields.join(', ') + '. Only notes and general information can be updated.'
          });
        }
        
        // PHASE 8 FIX: Check for MongoDB operators that could bypass protection
        // Prevent $set, $unset, $push, $pull, $addToSet, etc. on inventory-affecting fields
        const mongoOperators = ['$set', '$unset', '$push', '$pull', '$addToSet', '$pop', '$splice'];
        for (const operator of mongoOperators) {
          if (updateData[operator]) {
            const operatorFields = Object.keys(updateData[operator]);
            const affectedByOperator = operatorFields.some(field => {
              // Check if field or any nested path starts with an inventory-affecting field
              return inventoryAffectingFields.some(affectedField => 
                field === affectedField || field.startsWith(affectedField + '.')
              );
            });
            
            if (affectedByOperator) {
              return res.status(400).json({
                success: false,
                message: `Cannot use MongoDB operator ${operator} to modify inventory-affecting fields after inventory has been created.`
              });
            }
          }
        }
      }
      
      // Don't allow updating certain fields after completion
      if (grn.status === 'Completed') {
        const allowedFields = ['generalNotes', 'internalNotes', 'storageInstructions'];
        const updateKeys = Object.keys(updateData);
        const hasRestrictedFields = updateKeys.some(key => !allowedFields.includes(key));
        
        if (hasRestrictedFields) {
          return res.status(400).json({
            success: false,
            message: 'Cannot modify completed GRN. Only notes can be updated.'
          });
        }
      }
      
      const updatedGRN = await GoodsReceiptNote.findByIdAndUpdate(
        id,
        { ...updateData, lastModifiedBy: updateData.lastModifiedBy || 'System' },
        { new: true, runValidators: true }
      )
      .populate('supplier', 'companyName gstNumber')
      .populate('purchaseOrder', 'poNumber orderDate expectedDeliveryDate')
      .populate('items.product', 'productName')
      .populate('items.subProduct', 'name');
      
      res.status(200).json({
        success: true,
        message: 'GRN updated successfully',
        data: updatedGRN
      });
    } catch (error) {
      console.error('Error updating GRN:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update GRN',
        error: error.message
      });
    }
  };

  // Delete GRN
  export const deleteGRN = async (req, res) => {
    try {
      const { id } = req.params;
      
      const grn = await GoodsReceiptNote.findById(id);
      if (!grn) {
        return res.status(404).json({
          success: false,
          message: 'GRN not found'
        });
      }
      
      // Only allow deletion of Draft GRNs
      if (grn.status !== 'Draft') {
        return res.status(400).json({
          success: false,
          message: 'Only draft GRNs can be deleted'
        });
      }
      
      await GoodsReceiptNote.findByIdAndDelete(id);
      
      res.status(200).json({
        success: true,
        message: 'GRN deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting GRN:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete GRN',
        error: error.message
      });
    }
  };

  // Update GRN status
  export const updateGRNStatus = async (req, res) => {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;
      
      const validStatuses = ['Draft', 'Received', 'Under_Review', 'Approved', 'Rejected', 'Completed'];
      
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status'
        });
      }
      
      const updateData = { status };
      if (notes) updateData.generalNotes = notes;
      
      const updatedGRN = await GoodsReceiptNote.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      )
      .populate('supplier', 'companyName gstNumber');
      
      if (!updatedGRN) {
        return res.status(404).json({
          success: false,
          message: 'GRN not found'
        });
      }
      
      res.status(200).json({
        success: true,
        message: `GRN status updated to ${status}`,
        data: updatedGRN
      });
    } catch (error) {
      console.error('Error updating GRN status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update GRN status',
        error: error.message
      });
    }
  };

  // Get GRN statistics
  export const getGRNStats = async (req, res) => {
    try {
      const stats = await Promise.all([
        // Total GRNs
        GoodsReceiptNote.countDocuments(),
        
        // GRNs by receipt status (Pending, Partial, Complete)
        GoodsReceiptNote.aggregate([
          { $group: { _id: '$receiptStatus', count: { $sum: 1 } } }
        ]),
        
        // Pending GRNs (receiptStatus = Pending)
        GoodsReceiptNote.countDocuments({
          receiptStatus: 'Pending'
        }),
        
        // Completed GRNs (receiptStatus = Complete)
        GoodsReceiptNote.countDocuments({
          receiptStatus: 'Complete'
        }),
        
        // This month's GRNs
        GoodsReceiptNote.countDocuments({
          createdAt: {
            $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }),
        
        // Count of items received (current month)
        GoodsReceiptNote.aggregate([
          {
            $match: {
              createdAt: {
                $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
              }
            }
          },
          {
            $unwind: '$items'
          },
          {
            $group: {
              _id: null,
              totalQuantity: { $sum: '$items.receivedQuantity' }
            }
          }
        ])
      ]);
      
      const [totalGRNs, statusCounts, pendingCount, completedCount, thisMonth, monthlyQuantity] = stats;
      
      res.status(200).json({
        success: true,
        data: {
          totalGRNs,
          statusBreakdown: statusCounts,
          pending: pendingCount,
          completed: completedCount,
          thisMonth,
          monthlyQuantity: monthlyQuantity[0]?.totalQuantity || 0
        }
      });
    } catch (error) {
      console.error('Error fetching GRN stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch GRN statistics',
        error: error.message
      });
    }
  };

  // Get GRNs by Purchase Order
  export const getGRNsByPO = async (req, res) => {
    try {
      const { poId } = req.params;
      
      const grns = await GoodsReceiptNote.find({ purchaseOrder: poId })
        .populate('supplier', 'companyName gstNumber')
        .sort({ createdAt: -1 });
      
      res.status(200).json({
        success: true,
        data: grns
      });
    } catch (error) {
      console.error('Error fetching GRNs by PO:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch GRNs for Purchase Order',
        error: error.message
      });
    }
  };

  // ============ MANUAL COMPLETION CONTROLLER ============

  // Mark GRN item as manually completed (even if qty doesn't match)
  export const markItemAsComplete = async (req, res) => {
    try {
      const { grnId } = req.params;
      const { itemId, reason } = req.body;

      if (!itemId) {
        return res.status(400).json({
          success: false,
          message: 'Item ID is required'
        });
      }

      // Find the GRN
      const grn = await GoodsReceiptNote.findById(grnId);
      if (!grn) {
        return res.status(404).json({
          success: false,
          message: 'GRN not found'
        });
      }

      // Find the item in GRN
      const item = grn.items.id(itemId);
      if (!item) {
        return res.status(404).json({
          success: false,
          message: 'Item not found in GRN'
        });
      }

      // Mark as manually completed
      item.manuallyCompleted = true;
      item.completionReason = reason || 'Manually marked as complete';
      item.completedAt = new Date();

      // Save the GRN
      await grn.save();

      // Recalculate GRN receipt status
      const allItemsComplete = grn.items.every(item => {
        if (item.manuallyCompleted) return true;
        const pending = (item.orderedQuantity || 0) - ((item.previouslyReceived || 0) + item.receivedQuantity);
        return pending <= 0;
      });

      if (allItemsComplete) {
        grn.receiptStatus = 'Complete';
      } else {
        const anyReceived = grn.items.some(item => item.receivedQuantity > 0 || item.manuallyCompleted);
        grn.receiptStatus = anyReceived ? 'Partial' : 'Pending';
      }

      await grn.save();

      res.status(200).json({
        success: true,
        message: 'Item marked as complete',
        data: grn
      });
    } catch (error) {
      console.error('Error marking item as complete:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark item as complete',
        error: error.message
      });
    }
  };
