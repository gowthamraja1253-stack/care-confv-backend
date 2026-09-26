import asyncHandler from '../utils/asyncHandler.js';
import Medicine from '../models/Medicine.model.js';
import PharmacyStock from '../models/PharmacyStock.model.js';
import Facility from '../models/Facility.model.js';
import { calculateDistanceKm } from './facility.controller.js';
import mongoose from 'mongoose';

// Standard essential medicines catalog for reference / suggestions
export const defaultMedicinesCatalog = [
  {
    name: 'Paracetamol 650mg',
    genericName: 'Paracetamol / Acetaminophen',
    category: 'Fever & Pain Relief',
    dosageForm: 'Tablet',
    strength: '650 mg',
    manufacturer: 'Jan Aushadhi Scheme',
    subsidizedPrice: 12.0,
    mrp: 35.0,
    requiresPrescription: false,
    description: 'High strength antipyretic and analgesic for viral fever, headaches, body pain and cold.',
  },
  {
    name: 'Amoxicillin & Potassium Clavulanate 625mg',
    genericName: 'Amoxicillin (500mg) + Clavulanic Acid (125mg)',
    category: 'Antibiotics & Infection',
    dosageForm: 'Tablet',
    strength: '625 mg',
    manufacturer: 'Jan Aushadhi Generic',
    subsidizedPrice: 65.0,
    mrp: 180.0,
    requiresPrescription: true,
    description: 'Broad-spectrum antibiotic for bacterial respiratory, dental, skin and urinary tract infections.',
  },
  {
    name: 'Oral Rehydration Salts (ORS) Sachet',
    genericName: 'WHO Standard Oral Rehydration Formulation',
    category: 'First Aid & Antiseptics',
    dosageForm: 'Powder/Sachet',
    strength: '21.8 g Sachet',
    manufacturer: 'National Rural Health Mission (NRHM)',
    subsidizedPrice: 4.5,
    mrp: 22.0,
    requiresPrescription: false,
    description: 'Electrolyte replenishment powder for acute dehydration caused by diarrhea, vomiting and heat stroke.',
  },
  {
    name: 'Metformin Hydrochloride 500mg (SR)',
    genericName: 'Metformin HCl Sustained Release',
    category: 'Diabetes & Blood Sugar',
    dosageForm: 'Tablet',
    strength: '500 mg',
    manufacturer: 'Jan Aushadhi Kendra',
    subsidizedPrice: 18.0,
    mrp: 55.0,
    requiresPrescription: true,
    description: 'First-line medication for type 2 diabetes blood glucose regulation and glycemic control.',
  },
  {
    name: 'Cetirizine Hydrochloride 10mg',
    genericName: 'Cetirizine HCl',
    category: 'Respiratory & Cough',
    dosageForm: 'Tablet',
    strength: '10 mg',
    manufacturer: 'Jan Aushadhi Generic',
    subsidizedPrice: 8.0,
    mrp: 25.0,
    requiresPrescription: false,
    description: 'Non-drowsy antihistamine for allergy symptoms, runny nose, sneezing, hives and dust allergy.',
  },
  {
    name: 'Azithromycin 500mg',
    genericName: 'Azithromycin Dihydrate',
    category: 'Antibiotics & Infection',
    dosageForm: 'Tablet',
    strength: '500 mg',
    manufacturer: 'Jan Aushadhi Scheme',
    subsidizedPrice: 45.0,
    mrp: 125.0,
    requiresPrescription: true,
    description: 'Macrolide antibiotic 3-day course for throat infections, bronchitis, tonsillitis and pneumonia.',
  },
  {
    name: 'Amlodipine Besylate 5mg',
    genericName: 'Amlodipine Besylate',
    category: 'Blood Pressure & Heart',
    dosageForm: 'Tablet',
    strength: '5 mg',
    manufacturer: 'Jan Aushadhi Kendra',
    subsidizedPrice: 10.0,
    mrp: 38.0,
    requiresPrescription: true,
    description: 'Calcium channel blocker for hypertension and cardiovascular risk management.',
  },
  {
    name: 'Omeprazole 20mg Capsules',
    genericName: 'Omeprazole Magnesium',
    category: 'Gastro & Digestion',
    dosageForm: 'Capsule',
    strength: '20 mg',
    manufacturer: 'Jan Aushadhi Generic',
    subsidizedPrice: 14.0,
    mrp: 42.0,
    requiresPrescription: false,
    description: 'Proton pump inhibitor (PPI) for acid reflux, heartburn, gastritis and peptic ulcers.',
  },
  {
    name: 'Salbutamol / Albuterol 100mcg Inhaler',
    genericName: 'Salbutamol Sulfate Inhaler',
    category: 'Respiratory & Cough',
    dosageForm: 'Inhaler',
    strength: '100 mcg / dose (200 MDI doses)',
    manufacturer: 'Jan Aushadhi Scheme',
    subsidizedPrice: 85.0,
    mrp: 195.0,
    requiresPrescription: true,
    description: 'Rapid-acting bronchodilator for asthma attacks, wheezing, and COPD airway relief.',
  },
  {
    name: 'Povidone Iodine 5% Antiseptic Ointment',
    genericName: 'Povidone Iodine 5% w/w',
    category: 'First Aid & Antiseptics',
    dosageForm: 'Ointment',
    strength: '20 g Tube',
    manufacturer: 'Jan Aushadhi Generic',
    subsidizedPrice: 22.0,
    mrp: 65.0,
    requiresPrescription: false,
    description: 'Topical microbicidal ointment for wound dressing, cuts, burns, scrapes and preventing infection.',
  },
  {
    name: 'Insulin Glargine 100 IU/ml Cartridge',
    genericName: 'Recombinant Human Insulin Glargine',
    category: 'Diabetes & Blood Sugar',
    dosageForm: 'Injection',
    strength: '100 IU/ml (3 ml)',
    manufacturer: 'National Health Mission Subsidized',
    subsidizedPrice: 240.0,
    mrp: 650.0,
    requiresPrescription: true,
    description: 'Long-acting basal insulin analog for diabetes blood sugar management across 24 hours.',
  },
  {
    name: 'Vitamin D3 60,000 IU Chewable',
    genericName: 'Cholecalciferol (Vitamin D3)',
    category: 'Vitamins & Supplements',
    dosageForm: 'Tablet',
    strength: '60,000 IU',
    manufacturer: 'Jan Aushadhi Scheme',
    subsidizedPrice: 15.0,
    mrp: 45.0,
    requiresPrescription: false,
    description: 'Weekly high-potency vitamin D3 for bone strength, calcium absorption and fatigue relief.',
  },
];

