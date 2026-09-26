import asyncHandler from '../utils/asyncHandler.js';
import Facility from '../models/Facility.model.js';
import mongoose from 'mongoose';

// Haversine Distance Formula in Kilometers
export const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) {
    return null;
  }
  const R = 6371; // Radius of the Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 10) / 10; // 1 decimal place (e.g. 1.8 km)
};

// Curated Seed Sample Facilities for Pan-India & Rural Grids
export const inMemoryFacilities = [
  {
    _id: 'fac-001',
    name: 'Rampur Primary Health Centre (PHC)',
    type: 'primary-health-centre',
    location: { lat: 28.8075, lng: 79.031 },
    address: 'Main Road, Near Panchayat Bhavan, Rampur Village',
    phone: '+91 98765 20001',
    hours: 'Open 24x7 Emergency',
    rating: 4.8,
    services: [
      '24x7 Emergency Care',
      'Doctor Teleconsultation Kiosk',
      'Free Immunization',
      'Maternity & Labor Room',
      'Basic Blood & Urine Testing',
    ],
    isGovernmentVerified: true,
    emergencyContact: '108',
    bedsAvailable: 8,
    doctorsCount: 3,
    genericMedicineStock: true,
  },
  {
    _id: 'fac-002',
    name: 'District Community Multi-Speciality Hospital',
    type: 'government-hospital',
    location: { lat: 28.818, lng: 79.018 },
    address: 'Civil Lines Road, District Medical Complex, Rampur',
    phone: '+91 98765 20002',
    hours: 'Open 24x7 Emergency & Trauma',
    rating: 4.9,
    services: [
      '24x7 ICU & Trauma Ward',
      'Cardiology & Surgery',
      'Digital X-Ray & Ultrasound',
      'Government Blood Bank',
      'Ayushman Bharat Dedicated Desk',
    ],
    isGovernmentVerified: true,
    emergencyContact: '108 / 102',
    bedsAvailable: 64,
    doctorsCount: 18,
    genericMedicineStock: true,
  },
  {
    _id: 'fac-003',
    name: 'Pradhan Mantri Jan Aushadhi Generic Kendra #104',
    type: 'pharmacy',
    location: { lat: 28.805, lng: 79.028 },
    address: 'Shop 4, Market Square, Opp. Bus Stand, Rampur',
    phone: '+91 98765 20003',
    hours: '08:00 AM - 09:30 PM (Daily)',
    rating: 4.85,
    services: [
      '90% Affordable Generic Medicines',
      'Essential Antibiotics & Fever Syrups',
      'Insulin & Diabetic Care Supplies',
      'Blood Pressure / Sugar Test Strips',
      'Digital E-Prescription Dispensing',
    ],
    isGovernmentVerified: true,
    emergencyContact: '+91 98765 20003',
    bedsAvailable: 0,
    doctorsCount: 1,
    genericMedicineStock: true,
  },
  {
    _id: 'fac-004',
    name: 'Ayushman Bharat Health & Wellness Clinic',
    type: 'clinic',
    location: { lat: 28.812, lng: 79.022 },
    address: 'Community Center, Sector 2, Rampur Sub-Grid',
    phone: '+91 98765 20004',
    hours: '08:30 AM - 05:30 PM (Mon-Sat)',
    rating: 4.75,
    services: [
      'NCD Screening (Diabetes / Hypertension)',
      'Telemedicine Remote Specialist Connect',
      'Women & Child Nutritional Counseling',
      'Ayush & Yoga Wellness Counter',
    ],
    isGovernmentVerified: true,
    emergencyContact: '108',
    bedsAvailable: 4,
    doctorsCount: 2,
    genericMedicineStock: true,
  },
  {
    _id: 'fac-005',
    name: 'Taluk Government General Hospital',
    type: 'government-hospital',
    location: { lat: 28.775, lng: 79.055 },
    address: 'Station Road, Taluk Health HQ, Bhimpur Sub-Division',
    phone: '+91 98765 20005',
    hours: 'Open 24x7 Emergency',
    rating: 4.7,
    services: [
      'General Surgery & Orthopedics',
      'Pediatric Care Ward',
      'Ambulance 108 Base Station',
      'Free Diagnostic Lab',
    ],
    isGovernmentVerified: true,
    emergencyContact: '108',
    bedsAvailable: 35,
    doctorsCount: 8,
    genericMedicineStock: true,
  },
  {
    _id: 'fac-006',
    name: 'Bhimpur Community Health Unit',
    type: 'primary-health-centre',
    location: { lat: 28.825, lng: 79.048 },
    address: 'Bhimpur Block 3, Near Village Water Tank',
    phone: '+91 98765 20006',
    hours: '08:00 AM - 08:00 PM (Emergency 24x7 on-call)',
    rating: 4.65,
    services: [
      'Primary Doctor Consultation',
      'Rapid Dengue & Malaria Testing',
      'Wound Dressing & Minor Trauma',
      'Free Government Medicine Stock',
    ],
    isGovernmentVerified: true,
    emergencyContact: '108',
    bedsAvailable: 6,
    doctorsCount: 2,
    genericMedicineStock: true,
  },
  {
    _id: 'fac-007',
    name: 'Rampur Village Cooperative Pharmacy',
    type: 'pharmacy',
    location: { lat: 28.814, lng: 79.036 },
    address: 'Plot 12, Cooperative Society Road, Rampur',
    phone: '+91 98765 20007',
    hours: '07:30 AM - 10:00 PM',
    rating: 4.9,
    services: [
      'Prescription Drug Dispensing',
      'First Aid & Bandages',
      'Pediatric Syrups & ORS Packets',
      'Home Delivery for Elderly Patients',
    ],
    isGovernmentVerified: true,
    emergencyContact: '+91 98765 20007',
    bedsAvailable: 0,
    doctorsCount: 1,
    genericMedicineStock: true,
  },
  {
    _id: 'fac-008',
    name: 'Maternal & Child Wellness Clinic',
    type: 'clinic',
    location: { lat: 28.799, lng: 79.041 },
    address: 'Women Wellness Bhavan, Anganwadi Complex, Kalyanpur',
    phone: '+91 98765 20008',
    hours: '09:00 AM - 04:30 PM (Mon-Sat)',
    rating: 4.8,
    services: [
      'Antenatal Care (ANC) Checks',
      'Infant Weight & Growth Tracking',
      'Folic Acid & Iron Supplements',
      'Lactation & Newborn Counseling',
    ],
    isGovernmentVerified: true,
    emergencyContact: '102',
    bedsAvailable: 3,
    doctorsCount: 2,
    genericMedicineStock: true,
  },
];

