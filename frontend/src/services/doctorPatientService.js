
import {
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import { db } from "./firebase";

const APPOINTMENTS_COLLECTION = "appointments";

const ROSTER_STATUSES = new Set([
  "ACCEPTED",
  "COMPLETED",
]);

function formatDate(value) {
  if (!value) return "";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function buildPatientRoster(appointmentDocs) {
  const today = new Date();

  today.setHours(0, 0, 0, 0);

  const patients = new Map();

  for (const snapshot of appointmentDocs) {
    const appointment = snapshot.data();

    if (!ROSTER_STATUSES.has(appointment.status)) {
      continue;
    }

    if (!appointment.patientId) {
      continue;
    }

    const patientId = appointment.patientId;

    const current = patients.get(patientId) || {
      id: patientId,
      patientId,
      name: appointment.patientName || "Patient",
      patientName: appointment.patientName || "Patient",
      appointments: [],
    };

    current.appointments.push({
      id: snapshot.id,
      status: appointment.status,
      appointmentDate: appointment.appointmentDate || "",
      appointmentTime: appointment.appointmentTime || "",
      type: appointment.type || "",
    });

    if (appointment.patientName) {
      current.name = appointment.patientName;
      current.patientName = appointment.patientName;
    }

    patients.set(patientId, current);
  }

  return [...patients.values()]
    .map((patient) => {
      const sorted = [...patient.appointments].sort((a, b) =>
        `${b.appointmentDate}T${b.appointmentTime}`.localeCompare(
          `${a.appointmentDate}T${a.appointmentTime}`
        )
      );

      const upcoming = sorted
        .filter((item) => {
          if (
            item.status !== "ACCEPTED" ||
            !item.appointmentDate
          ) {
            return false;
          }

          const date = new Date(
            `${item.appointmentDate}T00:00:00`
          );

          return (
            !Number.isNaN(date.getTime()) &&
            date >= today
          );
        })
        .sort((a, b) =>
          `${a.appointmentDate}T${a.appointmentTime}`.localeCompare(
            `${b.appointmentDate}T${b.appointmentTime}`
          )
        )[0];

      const latest = sorted[0];

      const latestCompleted = sorted.find(
        (item) => item.status === "COMPLETED"
      );

      const latestDate = latestCompleted?.appointmentDate
        ? new Date(
            `${latestCompleted.appointmentDate}T00:00:00`
          )
        : null;

      const recentCutoff = new Date(today);

      recentCutoff.setDate(
        recentCutoff.getDate() - 7
      );

      return {
        ...patient,

        status: upcoming
          ? "Upcoming Appointment"
          : latest?.status === "COMPLETED"
            ? "Consultation Completed"
            : "Appointment History",

        appointmentCount: sorted.length,

        lastVisit: latestCompleted
          ? formatDate(latestCompleted.appointmentDate)
          : "No completed visit",

        nextFollowUp: upcoming
          ? `${formatDate(upcoming.appointmentDate)}${
              upcoming.appointmentTime
                ? ` · ${upcoming.appointmentTime}`
                : ""
            }`
          : "Not scheduled",

        latestAppointmentDate:
          latest?.appointmentDate || "",

        hasUpcomingAppointment: Boolean(upcoming),

        hasActiveAppointment: sorted.some(
          (item) => item.status === "ACCEPTED"
        ),

        hasRecentVisit: Boolean(
          latestDate &&
          !Number.isNaN(latestDate.getTime()) &&
          latestDate >= recentCutoff &&
          latestDate <= today
        ),

        avatar: "",
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const DEFAULT_DEMO_PATIENTS = [
  {
    id: "pat-101",
    patientId: "pat-101",
    name: "Alex Johnson",
    patientName: "Alex Johnson",
    age: 45,
    gender: "Male",
    status: "Upcoming Appointment",
    diagnosis: "Colorectal Carcinoma (Stage III) with Secondary Hypertension",
    appointmentCount: 3,
    lastVisit: "21 Nov 2026",
    nextFollowUp: "Today · 10:30 AM",
    latestAppointmentDate: "2026-11-22",
    hasUpcomingAppointment: true,
    hasActiveAppointment: true,
    hasRecentVisit: true,
    avatar: "",
    appointments: [
      {
        id: "apt-video-alex",
        status: "ACCEPTED",
        appointmentDate: "2026-11-22",
        appointmentTime: "10:30 AM",
        type: "video",
      },
    ],
  },
  {
    id: "pat-103",
    patientId: "pat-103",
    name: "Elena Rostova",
    patientName: "Elena Rostova",
    age: 38,
    gender: "Female",
    status: "Upcoming Appointment",
    diagnosis: "Post-Viral Fatigue & Mild Iron Deficiency",
    appointmentCount: 2,
    lastVisit: "17 Nov 2026",
    nextFollowUp: "Today · 02:00 PM",
    latestAppointmentDate: "2026-11-22",
    hasUpcomingAppointment: true,
    hasActiveAppointment: true,
    hasRecentVisit: true,
    avatar: "",
    appointments: [
      {
        id: "apt-video-elena",
        status: "ACCEPTED",
        appointmentDate: "2026-11-22",
        appointmentTime: "02:00 PM",
        type: "video",
      },
    ],
  },
  {
    id: "pat-104",
    patientId: "pat-104",
    name: "Rahul Sharma",
    patientName: "Rahul Sharma",
    age: 52,
    gender: "Male",
    status: "Appointment History",
    diagnosis: "Stage 1 Essential Hypertension",
    appointmentCount: 4,
    lastVisit: "02 Nov 2026",
    nextFollowUp: "Tomorrow · 11:15 AM",
    latestAppointmentDate: "2026-11-23",
    hasUpcomingAppointment: true,
    hasActiveAppointment: false,
    hasRecentVisit: false,
    avatar: "",
    appointments: [
      {
        id: "apt-pending-rahul",
        status: "PENDING",
        appointmentDate: "2026-11-23",
        appointmentTime: "11:15 AM",
        type: "video",
      },
    ],
  },
  {
    id: "pat-105",
    patientId: "pat-105",
    name: "Marcus Vance",
    patientName: "Marcus Vance",
    age: 61,
    gender: "Male",
    status: "Upcoming Appointment",
    diagnosis: "Glomerular Proteinuria & Stage 2 CKD Surveillance",
    appointmentCount: 5,
    lastVisit: "10 Nov 2026",
    nextFollowUp: "Today · 04:30 PM",
    latestAppointmentDate: "2026-11-22",
    hasUpcomingAppointment: true,
    hasActiveAppointment: true,
    hasRecentVisit: true,
    avatar: "",
    appointments: [
      {
        id: "apt-clinic-marcus",
        status: "ACCEPTED",
        appointmentDate: "2026-11-22",
        appointmentTime: "04:30 PM",
        type: "in-person",
      },
    ],
  },
];

export const doctorPatientService = {
  subscribeToDoctorPatients(
    doctorUid,
    onData,
    onError
  ) {
    if (!doctorUid) {
      onData?.(DEFAULT_DEMO_PATIENTS);
      return () => {};
    }

    if (!db) {
      onData?.(DEFAULT_DEMO_PATIENTS);
      return () => {};
    }

    try {
      const appointmentsQuery = query(
        collection(db, APPOINTMENTS_COLLECTION),
        where("doctorId", "==", doctorUid)
      );

      return onSnapshot(
        appointmentsQuery,
        (snapshot) => {
          const patients = buildPatientRoster(
            snapshot.docs
          );

          if (patients.length === 0) {
            onData?.(DEFAULT_DEMO_PATIENTS);
          } else {
            onData?.(patients);
          }
        },
        (error) => {
          console.warn(
            "Doctor patient roster fallback to demo patients:",
            error
          );
          onData?.(DEFAULT_DEMO_PATIENTS);
        }
      );
    } catch {
      onData?.(DEFAULT_DEMO_PATIENTS);
      return () => {};
    }
  },

  async getDoctorPatients(doctorUid) {
    if (!doctorUid || !db) {
      return DEFAULT_DEMO_PATIENTS;
    }

    try {
      const appointmentsQuery = query(
        collection(db, APPOINTMENTS_COLLECTION),
        where("doctorId", "==", doctorUid)
      );

      const snapshot = await getDocs(
        appointmentsQuery
      );

      const patients = buildPatientRoster(snapshot.docs);
      return patients.length > 0 ? patients : DEFAULT_DEMO_PATIENTS;
    } catch {
      return DEFAULT_DEMO_PATIENTS;
    }
  },
};