// In-memory store for newly registered pharmacies and live stock when DB is not ready
export const activeDynamicStocks = [];

/**
 * @desc    Get / Search all medicines catalog
 * @route   GET /api/medicines
 * @access  Public
 */
export const searchMedicines = asyncHandler(async (req, res) => {
  const { search = '', category = 'all', limit = 50 } = req.query;

  let medicines = [];

  if (mongoose.connection.readyState === 1) {
    try {
      const query = {};
      if (category && category !== 'all') {
        query.category = category;
      }
      if (search && search.trim()) {
        const regex = new RegExp(search.trim(), 'i');
        query.$or = [{ name: regex }, { genericName: regex }, { description: regex }];
      }
      medicines = await Medicine.find(query).limit(Number(limit)).lean();
    } catch (err) {
      console.warn('[Medicine] DB search error:', err.message);
    }
  }

  if (!medicines || medicines.length === 0) {
    let list = [...defaultMedicinesCatalog];
    if (category && category !== 'all') {
      list = list.filter((m) => m.category.toLowerCase() === category.toLowerCase());
    }
    if (search && search.trim()) {
      const s = search.trim().toLowerCase();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(s) ||
          m.genericName.toLowerCase().includes(s) ||
          m.description.toLowerCase().includes(s)
      );
    }
    medicines = list.slice(0, Number(limit));
  }

  res.status(200).json({
    success: true,
    count: medicines.length,
    medicines,
  });
});

/**
 * @desc    Find nearby DIRECT registered pharmacies having a medicine in stock (sorted by distance)
 * @route   GET /api/medicines/nearby-stock
 * @access  Public
 */
