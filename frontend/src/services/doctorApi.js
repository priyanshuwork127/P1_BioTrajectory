
import { auth, FirebaseService } from "./firebase";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export const DEFAULT_DEMO_APPLICATIONS = [
  {
    uid: "doc-app-001",
    full_name: "Dr. Robert Chen",
    email: "doctor.pending@biotrajectory.health",
    phone: "+1 (555) 432-8765",
    specialization: "Cardiothoracic Surgery & Hemodynamics",
    qualification: "MD, FACS",
    issuing_council: "California Medical Board",
    registration_number: "MED-CA-2024-8812",
    clinic_name: "Bay Area Cardiovascular Institute",
    status: "PENDING",
    submitted_at: "2026-11-19T10:30:00Z",
    created_at: "2026-11-19T10:30:00Z",
    documents: [
      { name: "Medical_Council_License_2026.pdf", type: "License", status: "Verified" },
      { name: "Surgical_Board_Fellowship.pdf", type: "Certification", status: "Verified" }
    ]
  },
  {
    uid: "doc-app-002",
    full_name: "Dr. Sarah Mitchell",
    email: "doctor@biotrajectory.health",
    phone: "+1 (555) 234-5678",
    specialization: "Internal Medicine & Chronobiology",
    qualification: "MD, FACC",
    issuing_council: "State Medical Board",
    registration_number: "MED-94827-DL",
    clinic_name: "Metro Health Medical Center",
    status: "APPROVED",
    submitted_at: "2026-01-15T08:15:00Z",
    created_at: "2026-01-15T08:15:00Z",
    review_note: "Verified against national physician registry. Clean disciplinary record.",
    documents: [
      { name: "State_Physician_License.pdf", type: "License", status: "Verified" },
      { name: "Clinical_Cardiology_Diploma.pdf", type: "Diploma", status: "Verified" }
    ]
  },
  {
    uid: "doc-app-003",
    full_name: "Dr. Priyanshi Mehta",
    email: "p.mehta@endocare.org",
    phone: "+91 98201 44321",
    specialization: "Endocrinology & Diabetic Trajectory",
    qualification: "MBBS, MD (Endocrinology)",
    issuing_council: "Delhi Medical Council",
    registration_number: "DMC-77491-DEL",
    clinic_name: "Apex Diabetes & Endocrine Center",
    status: "PENDING",
    submitted_at: "2026-11-20T14:45:00Z",
    created_at: "2026-11-20T14:45:00Z",
    documents: [
      { name: "DMC_Registration_Certificate.pdf", type: "License", status: "Verified" }
    ]
  },
  {
    uid: "doc-app-004",
    full_name: "Dr. Aris Thorne",
    email: "thorne@cardio-institute.med",
    phone: "+1 (555) 312-9900",
    specialization: "Preventive Cardiology & Longevity Medicine",
    qualification: "MD, PhD",
    issuing_council: "New York State Board for Medicine",
    registration_number: "MED-NY-55319",
    clinic_name: "Manhattan Longevity & Heart Center",
    status: "APPROVED",
    submitted_at: "2025-08-20T09:00:00Z",
    created_at: "2025-08-20T09:00:00Z",
    review_note: "Background and academic verification completed successfully.",
    documents: [
      { name: "NY_State_Medical_License.pdf", type: "License", status: "Verified" }
    ]
  },
  {
    uid: "doc-app-005",
    full_name: "Dr. Marcus Vance",
    email: "vance.ortho@medsport.org",
    phone: "+1 (555) 789-0123",
    specialization: "Physical Medicine & Rehabilitation",
    qualification: "DO, FAAPMR",
    issuing_council: "Texas Medical Board",
    registration_number: "MED-TX-11928",
    clinic_name: "Lone Star Physical Medicine",
    status: "REJECTED",
    submitted_at: "2026-10-05T16:20:00Z",
    created_at: "2026-10-05T16:20:00Z",
    review_note: "Documentation submitted for primary board certification was incomplete.",
    documents: [
      { name: "State_DO_License.pdf", type: "License", status: "Pending Verification" }
    ]
  }
];

const LOCAL_DOC_APPS_KEY = "biotrajectory_demo_doctor_apps";

