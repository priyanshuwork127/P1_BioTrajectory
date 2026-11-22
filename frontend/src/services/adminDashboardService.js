
import { auth, FirebaseService } from "./firebase";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

// ============================================================
// COMMON ADMIN API REQUEST
// ============================================================

async function adminRequest(endpoint) {
  const user = auth?.currentUser || FirebaseService.getCurrentUser();

  if (!user) {
    throw new Error("You must be logged in.");
  }

  const token = typeof user.getIdToken === 'function'
    ? await user.getIdToken()
    : `demo_token_${(user.role || 'admin').toLowerCase()}_${user.uid}`;

  const response = await fetch(
    `${API_BASE_URL}${endpoint}`,
    {
      method: "GET",

      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },

      cache: "no-store",
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(
        "Session expired. Please log in again."
      );
    }

    if (response.status === 403) {
      throw new Error(
        "Administrator access is required."
      );
    }

    throw new Error(
      data.detail || `Request failed (${response.status}).`
    );
  }

  if (!data.success) {
    throw new Error(
      data.detail ||
      "The server returned an unsuccessful response."
    );
  }

  return data;
}

const CUSTOM_ADMINS_KEY = "biotrajectory_custom_admins";
const ROLE_OVERRIDES_KEY = "biotrajectory_user_role_overrides";