export const getNearbyStock = asyncHandler(async (req, res) => {
  const { medicine = '', medicineName = '', lat, lng, radius = 50 } = req.query;
  const searchTerm = (medicine || medicineName || '').trim();

  const userLat = lat ? parseFloat(lat) : 28.8031;
  const userLng = lng ? parseFloat(lng) : 79.0252;

  // 1. Fetch only REAL registered pharmacy facilities from the database
  let pharmacies = [];
  if (mongoose.connection.readyState === 1) {
    try {
      pharmacies = await Facility.find({ type: 'pharmacy' }).lean();
    } catch (err) {
      console.warn('[Medicine] DB facility lookup error:', err.message);
    }
  }

  const pharmacyMap = new Map();
  pharmacies.forEach((p) => {
    pharmacyMap.set(String(p._id), p);
  });

  // 2. Fetch live stock records from MongoDB
  let liveStocks = [];
  if (mongoose.connection.readyState === 1) {
    try {
      const stockQuery = { inStock: true, quantity: { $gt: 0 } };
      if (searchTerm) {
        stockQuery.medicineName = new RegExp(searchTerm, 'i');
      }
      liveStocks = await PharmacyStock.find(stockQuery).sort({ lastUpdated: -1 }).lean();
    } catch (err) {
      console.warn('[Medicine] DB stock search error:', err.message);
    }
  }

  // Include dynamic in-memory stock entries ONLY if DB is empty or disconnected
  if ((!liveStocks || liveStocks.length === 0) && activeDynamicStocks.length > 0) {
    const memFiltered = activeDynamicStocks.filter((s) => {
      if (!s.inStock || s.quantity <= 0) return false;
      if (!searchTerm) return true;
      return s.medicineName.toLowerCase().includes(searchTerm.toLowerCase());
    });
    liveStocks = memFiltered;
  }

  // 3. Map stock entries ONLY to genuine registered pharmacies & strictly deduplicate
  const results = [];
  const seenShopMedKeys = new Set();

  for (const item of liveStocks) {
    const pharmacyIdStr = String(item.pharmacyId);
    const pharmacy = pharmacyMap.get(pharmacyIdStr);

    // Only include stock from actual registered pharmacies that exist
    if (!pharmacy) {
      continue;
    }

    // Deduplicate by normalized shop name + medicine name to guarantee no duplicate cards
    const shopIdentifier = (pharmacy.name || pharmacyIdStr).trim().toLowerCase();
    const medIdentifier = (item.medicineName || '').trim().toLowerCase();
    const uniqueKey = `${shopIdentifier}___${medIdentifier}`;

    if (seenShopMedKeys.has(uniqueKey)) {
      continue;
    }
    seenShopMedKeys.add(uniqueKey);

    let distanceKm = 0.8;
    if (pharmacy.location && pharmacy.location.lat !== undefined && pharmacy.location.lng !== undefined && userLat !== null && userLng !== null) {
      const dist = calculateDistanceKm(userLat, userLng, Number(pharmacy.location.lat), Number(pharmacy.location.lng));
      distanceKm = dist !== null ? dist : 0.8;
    }

    results.push({
      _id: item._id,
      medicineName: item.medicineName,
      inStock: item.inStock,
      quantity: item.quantity,
      price: item.price,
      batchNumber: item.batchNumber,
      lastUpdated: item.lastUpdated,
      distanceKm,
      pharmacy: {
        _id: pharmacy._id,
        name: pharmacy.name,
        type: pharmacy.type || 'pharmacy',
        address: pharmacy.address,
        phone: pharmacy.phone,
        hours: pharmacy.hours,
        location: pharmacy.location,
        isGovernmentVerified: pharmacy.isGovernmentVerified ?? true,
        rating: pharmacy.rating || 4.9,
      },
    });
  }

  // Sort ascending by distance (nearest medical center first)
  results.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));

  res.status(200).json({
    success: true,
    count: results.length,
    searchTerm,
    userLocation: { lat: userLat, lng: userLng },
    results,
  });
});

/**
 * @desc    Get stock inventory for a pharmacy facility or all
 * @route   GET /api/medicines/stock
 * @access  Public / Private
 */
export const getPharmacyStock = asyncHandler(async (req, res) => {
  const { pharmacyId } = req.query;

  let stocks = [];

  if (mongoose.connection.readyState === 1) {
    try {
      const query = {};
      if (pharmacyId && pharmacyId !== 'all') {
        query.pharmacyId = pharmacyId;
      }
      stocks = await PharmacyStock.find(query).sort({ lastUpdated: -1 }).lean();
    } catch (err) {
      console.warn('[Medicine] DB stock get error:', err.message);
    }
  }

  if ((!stocks || stocks.length === 0) && activeDynamicStocks.length > 0) {
    const memList = pharmacyId && pharmacyId !== 'all'
      ? activeDynamicStocks.filter((s) => String(s.pharmacyId) === String(pharmacyId))
      : activeDynamicStocks;
    stocks = memList;
  }

  res.status(200).json({
    success: true,
    count: stocks.length,
    stocks,
  });
});

/**
 * @desc    Get stock inventory belonging to the currently logged in pharmacy user
 * @route   GET /api/medicines/my-stock
 * @access  Private (Pharmacy / Admin)
 */
