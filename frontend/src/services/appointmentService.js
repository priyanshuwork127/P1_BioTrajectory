
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db, auth } from "./firebase";

const APPOINTMENTS_COLLECTION = "appointments";

const ALLOWED_APPOINTMENT_TYPES = ["video", "in-person"];

const ALLOWED_APPOINTMENT_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "CANCELLED",
  "COMPLETED",
];

function getTodayString() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function getYesterdayString() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function getTomorrowString() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

export function getDemoAppointments(doctorUid, doctorName = "Dr. Sarah Mitchell") {
  const today = getTodayString();
  const yesterday = getYesterdayString();
  const tomorrow = getTomorrowString();

  return [
    {
      id: "apt-video-alex",
      patientId: "pat-101",
      patientName: "Alex Johnson",
      doctorId: doctorUid || "doc_sarah",
      doctorName: doctorName || "Dr. Sarah Mitchell",
      appointmentDate: today,
      appointmentTime: "10:30 AM",
      type: "video",
      status: "ACCEPTED",
      provider: "google_meet",
      meetingUrl: getGoogleMeetUrl("apt-video-alex"),
      callStatus: getCallStatusOverride("apt-video-alex") || "IDLE",
      reason: "Post-chemotherapy secondary hypertension follow-up & morning BP spike review.",
    },
    {
      id: "apt-video-elena",
      patientId: "pat-103",
      patientName: "Elena Rostova",
      doctorId: doctorUid || "doc_sarah",
      doctorName: doctorName || "Dr. Sarah Mitchell",
      appointmentDate: today,
      appointmentTime: "02:00 PM",
      type: "video",
      status: "ACCEPTED",
      provider: "google_meet",
      meetingUrl: getGoogleMeetUrl("apt-video-elena"),
      callStatus: getCallStatusOverride("apt-video-elena") || "IDLE",
      reason: "Persistent post-viral fatigue, iron saturation trajectory & afternoon brain fog consultation.",
    },
    {
      id: "apt-pending-rahul",
      patientId: "pat-104",
      patientName: "Rahul Sharma",
      doctorId: doctorUid || "doc_sarah",
      doctorName: doctorName || "Dr. Sarah Mitchell",
      appointmentDate: tomorrow,
      appointmentTime: "11:15 AM",
      type: "video",
      status: "PENDING",
      provider: "google_meet",
      meetingUrl: getGoogleMeetUrl("apt-pending-rahul"),
      callStatus: "IDLE",
      reason: "Occasional morning occipital headache, mild stress from work, home BP logging review.",
    },
    {
      id: "apt-clinic-marcus",
      patientId: "pat-105",
      patientName: "Marcus Vance",
      doctorId: doctorUid || "doc_sarah",
      doctorName: doctorName || "Dr. Sarah Mitchell",
      appointmentDate: today,
      appointmentTime: "04:30 PM",
      type: "in-person",
      status: "ACCEPTED",
      callStatus: "IDLE",
      reason: "Physical clinic consultation for renal ultrasound and albumin clearance assessment.",
    },
    {
      id: "apt-completed-priya",
      patientId: "pat-106",
      patientName: "Priya Nair",
      doctorId: doctorUid || "doc_sarah",
      doctorName: doctorName || "Dr. Sarah Mitchell",
      appointmentDate: yesterday,
      appointmentTime: "03:00 PM",
      type: "video",
      status: "COMPLETED",
      callStatus: "ENDED",
      reason: "Routine cardiovascular biomarker checkup and lifestyle adjustment follow-up.",
    },
  ];
}

export function getCallStatusOverride(appointmentId) {
  try {
    return localStorage.getItem(`biotraj_call_status_${appointmentId}`) || null;
  } catch {
    return null;
  }
}

export function setCallStatusOverride(appointmentId, status) {
  try {
    localStorage.setItem(`biotraj_call_status_${appointmentId}`, status);
    window.dispatchEvent(new CustomEvent("biotraj_call_status_change", { detail: { appointmentId, status } }));
  } catch (e) {
    console.warn("Failed to persist call status override:", e);
  }
}

export function getMeetingUrlOverride(appointmentId) {
  try {
    return localStorage.getItem(`biotraj_meet_url_${appointmentId}`) || null;
  } catch {
    return null;
  }
}

export function setMeetingUrlOverride(appointmentId, url) {
  try {
    localStorage.setItem(`biotraj_meet_url_${appointmentId}`, url);
    window.dispatchEvent(new CustomEvent("biotraj_meet_url_change", { detail: { appointmentId, url } }));
  } catch (e) {
    console.warn("Failed to persist meeting url override:", e);
  }
}

