import User from '../models/User.model.js';
import Facility from '../models/Facility.model.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
export const register = asyncHandler(async (req, res) => {
  const {
    name,
    identifier,
    phone,
    email,
    password,
    role,
    village,
    preferredLanguage,
    age,
    gender,
    chronicFlags,
    specialization,
    licenseId,
    availability,
    designation,
    facilityName,
    facilityAddress,
    facilityPhone,
    facilityHours,
    facilityLocation,
  } = req.body;

  const rawIdentifier = identifier || phone || email;

  if (!name || !rawIdentifier || !password) {
    return res.status(400).json({
      success: false,
      message: 'Please provide name, phone/email, and password',
    });
  }

  const normalizedIdentifier = rawIdentifier.trim().toLowerCase();

  const userExists = await User.findOne({ identifier: normalizedIdentifier });
  if (userExists) {
    return res.status(400).json({
      success: false,
      message: 'An account with this phone number or email already exists',
    });
  }

  const isEmail = normalizedIdentifier.includes('@');
  const userPhone = phone || (!isEmail ? normalizedIdentifier : undefined);
  const userEmail = email || (isEmail ? normalizedIdentifier : undefined);

  const user = await User.create({
    name: name.trim(),
    identifier: normalizedIdentifier,
    phone: userPhone,
    email: userEmail,
    passwordHash: password,
    role: role || 'patient',
    village: village ? village.trim() : 'Rampur Village',
    preferredLanguage: preferredLanguage || 'Hindi',
    age: age !== undefined ? Number(age) : 35,
    gender: gender || 'Male',
    chronicFlags: Array.isArray(chronicFlags) ? chronicFlags : [],
    specialization: specialization || 'General Physician',
    licenseId: licenseId || '',
    availability: Array.isArray(availability)
      ? availability
      : ['Mon - Fri: 09:00 AM - 01:00 PM', 'Mon - Fri: 04:00 PM - 07:00 PM'],
    availabilitySlots: Array.isArray(req.body.availabilitySlots)
      ? req.body.availabilitySlots
      : undefined,
    designation: designation || 'Primary Health Center Officer',
    facilityName: facilityName ? facilityName.trim() : (role === 'pharmacy' ? `${name.trim()} Medical Store` : ''),
    facilityAddress: facilityAddress ? facilityAddress.trim() : (village ? village.trim() : ''),
    facilityPhone: facilityPhone ? facilityPhone.trim() : (userPhone || ''),
    facilityHours: facilityHours ? facilityHours.trim() : '08:00 AM - 09:30 PM (Daily)',
    facilityLocation: facilityLocation && facilityLocation.lat && facilityLocation.lng
      ? { lat: Number(facilityLocation.lat), lng: Number(facilityLocation.lng) }
      : { lat: 28.805, lng: 79.028 },
  });

  // If registered as a Pharmacy / Healthcare Center, automatically create real Facility record
  if (user.role === 'pharmacy') {
    const realFacility = await Facility.create({
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

    user.facilityId = realFacility._id;
    await user.save();
  }

  const token = user.generateAuthToken();

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    token,
    user,
  });
});