export const getMyPharmacyStock = asyncHandler(async (req, res) => {
  const user = req.user;

  // 1. Resolve facility associated with this user
  let facilityId = user.facilityId;
  let facility = null;

  if (facilityId && mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(facilityId)) {
    try {
      facility = await Facility.findById(facilityId).lean();
    } catch (e) {
      console.warn('[Medicine] Facility findById error:', e.message);
    }
  }

  if (!facility && mongoose.connection.readyState === 1) {
    try {
      facility = await Facility.findOne({ userId: user._id }).lean();
      if (!facility && user.facilityName) {
        facility = await Facility.findOne({ name: user.facilityName }).lean();
      }
      if (facility) {
        facilityId = facility._id;
        await User.findByIdAndUpdate(user._id, { facilityId: facility._id });
      }
    } catch (e) {
      console.warn('[Medicine] Facility findOne error:', e.message);
    }
  }

  // If still no facility exists and user is pharmacy, auto-create one
  if (!facility && user.role === 'pharmacy' && mongoose.connection.readyState === 1) {
    try {
      facility = await Facility.create({
        name: user.facilityName || `${user.name} Medical Store`,
        type: 'pharmacy',
        location: user.facilityLocation || { lat: 28.805, lng: 79.028 },
        address: user.facilityAddress || user.village || 'Rampur Village',
        phone: user.facilityPhone || user.phone || '+91 98765 20003',
        hours: user.facilityHours || '08:00 AM - 09:30 PM (Daily)',
        isGovernmentVerified: true,
        isRegisteredCenter: true,
        userId: user._id,
      });
      facilityId = facility._id;
      await User.findByIdAndUpdate(user._id, { facilityId: facility._id });
    } catch (e) {
      console.warn('[Medicine] Facility auto-create error:', e.message);
    }
  }

  // 2. Query MongoDB with multi-condition matching (facilityId, String ID, or updatedBy user)
  let stocks = [];
  if (mongoose.connection.readyState === 1) {
    try {
      const matchConditions = [{ updatedBy: user._id }];
      if (facilityId) {
        matchConditions.push({ pharmacyId: facilityId });
        matchConditions.push({ pharmacyId: String(facilityId) });
      }
      if (facility?._id) {
        matchConditions.push({ pharmacyId: facility._id });
        matchConditions.push({ pharmacyId: String(facility._id) });
      }
      stocks = await PharmacyStock.find({ $or: matchConditions }).sort({ lastUpdated: -1 }).lean();
    } catch (err) {
      console.warn('[Medicine] DB my-stock get error:', err.message);
    }
  }

  // 3. Fallback to memory store if DB query returned nothing
  if ((!stocks || stocks.length === 0) && activeDynamicStocks.length > 0) {
    const memStocks = activeDynamicStocks.filter(
      (s) =>
        (facilityId && String(s.pharmacyId) === String(facilityId)) ||
        (user._id && String(s.updatedBy) === String(user._id))
    );
    stocks = memStocks;
  }

  // 4. Deduplicate items by normalized medicineName (keep latest)
  const uniqueMap = new Map();
  for (const s of stocks) {
    const norm = (s.medicineName || '').trim().toLowerCase();
    if (!uniqueMap.has(norm)) {
      uniqueMap.set(norm, s);
    }
  }
  const deduplicatedStocks = Array.from(uniqueMap.values());

  res.status(200).json({
    success: true,
    facilityId: facilityId || facility?._id || null,
    facility,
    count: deduplicatedStocks.length,
    stocks: deduplicatedStocks,
  });
});

/**
 * @desc    Create or update stock status directly for a healthcare center
 * @route   POST /api/medicines/stock
 * @access  Private (Admin / Pharmacy)
 */