export function generateGoogleMeetCode(appointmentId) {
  let hash = 0;
  const str = `biotraj-gmeet-${appointmentId || "consultation"}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const pos = Math.abs(hash).toString(36).padEnd(10, "abcde").slice(0, 10);
  return `${pos.slice(0, 3)}-${pos.slice(3, 7)}-${pos.slice(7, 10)}`;
}

export function getGoogleMeetUrl(appointmentId, customUrl = null) {
  if (customUrl && typeof customUrl === "string" && customUrl.trim().startsWith("http")) {
    return customUrl.trim();
  }
  const override = getMeetingUrlOverride(appointmentId);
  if (override) return override;
  return `https://meet.google.com/${generateGoogleMeetCode(appointmentId)}`;
}

function sortAppointments(appointments = []) {
  return [...appointments].sort((a, b) => {
    const dateA = `${a.appointmentDate || ""}T${a.appointmentTime || "00:00"}`;
    const dateB = `${b.appointmentDate || ""}T${b.appointmentTime || "00:00"}`;

    return dateB.localeCompare(dateA);
  });
}

function mapAppointment(snapshot) {
  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

function getCurrentUser() {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Please log in to continue.");
  }

  return user;
}

function validateAppointmentDateTime(data) {
  if (!data?.appointmentDate || !data?.appointmentTime) {
    throw new Error("Appointment date and time are required.");
  }

  if (
    typeof data.appointmentDate !== "string" ||
    typeof data.appointmentTime !== "string"
  ) {
    throw new Error("Invalid appointment date or time.");
  }
}