/**
 * @desc    Login user with phone or email & password
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = asyncHandler(async (req, res) => {
  const { identifier, phone, email, password } = req.body;
  const rawIdentifier = identifier || phone || email;

  if (!rawIdentifier || !password) {
    return res.status(400).json({
      success: false,
      message: 'Please provide phone/email and password',
    });
  }

  const normalizedIdentifier = rawIdentifier.trim().toLowerCase();
  const user = await User.findOne({ identifier: normalizedIdentifier }).select('+passwordHash');

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid phone/email or password',
    });
  }

  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    return res.status(401).json({
      success: false,
      message: 'Invalid phone/email or password',
    });
  }

  // Ensure pharmacy users have an active Facility linked
  if (user.role === 'pharmacy' && !user.facilityId) {
    try {
      let fac = await Facility.findOne({ userId: user._id });
      if (!fac && user.facilityName) {
        fac = await Facility.findOne({ name: user.facilityName });
      }
      if (!fac) {
        fac = await Facility.create({
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
      }
      user.facilityId = fac._id;
      await user.save();
    } catch (err) {
      console.warn('[Auth Login] Facility auto-link error:', err.message);
    }
  }

  const token = user.generateAuthToken();

  res.status(200).json({
    success: true,
    message: 'Logged in successfully',
    token,
    user: {
      _id: user._id,
      id: user._id,
      name: user.name,
      identifier: user.identifier,
      phone: user.phone,
      email: user.email,
      role: user.role,
      village: user.village,
      preferredLanguage: user.preferredLanguage,
      age: user.age,
      gender: user.gender,
      chronicFlags: user.chronicFlags,
      emergencyContact: user.emergencyContact,
      specialization: user.specialization,
      licenseId: user.licenseId,
      availability: user.availability,
      availabilitySlots: user.availabilitySlots,
      designation: user.designation,
      facilityId: user.facilityId,
      facilityName: user.facilityName,
      facilityAddress: user.facilityAddress,
      facilityPhone: user.facilityPhone,
      facilityHours: user.facilityHours,
      facilityLocation: user.facilityLocation,
      createdAt: user.createdAt,
    },
  });
});

/**
 * @desc    Update user profile & role-specific fields
 * @route   PUT /api/auth/profile
 * @access  Private
 */
export const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  const {
    name,
    village,
    preferredLanguage,
    age,
    gender,
    chronicFlags,
    emergencyContact,
    specialization,
    licenseId,
    availability,
    availabilitySlots,
    designation,
    facilityName,
    facilityAddress,
    facilityPhone,
    facilityHours,
    facilityLocation,
  } = req.body;

  if (name) user.name = name.trim();
  if (village !== undefined) user.village = village.trim();
  if (preferredLanguage) user.preferredLanguage = preferredLanguage;
  if (emergencyContact && typeof emergencyContact === 'object') {
    user.emergencyContact = {
      name: emergencyContact.name || user.emergencyContact?.name || 'Ramesh Kumar (Brother)',
      phone: emergencyContact.phone || user.emergencyContact?.phone || '+91 98765 43210',
      relation: emergencyContact.relation || user.emergencyContact?.relation || 'Family Member',
    };
  }

  // Role-specific field updates
  if (user.role === 'patient') {
    if (age !== undefined) user.age = Number(age);
    if (gender) user.gender = gender;
    if (Array.isArray(chronicFlags)) user.chronicFlags = chronicFlags;
  } else if (user.role === 'doctor') {
    if (specialization) user.specialization = specialization;
    if (licenseId !== undefined) user.licenseId = licenseId;
    if (Array.isArray(availability)) user.availability = availability;
    if (Array.isArray(availabilitySlots)) user.availabilitySlots = availabilitySlots;
  } else if (user.role === 'admin') {
    if (designation) user.designation = designation;
  } else if (user.role === 'pharmacy') {
    if (facilityName) user.facilityName = facilityName.trim();
    if (facilityAddress) user.facilityAddress = facilityAddress.trim();
    if (facilityPhone) user.facilityPhone = facilityPhone.trim();
    if (facilityHours) user.facilityHours = facilityHours.trim();
    if (facilityLocation && facilityLocation.lat && facilityLocation.lng) {
      user.facilityLocation = { lat: Number(facilityLocation.lat), lng: Number(facilityLocation.lng) };
    }

    // Sync to linked Facility model if exists
    if (user.facilityId) {
      await Facility.findByIdAndUpdate(user.facilityId, {
        name: user.facilityName || `${user.name} Medical Store`,
        address: user.facilityAddress || user.village,
        phone: user.facilityPhone || user.phone,
        hours: user.facilityHours,
        location: user.facilityLocation,
      });
    }
  }

  const updatedUser = await user.save();

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    user: updatedUser,
  });
});

/**
 * @desc    Logout user / clear session
 * @route   POST /api/auth/logout
 * @access  Public
 */
export const logout = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
});

/**
 * @desc    Get current logged in user details
 * @route   GET /api/auth/me
 * @access  Private
 */
export const getMe = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    user: req.user,
  });
});

export default { register, login, updateProfile, logout, getMe };
