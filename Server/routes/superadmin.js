import express from 'express';

const router = express.Router();

// Admin dashboard statistics (must come before /:id route)
router.get('/dashboard/stats', async (req, res) => {
  try {
    const Hospital = (await import('../models/Hospital.js')).default;
    const Patient = (await import('../models/Patient.js')).default;

    const totalHospitals = await Hospital.countDocuments({});
    const activeHospitals = await Hospital.countDocuments({ active: true });
    const activePatients = await Patient.countDocuments({});

    // Recent hospital registrations (last 10)
    const recentHospitals = await Hospital.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .select('_id name city state createdAt active')
      .lean();

    return res.json({
      ok: true,
      stats: {
        totalHospitals,
        activeHospitals,
        activePatients,
        recentHospitals,
      },
    });
  } catch (err) {
    console.error('dashboard stats error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// List all patients with search and pagination (must come before /:id route)
router.get('/patients', async (req, res) => {
  try {
    const Patient = (await import('../models/Patient.js')).default;
    const Hospital = (await import('../models/Hospital.js')).default;
    const { search = '', page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { patientId: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Patient.countDocuments(filter);
    const patients = await Patient.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-password -salt')
      .lean();

    // Populate hospital names and normalize patient data
    const patientsWithHospital = await Promise.all(
      patients.map(async (patient) => {
        let hospitalName = 'N/A';
        if (patient.hospital) {
          const hospital = await Hospital.findById(patient.hospital).select('name').lean();
          hospitalName = hospital?.name || 'N/A';
        }

        // Normalize name field - combine firstName + lastName if name is missing
        let displayName = patient.name;
        if (!displayName && (patient.firstName || patient.lastName)) {
          displayName = [patient.firstName, patient.lastName].filter(Boolean).join(' ').trim() || 'N/A';
        }
        if (!displayName) displayName = 'N/A';

        return {
          ...patient,
          name: displayName,
          hospitalName,
        };
      })
    );

    return res.json({
      ok: true,
      patients: patientsWithHospital,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('list patients error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// List all hospitals with search and pagination (must come before /:id route)
router.get('/hospitals', async (req, res) => {
  try {
    const Hospital = (await import('../models/Hospital.js')).default;
    const { search = '', page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } },
        { state: { $regex: search, $options: 'i' } },
        { contactEmail: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Hospital.countDocuments(filter);
    const hospitals = await Hospital.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-password -salt')
      .lean();

    return res.json({
      ok: true,
      hospitals,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('list hospitals error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Get single hospital by ID
router.get('/hospitals/:id', async (req, res) => {
  try {
    const Hospital = (await import('../models/Hospital.js')).default;
    const Patient = (await import('../models/Patient.js')).default;
    const Staff = (await import('../models/Staff.js')).default;
    const Record = (await import('../models/Record.js')).default;

    const hospital = await Hospital.findById(req.params.id).select('-password -salt').lean();
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });

    // Count patients, staff, and records for this hospital
    const [patientCount, staffCount, recordsCount] = await Promise.all([
      Patient.countDocuments({ hospital: req.params.id }),
      Staff.countDocuments({ hospital: req.params.id }),
      Record.countDocuments({ hospital: req.params.id }),
    ]);

    return res.json({ 
      ok: true, 
      hospital: { 
        ...hospital, 
        patientCount,
        staffCount,
        recordsCount,
      } 
    });
  } catch (err) {
    console.error('get hospital error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Update hospital (including active status)
router.patch('/hospitals/:id', async (req, res) => {
  try {
    const Hospital = (await import('../models/Hospital.js')).default;
    const allowedFields = ['name', 'regNumber', 'address', 'city', 'state', 'pin', 'license', 'contactEmail', 'phone', 'website', 'adminName', 'adminEmail', 'adminPhone', 'designation', 'active'];
    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const hospital = await Hospital.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).select('-password -salt');
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });

    return res.json({ ok: true, hospital });
  } catch (err) {
    console.error('update hospital error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Delete hospital
router.delete('/hospitals/:id', async (req, res) => {
  try {
    const Hospital = (await import('../models/Hospital.js')).default;
    const hospital = await Hospital.findByIdAndDelete(req.params.id);
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });

    return res.json({ ok: true, message: 'Hospital deleted successfully' });
  } catch (err) {
    console.error('delete hospital error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Fetch superadmin by id (safe view) - MUST be last to not conflict with other routes
router.get('/:id', async (req, res) => {
  try {
    const Superadmin = (await import('../models/Superadmin.js')).default;
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing superadmin id' });
    const doc = await Superadmin.findById(id).lean();
    if (!doc) return res.status(404).json({ error: 'Superadmin not found' });
    if (doc.password) delete doc.password;
    if (doc.salt) delete doc.salt;
    return res.json({ ok: true, admin: doc });
  } catch (err) {
    console.error('fetch superadmin error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

export default router;