/**
 * @desc    Get all healthcare facilities with GPS proximity distance sorting
 * @route   GET /api/facilities
 * @access  Public / Private
 */
export const getNearbyFacilities = asyncHandler(async (req, res) => {
  const { lat, lng, type, search, radius = 50 } = req.query;

  const userLat = lat ? parseFloat(lat) : null;
  const userLng = lng ? parseFloat(lng) : null;

  let facilities = [];

  if (mongoose.connection.readyState === 1) {
    try {
      const query = {};
      if (type && type !== 'all' && type !== 'All') {
        query.type = type;
      }
      if (search && search.trim()) {
        const regex = new RegExp(search.trim(), 'i');
        query.$or = [{ name: regex }, { address: regex }, { services: regex }];
      }

      facilities = await Facility.find(query).lean();
    } catch (err) {
      console.warn('[Facility] DB find error, using in-memory store:', err.message);
    }
  }

  if (!facilities || facilities.length === 0) {
    let list = [...inMemoryFacilities];
    if (type && type !== 'all' && type !== 'All') {
      list = list.filter((f) => f.type === type);
    }
    if (search && search.trim()) {
      const s = search.trim().toLowerCase();
      list = list.filter(
        (f) =>
          f.name.toLowerCase().includes(s) ||
          f.address.toLowerCase().includes(s) ||
          f.services.some((srv) => srv.toLowerCase().includes(s))
      );
    }
    facilities = list;
  }

  // Calculate distance from user's GPS coordinates if provided
  const facilitiesWithDistance = facilities.map((fac) => {
    let distanceKm = null;
    if (userLat !== null && userLng !== null && fac.location) {
      distanceKm = calculateDistanceKm(userLat, userLng, fac.location.lat, fac.location.lng);
    }
    return {
      ...fac,
      distanceKm: distanceKm !== null ? distanceKm : 1.5, // Default realistic relative proximity if GPS inactive
    };
  });

  // Sort ascending by distance
  facilitiesWithDistance.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));

  // Category summary counts
  const allList = inMemoryFacilities;
  const counts = {
    all: allList.length,
    'primary-health-centre': allList.filter((f) => f.type === 'primary-health-centre').length,
    'government-hospital': allList.filter((f) => f.type === 'government-hospital').length,
    clinic: allList.filter((f) => f.type === 'clinic').length,
    pharmacy: allList.filter((f) => f.type === 'pharmacy').length,
  };

  res.status(200).json({
    success: true,
    count: facilitiesWithDistance.length,
    counts,
    userLocation: userLat !== null && userLng !== null ? { lat: userLat, lng: userLng } : null,
    facilities: facilitiesWithDistance,
  });
});

/**
 * @desc    Get single facility details
 * @route   GET /api/facilities/:id
 * @access  Public / Private
 */
export const getFacilityById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  let facility = null;

  if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(id)) {
    try {
      facility = await Facility.findById(id);
    } catch (err) {
      console.warn('[Facility] DB get by id error:', err.message);
    }
  }

  if (!facility) {
    facility = inMemoryFacilities.find((f) => f._id === id || f.id === id);
  }

  if (!facility) {
    return res.status(404).json({
      success: false,
      message: 'Healthcare facility not found',
    });
  }

  res.status(200).json({
    success: true,
    facility,
  });
});

/**
 * @desc    Seed sample facilities into database if empty
 * @route   POST /api/facilities/seed
 * @access  Private / Public
 */
export const seedFacilities = asyncHandler(async (req, res) => {
  if (mongoose.connection.readyState === 1) {
    const count = await Facility.countDocuments();
    if (count === 0) {
      await Facility.insertMany(
        inMemoryFacilities.map((f) => {
          const { _id, ...rest } = f;
          return rest;
        })
      );
      return res.status(201).json({
        success: true,
        message: 'Sample facilities seeded into database',
      });
    }
    return res.status(200).json({
      success: true,
      message: 'Database already has facilities data',
      count,
    });
  }

  res.status(200).json({
    success: true,
    message: 'Running in in-memory mode',
    count: inMemoryFacilities.length,
  });
});

export default {
  getNearbyFacilities,
  getFacilityById,
  seedFacilities,
  calculateDistanceKm,
};
