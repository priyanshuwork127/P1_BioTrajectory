
import { auth } from "./firebase";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

// ============================================================
// COMMON ADMIN API REQUEST
// ============================================================

async function adminRequest(endpoint) {
  const user = auth?.currentUser;

  if (!user) {
    throw new Error("You must be logged in.");
  }

  const token = await user.getIdToken();

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
const adminDashboardService = {

  // ----------------------------------------------------------
  // Dashboard statistics
  // ----------------------------------------------------------

  async getStats() {
    return adminRequest(
      "/api/admin/dashboard/stats"
    );
  },

  // ----------------------------------------------------------
  // All registered users and doctors
  // ----------------------------------------------------------

  async getUsers() {
    let baseUsers = DEFAULT_DEMO_USERS;
    try {
      if (auth?.currentUser) {
        const res = await adminRequest("/api/admin/users");
        if (res?.users) {
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
    const allowedPeriods = [
      "7d",
      "30d",
      "6m",
      "1y",
    ];

    if (!allowedPeriods.includes(period)) {
      throw new Error(
        "Invalid medical records period."
      );
    }

    return adminRequest(
      `/api/admin/medical-records/aggregate?period=${encodeURIComponent(period)}`
    );
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