export function getStoredCustomAdmins() {
  try {
    const raw = localStorage.getItem(CUSTOM_ADMINS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredCustomAdmins(admins) {
  try {
    localStorage.setItem(CUSTOM_ADMINS_KEY, JSON.stringify(admins));
  } catch (e) {
    console.error("Failed to persist custom admins:", e);
  }
}

export function getStoredRoleOverrides() {
  try {
    const raw = localStorage.getItem(ROLE_OVERRIDES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveStoredRoleOverrides(overrides) {
  try {
    localStorage.setItem(ROLE_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch (e) {
    console.error("Failed to persist role overrides:", e);
  }
}

export const DEFAULT_DEMO_USERS = [
  {
    uid: "usr-demo-1",
    id: "usr-demo-1",
    name: "Alex Johnson",
    email: "alex.johnson@example.com",
    role: "USER",
    status: "ACTIVE",
    registeredDate: "2026-01-15",
    lastActive: "Just now",
    twoFactorEnabled: true,
    condition: "Stage III Hypertension & Trace Proteinuria",
  },
  {
    uid: "usr-demo-2",
    id: "usr-demo-2",
    name: "Dr. Sarah Mitchell",
    email: "doctor@biotrajectory.health",
    role: "DOCTOR",
    status: "ACTIVE",
    registeredDate: "2025-11-10",
    lastActive: "10 mins ago",
    twoFactorEnabled: true,
    specialty: "Cardiology & Internal Medicine",
  },
  {
    uid: "usr-demo-3",
    id: "usr-demo-3",
    name: "Elena Rostova",
    email: "elena.rostova@example.com",
    role: "USER",
    status: "ACTIVE",
    registeredDate: "2026-02-01",
    lastActive: "1 hour ago",
    twoFactorEnabled: false,
    condition: "Post-Viral Fatigue & Microcytic Anemia",
  },
  {
    uid: "usr-demo-4",
    id: "usr-demo-4",
    name: "Rahul Sharma",
    email: "rahul.sharma@example.com",
    role: "USER",
    status: "ACTIVE",
    registeredDate: "2026-02-14",
    lastActive: "Yesterday",
    twoFactorEnabled: true,
    condition: "Stage 1 Essential Hypertension",
  },
  {
    uid: "usr-demo-5",
    id: "usr-demo-5",
    name: "Dr. Aris Thorne",
    email: "thorne@cardio-institute.med",
    role: "DOCTOR",
    status: "ACTIVE",
    registeredDate: "2025-08-20",
    lastActive: "30 mins ago",
    twoFactorEnabled: true,
    specialty: "Preventive Cardiology & Longevity",
  },
  {
    uid: "usr-demo-6",
    id: "usr-demo-6",
    name: "System Administrator",
    email: "admin@biotrajectory.health",
    role: "ADMIN",
    status: "ACTIVE",
    registeredDate: "2025-01-01",
    lastActive: "Active Now",
    twoFactorEnabled: true,
  },
  {
    uid: "usr-demo-7",
    id: "usr-demo-7",
    name: "Emily Johnson",
    email: "emily.johnson@example.com",
    role: "USER",
    status: "ACTIVE",
    registeredDate: "2026-02-18",
    lastActive: "3 hours ago",
    twoFactorEnabled: true,
    condition: "Gestational Wellness Surveillance",
  },
  {
    uid: "usr-demo-8",
    id: "usr-demo-8",
    name: "Marcus Vance",
    email: "marcus.vance@example.com",
    role: "USER",
    status: "ACTIVE",
    registeredDate: "2025-12-04",
    lastActive: "Today",
    twoFactorEnabled: true,
    condition: "Glomerular Proteinuria (CKD Stage 2)",
  },
  {
    uid: "usr-demo-9",
    id: "usr-demo-9",
    name: "Sophia Taylor",
    email: "sophia.taylor@example.com",
    role: "USER",
    status: "ACTIVE",
    registeredDate: "2026-03-01",
    lastActive: "2 days ago",
    twoFactorEnabled: false,
    condition: "Metabolic Syndrome & Impaired Fasting Glucose",
  },
  {
    uid: "usr-demo-10",
    id: "usr-demo-10",
    name: "David Patel",
    email: "david.patel@example.com",
    role: "USER",
    status: "SUSPENDED",
    registeredDate: "2025-10-12",
    lastActive: "15 days ago",
    twoFactorEnabled: false,
    condition: "Awaiting Identity Re-verification",
  },
  {
    uid: "usr-demo-11",
    id: "usr-demo-11",
    name: "Dr. Robert Chen",
    email: "doctor.pending@biotrajectory.health",
    role: "DOCTOR",
    status: "PENDING",
    registeredDate: "2026-11-19",
    lastActive: "4 hours ago",
    twoFactorEnabled: true,
    specialty: "Cardiothoracic Surgery",
  },
  {
    uid: "usr-demo-12",
    id: "usr-demo-12",
    name: "Dr. Priyanshi Mehta",
    email: "p.mehta@endocare.org",
    role: "DOCTOR",
    status: "PENDING",
    registeredDate: "2026-11-20",
    lastActive: "1 day ago",
    twoFactorEnabled: true,
    specialty: "Endocrinology & Diabetic Trajectory",
  },
];

export const DEFAULT_DEMO_STATS = {
  success: true,
  generatedAt: new Date().toISOString(),
  users: {
    total: 2480,
    active: 1840,
    byRole: {
      USER: 2340,
      DOCTOR: 132,
      ADMIN: 8,
    },
    registrationHistory: {
      history: [
        { month: "Jan", year: 2026, newUsers: 145 },
        { month: "Feb", year: 2026, newUsers: 198 },
        { month: "Mar", year: 2026, newUsers: 240 },
        { month: "Apr", year: 2026, newUsers: 310 },
        { month: "May", year: 2026, newUsers: 420 },
        { month: "Jun", year: 2026, newUsers: 580 },
      ],
    },
  },
  doctors: {
    total: 132,
    approved: 118,
    pending: 14,
    applications: {
      PENDING: 14,
      APPROVED: 118,
      REJECTED: 9,
    },
  },
  appointments: {
    total: 840,
    byStatus: {
      ACCEPTED: 420,
      COMPLETED: 360,
      PENDING: 42,
      CANCELLED: 18,
    },
  },
  system: {
    activeConsultations: 3,
    dailyVideoStatus: "READY",
    uptime: "99.98%",
    apiLatencyMs: 42,
  },
};

export const DEFAULT_DEMO_AGGREGATES = {
  success: true,
  period: "30d",
  patientCohortCount: 1840,
  vitals: {
    bloodPressure: {
      systolicMean: 122.4,
      diastolicMean: 78.6,
      hypertensionStage1Pct: 18.2,
      hypertensionStage2Pct: 5.8,
    },
    heartRate: {
      restingMean: 71.8,
      bradycardiaPct: 2.8,
      tachycardiaPct: 4.1,
    },
    glucose: {
      fastingMean: 95.2,
      prediabetesPct: 11.4,
      diabetesPct: 4.2,
    },
    urineMicroalbumin: {
      normalPct: 84.2,
      tracePct: 10.6,
      elevatedPct: 5.2,
    },
  },
  demographics: {
    ageGroups: [
      { range: "18-29", percentage: 22.4, count: 412 },
      { range: "30-44", percentage: 38.6, count: 710 },
      { range: "45-59", percentage: 25.8, count: 475 },
      { range: "60+", percentage: 13.2, count: 243 },
    ],
    genderDistribution: [
      { gender: "Female", percentage: 51.4 },
      { gender: "Male", percentage: 46.8 },
      { gender: "Other / Unspecified", percentage: 1.8 },
    ],
  },
  diseasePrevalence: [
    { disease: "Primary Hypertension", count: 442, percentage: 24.0 },
    { disease: "Metabolic Syndrome & Prediabetes", count: 284, percentage: 15.4 },
    { disease: "Post-Viral Fatigue & Dysautonomia", count: 186, percentage: 10.1 },
    { disease: "Chronic Kidney Disease Stage 1-2", count: 96, percentage: 5.2 },
  ],
};

const adminDashboardService = {

  // ----------------------------------------------------------
  // Dashboard statistics
  // ----------------------------------------------------------

  async getStats() {
    try {
      const res = await adminRequest("/api/admin/dashboard/stats");
      if (res?.success) return res;
    } catch (err) {
      console.warn("Backend admin stats request unavailable; using demo dataset:", err.message);
    }
    return DEFAULT_DEMO_STATS;
  },

  // ----------------------------------------------------------
  // All registered users and doctors
  // ----------------------------------------------------------

  async getUsers() {
    let baseUsers = DEFAULT_DEMO_USERS;
    try {
      if (auth?.currentUser) {
        const res = await adminRequest("/api/admin/users");
        if (res?.users && res.users.length > 0) {
          baseUsers = res.users;
        }
      }
    } catch (err) {
      console.warn("Backend admin users request unavailable; using demo users:", err.message);
    }

    const customAdmins = getStoredCustomAdmins();
    const roleOverrides = getStoredRoleOverrides();

    // Apply role overrides to existing users
    const mappedBase = baseUsers.map(user => {
      if (roleOverrides[user.uid]) {
        return { ...user, ...roleOverrides[user.uid] };
      }
      return user;
    });

    // Merge custom admins (avoiding duplicate UIDs)
    const existingUids = new Set(mappedBase.map(u => u.uid));
    const newAdmins = customAdmins.filter(a => !existingUids.has(a.uid));

    return {
      success: true,
      users: [...newAdmins, ...mappedBase]
    };
  },

  // ----------------------------------------------------------
  // Population medical aggregates
  // ----------------------------------------------------------

  async getMedicalAggregates(period = "30d") {
    try {
      const res = await adminRequest(
        `/api/admin/medical-records/aggregate?period=${encodeURIComponent(period)}`
      );
      if (res?.success) return res;
    } catch (err) {
      console.warn("Backend medical aggregates request unavailable; using demo cohort:", err.message);
    }
    return { ...DEFAULT_DEMO_AGGREGATES, period };
  },

  async addAdmin(adminData) {
    const newAdmin = {
      uid: `admin-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: adminData.name,
      email: adminData.email,
      role: 'ADMIN',
      roleTier: adminData.roleTier || 'SUPER_ADMIN',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      permissions: ['ALL_PERMISSIONS', 'USER_GOVERNANCE', 'SECURITY_KEYS']
    };

    // Attempt backend sync
    try {
      const user = auth?.currentUser;
      if (user) {
        const token = await user.getIdToken();
        const response = await fetch(`${API_BASE_URL}/api/admin/add-admin`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            name: adminData.name,
            email: adminData.email,
            role_tier: adminData.roleTier || 'SUPER_ADMIN',
            temporary_password: adminData.temporaryPassword || 'AdminPass@2026'
          })
        });
        const json = await response.json().catch(() => ({}));
        if (json?.admin?.uid) {
          newAdmin.uid = json.admin.uid;
        }
      }
    } catch (err) {
      console.warn("Backend admin creation endpoint skipped; saved locally:", err.message);
    }

    // Persist locally
    const currentCustom = getStoredCustomAdmins();
    saveStoredCustomAdmins([newAdmin, ...currentCustom]);

    return {
      success: true,
      message: `Administrator ${newAdmin.name} successfully registered.`,
      admin: newAdmin
    };
  },

  promoteUserToAdmin(uid, roleTier = 'SUPER_ADMIN') {
    const overrides = getStoredRoleOverrides();
    overrides[uid] = {
      role: 'ADMIN',
      roleTier,
      promotedAt: new Date().toISOString()
    };
    saveStoredRoleOverrides(overrides);
    return { success: true, message: "User successfully elevated to Administrator role." };
  },

  revokeAdmin(uid) {
    const overrides = getStoredRoleOverrides();
    overrides[uid] = {
      role: 'USER',
      roleTier: null,
      revokedAt: new Date().toISOString()
    };
    saveStoredRoleOverrides(overrides);

    const custom = getStoredCustomAdmins().filter(a => a.uid !== uid);
    saveStoredCustomAdmins(custom);

    return { success: true, message: "Administrator role revoked." };
  }
};

export default adminDashboardService;