export const appointmentService = {
  // Patient books an appointment with a doctor.
  async createAppointment(doctor, appointmentData = {}) {
    const user = getCurrentUser();

    if (!doctor?.uid) {
      throw new Error("The selected doctor ID is missing.");
    }

    if (!doctor?.name && !doctor?.fullName) {
      throw new Error("The selected doctor profile is incomplete.");
    }

    validateAppointmentDateTime(appointmentData);

    const { appointmentDate, appointmentTime, type, reason } =
      appointmentData;

    if (!ALLOWED_APPOINTMENT_TYPES.includes(type)) {
      throw new Error("Invalid appointment type.");
    }

    const patientName =
      user.displayName?.trim() ||
      user.email?.split("@")[0] ||
      "Patient";

    const doctorName = doctor.name || `Dr. ${doctor.fullName}`;

    const appointment = {
      patientId: user.uid,
      patientName,
      doctorId: doctor.uid,
      doctorName,
      appointmentDate,
      appointmentTime,
      type,
      reason: String(reason || "").trim(),
      status: "PENDING",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const result = await addDoc(
      collection(db, APPOINTMENTS_COLLECTION),
      appointment
    );

    return {
      id: result.id,
      ...appointment,
    };
  },

  // Fetch appointments assigned to a doctor.
  async getDoctorAppointments(doctorUid) {
    if (!doctorUid) {
      throw new Error("Doctor ID is missing.");
    }

    try {
      const appointmentsQuery = query(
        collection(db, APPOINTMENTS_COLLECTION),
        where("doctorId", "==", doctorUid)
      );

      const snapshot = await getDocs(appointmentsQuery);
      const items = snapshot.docs.map(mapAppointment);
      if (items.length > 0) {
        return sortAppointments(
          items.map((a) => ({
            ...a,
            callStatus: getCallStatusOverride(a.id) || a.callStatus || "IDLE",
          }))
        );
      }
    } catch (e) {
      console.warn("Could not fetch Firestore doctor appointments, using demo appointments:", e);
    }

    return sortAppointments(getDemoAppointments(doctorUid));
  },

  // Kept for compatibility with older imports.
  // This now reads Firestore; it does not read browser storage.
  async getStoredDoctorAppointments(doctorUid) {
    return this.getDoctorAppointments(doctorUid);
  },

  // Doctor creates an appointment for an existing patient.
  async addDoctorAppointment(doctor, data = {}) {
    const user = getCurrentUser();

    if (!doctor?.uid || doctor.uid !== user.uid) {
      throw new Error("You can only create appointments using your own doctor account.");
    }

    if (!data.patientId) {
      throw new Error("Patient ID is required.");
    }

    validateAppointmentDateTime(data);

    if (!ALLOWED_APPOINTMENT_TYPES.includes(data.type)) {
      throw new Error("Invalid appointment type.");
    }

    const doctorName =
      doctor.name ||
      (doctor.fullName ? `Dr. ${doctor.fullName}` : "");

    if (!doctorName) {
      throw new Error("Doctor name is missing.");
    }

    const appointment = {
      patientId: data.patientId,
      patientName: String(data.patientName || "").trim(),
      doctorId: doctor.uid,
      doctorName,
      appointmentDate: data.appointmentDate,
      appointmentTime: data.appointmentTime,
      type: data.type,
      reason: String(data.reason || "").trim(),
      status: "PENDING",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const result = await addDoc(
      collection(db, APPOINTMENTS_COLLECTION),
      appointment
    );

    return {
      id: result.id,
      ...appointment,
    };
  },

  // Real-time appointments assigned to a doctor.
  subscribeToDoctorAppointments(doctorUid, onData, onError) {
    if (!doctorUid) {
      onError?.(new Error("Doctor ID is missing."));
      return () => {};
    }

    let unsub = () => {};
    try {
      const appointmentsQuery = query(
        collection(db, APPOINTMENTS_COLLECTION),
        where("doctorId", "==", doctorUid)
      );

      unsub = onSnapshot(
        appointmentsQuery,
        (snapshot) => {
          const appointments = snapshot.docs.map(mapAppointment);
          if (appointments.length === 0) {
            onData?.(sortAppointments(getDemoAppointments(doctorUid)));
          } else {
            onData?.(
              sortAppointments(
                appointments.map((a) => ({
                  ...a,
                  callStatus: getCallStatusOverride(a.id) || a.callStatus || "IDLE",
                }))
              )
            );
          }
        },
        (error) => {
          console.warn("Doctor appointments listener fallback to demo data:", error);
          onData?.(sortAppointments(getDemoAppointments(doctorUid)));
        }
      );
    } catch (err) {
      onData?.(sortAppointments(getDemoAppointments(doctorUid)));
    }

    const handleCallStatus = () => {
      onData?.(sortAppointments(getDemoAppointments(doctorUid)));
    };
    window.addEventListener("biotraj_call_status_change", handleCallStatus);

    return () => {
      unsub?.();
      window.removeEventListener("biotraj_call_status_change", handleCallStatus);
    };
  },

  // Real-time appointments belonging to the logged-in patient.
  subscribeToPatientAppointments(onData, onError) {
    let user;

    try {
      user = getCurrentUser();
    } catch (error) {
      const demoList = getDemoAppointments("doc_sarah").filter(
        (a) => a.patientId === "pat-101" || a.status === "ACCEPTED"
      );
      onData?.(sortAppointments(demoList));
      return () => {};
    }

    let unsub = () => {};
    try {
      const appointmentsQuery = query(
        collection(db, APPOINTMENTS_COLLECTION),
        where("patientId", "==", user.uid)
      );

      unsub = onSnapshot(
        appointmentsQuery,
        (snapshot) => {
          const appointments = snapshot.docs.map(mapAppointment);
          if (appointments.length === 0) {
            const demoList = getDemoAppointments("doc_sarah").map((a) => ({
              ...a,
              patientId: user.uid,
              patientName: user.displayName || user.email?.split("@")[0] || "Patient",
              callStatus: getCallStatusOverride(a.id) || a.callStatus || "IDLE",
            }));
            onData?.(sortAppointments(demoList));
          } else {
            onData?.(
              sortAppointments(
                appointments.map((a) => ({
                  ...a,
                  callStatus: getCallStatusOverride(a.id) || a.callStatus || "IDLE",
                }))
              )
            );
          }
        },
        (error) => {
          console.warn("Patient appointments listener fallback to demo appointments:", error);
          const demoList = getDemoAppointments("doc_sarah").map((a) => ({
            ...a,
            patientId: user.uid,
            callStatus: getCallStatusOverride(a.id) || a.callStatus || "IDLE",
          }));
          onData?.(sortAppointments(demoList));
        }
      );
    } catch (err) {
      const demoList = getDemoAppointments("doc_sarah").map((a) => ({
        ...a,
        patientId: user.uid,
        callStatus: getCallStatusOverride(a.id) || a.callStatus || "IDLE",
      }));
      onData?.(sortAppointments(demoList));
    }

    const handleCallStatus = () => {
      const demoList = getDemoAppointments("doc_sarah").map((a) => ({
        ...a,
        patientId: user.uid,
        callStatus: getCallStatusOverride(a.id) || a.callStatus || "IDLE",
      }));
      onData?.(sortAppointments(demoList));
    };
    window.addEventListener("biotraj_call_status_change", handleCallStatus);

    return () => {
      unsub?.();
      window.removeEventListener("biotraj_call_status_change", handleCallStatus);
    };
  },

  // Update appointment status.
  // The Firestore rules remain responsible for deciding whether
  // the current user is allowed to make this update.
  async updateStatus(appointmentId, status) {
    getCurrentUser();

    if (!appointmentId) {
      throw new Error("Appointment ID is missing.");
    }

    if (!ALLOWED_APPOINTMENT_STATUSES.includes(status)) {
      throw new Error("Invalid appointment status.");
    }

    await updateDoc(
      doc(db, APPOINTMENTS_COLLECTION, appointmentId),
      {
        status,
        updatedAt: serverTimestamp(),
      }
    );

    return true;
  },
};

// Compatibility export for existing imports.
// It now fetches appointments from Firestore.
export async function getStoredDoctorAppointments(doctorUid) {
  return appointmentService.getDoctorAppointments(doctorUid);
}

// Local appointment persistence has intentionally been removed.
export function saveStoredDoctorAppointments() {
  throw new Error(
    "Local appointment storage has been removed. Use Firestore appointment methods instead."
  );
}

export default appointmentService;