export const updatePharmacyStock = asyncHandler(async (req, res) => {
  let { pharmacyId, medicineName, inStock, quantity, price, batchNumber } = req.body;

  // If no pharmacyId is passed in the body, automatically resolve the logged in user's facility
  if (!pharmacyId && req.user) {
    pharmacyId = req.user.facilityId;
    if (!pharmacyId && mongoose.connection.readyState === 1) {
      let fac = await Facility.findOne({ userId: req.user._id });
      if (!fac && req.user.facilityName) {
        fac = await Facility.findOne({ name: req.user.facilityName });
      }
      if (!fac && req.user.role === 'pharmacy') {
        fac = await Facility.create({
          name: req.user.facilityName || `${req.user.name} Medical Store`,
          type: 'pharmacy',
          location: req.user.facilityLocation || { lat: 28.805, lng: 79.028 },
          address: req.user.facilityAddress || req.user.village || 'Rampur Village',
          phone: req.user.facilityPhone || req.user.phone || '+91 98765 20003',
          hours: req.user.facilityHours || '08:00 AM - 09:30 PM (Daily)',
          isGovernmentVerified: true,
          isRegisteredCenter: true,
          userId: req.user._id,
        });
      }
      if (fac) {
        pharmacyId = fac._id;
        req.user.facilityId = fac._id;
        await User.findByIdAndUpdate(req.user._id, { facilityId: fac._id });
      }
    }
  }

  if (!pharmacyId || !medicineName) {
    return res.status(400).json({
      success: false,
      message: 'Please provide pharmacy center ID and medicine name',
    });
  }

  const inStockBool = typeof inStock === 'boolean' ? inStock : String(inStock).toLowerCase() === 'true';
  const qty = quantity !== undefined ? Math.max(0, parseInt(quantity, 10)) : inStockBool ? 10 : 0;
  const itemPrice = price !== undefined ? parseFloat(price) : 15.0;

  let updatedRecord = null;

  if (mongoose.connection.readyState === 1) {
    try {
      // Find and update or create by matching pharmacyId/updatedBy + normalized medicineName
      const filter = {
        medicineName: new RegExp(`^${medicineName.trim()}$`, 'i'),
        $or: [
          { pharmacyId },
          { pharmacyId: String(pharmacyId) },
          ...(req.user?._id ? [{ updatedBy: req.user._id }] : []),
        ],
      };

      updatedRecord = await PharmacyStock.findOneAndUpdate(
        filter,
        {
          pharmacyId,
          medicineName: medicineName.trim(),
          inStock: inStockBool,
          quantity: qty,
          price: itemPrice,
          batchNumber: batchNumber || 'BATCH-STD',
          lastUpdated: new Date(),
          updatedBy: req.user?._id || null,
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    } catch (err) {
      console.warn('[Medicine] DB updatePharmacyStock error:', err.message);
    }
  }

  // Also maintain in dynamic memory store
  const existingIdx = activeDynamicStocks.findIndex(
    (s) =>
      (String(s.pharmacyId) === String(pharmacyId) || (req.user?._id && String(s.updatedBy) === String(req.user._id))) &&
      s.medicineName.toLowerCase() === medicineName.trim().toLowerCase()
  );

  const memRecord = {
    _id: updatedRecord?._id ? String(updatedRecord._id) : `stock-mem-${Date.now()}`,
    pharmacyId: String(pharmacyId),
    medicineName: medicineName.trim(),
    inStock: inStockBool,
    quantity: qty,
    price: itemPrice,
    batchNumber: batchNumber || 'BATCH-STD',
    lastUpdated: new Date(),
    updatedBy: req.user?._id ? String(req.user._id) : null,
  };

  if (existingIdx >= 0) {
    activeDynamicStocks[existingIdx] = memRecord;
  } else {
    activeDynamicStocks.unshift(memRecord);
  }

  res.status(200).json({
    success: true,
    message: `Successfully updated stock for ${medicineName}`,
    stock: updatedRecord || memRecord,
  });
});

/**
 * @desc    Delete a stock item from center inventory
 * @route   DELETE /api/medicines/stock/:id
 * @access  Private (Admin / Pharmacy)
 */
export const deletePharmacyStock = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(id)) {
    try {
      await PharmacyStock.findByIdAndDelete(id);
    } catch (err) {
      console.warn('[Medicine] DB delete stock error:', err.message);
    }
  }

  const idx = activeDynamicStocks.findIndex((s) => String(s._id) === String(id));
  if (idx >= 0) {
    activeDynamicStocks.splice(idx, 1);
  }

  res.status(200).json({
    success: true,
    message: 'Stock item deleted successfully',
  });
});

/**
 * @desc    Seed base medicines catalog
 * @route   POST /api/medicines/seed
 * @access  Private / Admin / Public
 */
export const seedMedicinesAndStock = asyncHandler(async (req, res) => {
  if (mongoose.connection.readyState === 1) {
    const medCount = await Medicine.countDocuments();
    if (medCount === 0) {
      await Medicine.insertMany(defaultMedicinesCatalog);
    }

    return res.status(201).json({
      success: true,
      message: 'Medicines catalog verified',
      medicineCount: await Medicine.countDocuments(),
    });
  }

  res.status(200).json({
    success: true,
    message: 'Operating in dynamic mode',
    medicineCount: defaultMedicinesCatalog.length,
  });
});

export default {
  searchMedicines,
  getNearbyStock,
  getPharmacyStock,
  getMyPharmacyStock,
  updatePharmacyStock,
  deletePharmacyStock,
  seedMedicinesAndStock,
};
