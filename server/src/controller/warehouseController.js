import WarehouseLocation from '../models/WarehouseLocation.js';
import { requireTenantId } from '../saas/tenantContext.js';

// Cache for warehouse name lookups (invalidated on any mutation)
const warehouseCaches = new Map();
export async function resolveWarehouseName(idOrName) {
  const tenant = String(requireTenantId());
  if (!idOrName) return '';
  let cache = warehouseCaches.get(tenant);
  if (!cache || cache.expiresAt < Date.now()) {
    const all = await WarehouseLocation.find().lean();
    cache = { names: new Map(), expiresAt: Date.now() + 30000 };
    all.forEach(w => { cache.names.set(String(w._id), w.name); cache.names.set(w.name, w.name); });
    if (warehouseCaches.size >= 500) warehouseCaches.delete(warehouseCaches.keys().next().value);
    warehouseCaches.set(tenant, cache);
  }
  return cache.names.get(String(idOrName)) || '';
}
export function clearWarehouseCache() { warehouseCaches.delete(String(requireTenantId())); }

export const getAll = async (req, res) => {
  try {
    const { includeInactive } = req.query;
    const filter = includeInactive === 'true' ? {} : { isActive: true };
    const locations = await WarehouseLocation.find(filter).sort({ name: 1 });
    return res.json({ success: true, data: locations });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const create = async (req, res) => {
  try {
    const { name, code, type, address } = req.body;
    if (!name || !code) return res.status(400).json({ success: false, message: 'name and code are required' });
    const exists = await WarehouseLocation.findOne({ code: code.toUpperCase().trim() });
    if (exists) return res.status(409).json({ success: false, message: 'Location code already exists' });
    const loc = await WarehouseLocation.create({ name, code, type, address });
    clearWarehouseCache();
    return res.status(201).json({ success: true, data: loc });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, type, address, isActive } = req.body;
    if (code) {
      const exists = await WarehouseLocation.findOne({ code: code.toUpperCase().trim(), _id: { $ne: id } });
      if (exists) return res.status(409).json({ success: false, message: 'Location code already exists' });
    }
    const loc = await WarehouseLocation.findByIdAndUpdate(
      id,
      { name, code, type, address, isActive },
      { new: true, runValidators: true }
    );
    if (!loc) return res.status(404).json({ success: false, message: 'Location not found' });
    clearWarehouseCache();
    return res.json({ success: true, data: loc });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const remove = async (req, res) => {
  try {
    const loc = await WarehouseLocation.findByIdAndDelete(req.params.id);
    if (!loc) return res.status(404).json({ success: false, message: 'Location not found' });
    clearWarehouseCache();
    return res.json({ success: true, message: 'Location deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