function getStoredApplications() {
  try {
    const raw = localStorage.getItem(LOCAL_DOC_APPS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_DEMO_APPLICATIONS;
}

function saveStoredApplications(apps) {
  try {
    localStorage.setItem(LOCAL_DOC_APPS_KEY, JSON.stringify(apps));
  } catch {}
}

async function authenticatedRequest(endpoint, options = {}) {
  const user = auth?.currentUser || FirebaseService.getCurrentUser();

  if (!user) {
    throw new Error("You must be logged in to perform this action.");
  }

  const token = typeof user.getIdToken === 'function'
    ? await user.getIdToken()
    : `demo_token_${(user.role || 'doctor').toLowerCase()}_${user.uid}`;

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.detail ||
        data.message ||
        `Request failed: ${response.status}`
    );
  }

  return data;
}

export const doctorApi = {
  async submitApplication(applicationData) {
    if (!applicationData) {
      throw new Error("Doctor application details are required.");
    }

    try {
      return await authenticatedRequest("/api/doctor/applications", {
        method: "POST",
        body: JSON.stringify(applicationData),
      });
    } catch {
      // Local demo fallback
      const stored = getStoredApplications();
      const newApp = {
        uid: `doc-app-${Date.now()}`,
        full_name: applicationData.fullName || "Dr. Applicant",
        email: applicationData.email || "",
        phone: applicationData.phone || "",
        specialization: applicationData.specialization || "General Medicine",
        qualification: applicationData.qualification || "MD",
        issuing_council: applicationData.issuingCouncil || "Medical Council",
        registration_number: applicationData.registrationNumber || "MED-PENDING",
        clinic_name: applicationData.clinicName || "",
        status: "PENDING",
        submitted_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        documents: []
      };
      saveStoredApplications([newApp, ...stored]);
      return { success: true, application: newApp };
    }
  },

  async getMyApplication() {
    try {
      return await authenticatedRequest("/api/doctor/application");
    } catch (err) {
      const stored = getStoredApplications();
      const user = auth?.currentUser || FirebaseService.getCurrentUser();
      const match = stored.find(a => a.email === user?.email || a.uid === user?.uid) || stored[1];
      return { success: true, application: match };
    }
  },

  async getApplications(status = "PENDING") {
    try {
      const query = status
        ? `?status_filter=${encodeURIComponent(status)}`
        : "";

      const res = await authenticatedRequest(
        `/api/admin/doctor-applications${query}`
      );
      if (res?.applications && res.applications.length > 0) {
        return res;
      }
    } catch (err) {
      console.warn("Backend doctor applications request unavailable; using demo dataset:", err.message);
    }

    const stored = getStoredApplications();
    const filtered = !status || status === "ALL"
      ? stored
      : stored.filter(a => a.status === status);

    return {
      success: true,
      applications: filtered
    };
  },

  async approveApplication(uid, note = "Approved after administrator review.") {
    if (!uid) {
      throw new Error("Doctor application ID is required.");
    }

    try {
      await authenticatedRequest(
        `/api/admin/doctor-applications/${encodeURIComponent(uid)}/approve`,
        {
          method: "POST",
          body: JSON.stringify({ note }),
        }
      );
    } catch (err) {
      console.warn("Backend approve skipped; updating locally:", err.message);
    }

    const stored = getStoredApplications();
    const updated = stored.map(a => a.uid === uid ? { ...a, status: "APPROVED", review_note: note } : a);
    saveStoredApplications(updated);

    return { success: true, message: "Doctor application approved successfully." };
  },

  async rejectApplication(uid, reason = "") {
    if (!uid) {
      throw new Error("Doctor application ID is required.");
    }

    try {
      await authenticatedRequest(
        `/api/admin/doctor-applications/${encodeURIComponent(uid)}/reject`,
        {
          method: "POST",
          body: JSON.stringify({ note: reason }),
        }
      );
    } catch (err) {
      console.warn("Backend reject skipped; updating locally:", err.message);
    }

    const stored = getStoredApplications();
    const updated = stored.map(a => a.uid === uid ? { ...a, status: "REJECTED", review_note: reason } : a);
    saveStoredApplications(updated);

    return { success: true, message: "Doctor application rejected." };
  },
};
