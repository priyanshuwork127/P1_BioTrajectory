
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from "firebase/firestore";

import { db } from "./firebase";

const COLLECTION_NAME = "approved_doctors";

function normalizeDoctor(snapshot) {
  const data = snapshot.data();

  if (
    data.status !== "APPROVED" ||
    typeof data.full_name !== "string" ||
    typeof data.specialization !== "string"
  ) {
    return null;
  }

  const fullName = data.full_name.trim();
  const displayName = /^dr\.?\s*/i.test(fullName)
    ? fullName
    : `Dr. ${fullName}`;

  return {
    uid: snapshot.id,
    id: snapshot.id,
    name: displayName,
    fullName,
    specialty: data.specialization,
    specialization: data.specialization,
    qualification: data.qualification || "",
    title: data.qualification || "",
    clinic: data.clinic_name || "",
    clinicName: data.clinic_name || "",
    status: data.status,
    approvedAt: data.approved_at || null,
  };
}

export const DEFAULT_APPROVED_DOCTORS = [
  {
    uid: "doc-sarah",
    id: "doc-sarah",
    name: "Dr. Sarah Mitchell",
    fullName: "Sarah Mitchell",
    specialty: "Cardiology & Internal Medicine",
    specialization: "Cardiology & Internal Medicine",
    qualification: "MD, FACC",
    title: "Senior Cardiologist",
    clinic: "Metro Health Medical Center",
    clinicName: "Metro Health Medical Center",
    status: "APPROVED",
    approvedAt: "2026-01-15T08:15:00Z",
    experience: "12+ Years Experience",
    rating: 4.9,
    reviewCount: 148,
    consultationFee: "$75",
    languages: ["English", "Hindi"],
    nextAvailable: "Today at 02:00 PM"
  },
  {
    uid: "doc-aris",
    id: "doc-aris",
    name: "Dr. Aris Thorne",
    fullName: "Aris Thorne",
    specialty: "Preventive Cardiology & Longevity",
    specialization: "Preventive Cardiology & Longevity",
    qualification: "MD, PhD",
    title: "Clinical Trajectory Lead",
    clinic: "Manhattan Heart & Longevity",
    clinicName: "Manhattan Heart & Longevity",
    status: "APPROVED",
    approvedAt: "2025-08-20T09:00:00Z",
    experience: "15+ Years Experience",
    rating: 4.8,
    reviewCount: 96,
    consultationFee: "$90",
    languages: ["English"],
    nextAvailable: "Tomorrow at 10:00 AM"
  },
  {
    uid: "doc-priyanshi",
    id: "doc-priyanshi",
    name: "Dr. Priyanshi Mehta",
    fullName: "Priyanshi Mehta",
    specialty: "Endocrinology & Diabetic Trajectory",
    specialization: "Endocrinology & Diabetic Trajectory",
    qualification: "MBBS, MD (Endocrinology)",
    title: "Endocrinology Consultant",
    clinic: "Apex Diabetes & Endocrine Center",
    clinicName: "Apex Diabetes & Endocrine Center",
    status: "APPROVED",
    approvedAt: "2026-02-10T11:00:00Z",
    experience: "9+ Years Experience",
    rating: 4.9,
    reviewCount: 112,
    consultationFee: "$65",
    languages: ["English", "Hindi"],
    nextAvailable: "Today at 04:30 PM"
  },
  {
    uid: "doc-robert",
    id: "doc-robert",
    name: "Dr. Robert Chen",
    fullName: "Robert Chen",
    specialty: "Cardiothoracic Surgery & Hemodynamics",
    specialization: "Cardiothoracic Surgery & Hemodynamics",
    qualification: "MD, FACS",
    title: "Cardiothoracic Surgeon",
    clinic: "Bay Area Cardiovascular Institute",
    clinicName: "Bay Area Cardiovascular Institute",
    status: "APPROVED",
    approvedAt: "2026-03-01T14:20:00Z",
    experience: "18+ Years Experience",
    rating: 5.0,
    reviewCount: 204,
    consultationFee: "$120",
    languages: ["English"],
    nextAvailable: "Wednesday at 11:15 AM"
  },
  {
    uid: "doc-marcus",
    id: "doc-marcus",
    name: "Dr. Marcus Vance",
    fullName: "Marcus Vance",
    specialty: "Physical Medicine & Rehabilitation",
    specialization: "Physical Medicine & Rehabilitation",
    qualification: "DO, FAAPMR",
    title: "Physiatrist & Renal Surveillance",
    clinic: "Lone Star Physical Medicine",
    clinicName: "Lone Star Physical Medicine",
    status: "APPROVED",
    approvedAt: "2026-01-28T16:00:00Z",
    experience: "11+ Years Experience",
    rating: 4.7,
    reviewCount: 78,
    consultationFee: "$70",
    languages: ["English"],
    nextAvailable: "Today at 05:00 PM"
  }
];

export const approvedDoctorService = {
  async getAll() {
    if (!db) {
      return DEFAULT_APPROVED_DOCTORS;
    }

    try {
      const doctorsQuery = query(
        collection(db, COLLECTION_NAME),
        where("status", "==", "APPROVED")
      );

      const snapshot = await getDocs(doctorsQuery);

      const result = snapshot.docs
        .map(normalizeDoctor)
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name));

      return result.length > 0 ? result : DEFAULT_APPROVED_DOCTORS;
    } catch {
      return DEFAULT_APPROVED_DOCTORS;
    }
  },

  async getById(uid) {
    if (!uid) {
      return null;
    }

    if (!db) {
      return DEFAULT_APPROVED_DOCTORS.find(d => d.uid === uid || d.id === uid) || DEFAULT_APPROVED_DOCTORS[0];
    }

    try {
      const snapshot = await getDoc(doc(db, COLLECTION_NAME, uid));

      if (!snapshot.exists()) {
        return DEFAULT_APPROVED_DOCTORS.find(d => d.uid === uid || d.id === uid) || null;
      }

      return normalizeDoctor(snapshot);
    } catch {
      return DEFAULT_APPROVED_DOCTORS.find(d => d.uid === uid || d.id === uid) || null;
    }
  },
};
