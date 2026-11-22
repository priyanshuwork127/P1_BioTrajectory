
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Pill,
  PlusCircle,
  Search,
  ShieldCheck,
  AlertTriangle,
  LockKeyhole,
} from "lucide-react";

import { useDoctorAuth } from "../../context/DoctorAuthContext";

const DEMO_PRESCRIPTIONS = [
  {
    id: "rx-101",
    patientName: "Alex Johnson",
    patientId: "pat-101",
    medication: "Telmisartan 40mg + Amlodipine 5mg",
    dosage: "1 tablet once daily in the morning",
    duration: "90 days",
    diagnosis: "Stage III Secondary Hypertension",
    prescribedDate: "2026-11-20",
    status: "Active",
    refillsLeft: 3,
    instructions: "Take with water after breakfast. Monitor home blood pressure twice weekly.",
  },
  {
    id: "rx-102",
    patientName: "Elena Rostova",
    patientId: "pat-103",
    medication: "Ferrous Ascorbate 100mg + Folic Acid 1.5mg",
    dosage: "1 tablet once daily with Vitamin C",
    duration: "60 days",
    diagnosis: "Mild Microcytic Hypochromic Anemia",
    prescribedDate: "2026-11-17",
    status: "Active",
    refillsLeft: 2,
    instructions: "Avoid tea, coffee, or antacids within 2 hours of ingestion.",
  },
  {
    id: "rx-103",
    patientName: "Rahul Sharma",
    patientId: "pat-104",
    medication: "Hydrochlorothiazide 12.5mg",
    dosage: "1 tablet daily in the morning",
    duration: "30 days",
    diagnosis: "Essential Hypertension Stage 1",
    prescribedDate: "2026-11-02",
    status: "Active",
    refillsLeft: 1,
    instructions: "Maintain adequate hydration. Report any persistent leg cramping or dizziness.",
  },
];

export const getStoredPrescriptions = () => {
  try {
    const raw = localStorage.getItem("biotrajectory_prescriptions");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEMO_PRESCRIPTIONS;
};

export default function DoctorPrescriptionsPage() {
  const { doctor, isVerified } = useDoctorAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [prescriptions, setPrescriptions] = useState(getStoredPrescriptions);

  useEffect(() => {
    const handleUpdate = () => {
      setPrescriptions(getStoredPrescriptions());
    };
    window.addEventListener("biotrajectory_rx_added", handleUpdate);
    return () => window.removeEventListener("biotrajectory_rx_added", handleUpdate);
  }, []);

  const filteredPrescriptions = prescriptions.filter(
    (rx) =>
      rx.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rx.medication.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rx.diagnosis.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300">
              Pharmacotherapy Management
            </span>

            {isVerified && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Verified Doctor
              </span>
            )}

            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400">
              Demo Archive Active
            </span>
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
            Prescriptions Archive
          </h1>

          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
            View and manage validated pharmacotherapy schedules and patient refills.
          </p>
        </div>

        <Link
          to="/doctor/prescriptions/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-md transition-all self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          Issue New Prescription
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />

        <input
          type="text"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search by patient name, medication, or diagnosis..."
          className="w-full pl-10 pr-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      {/* Prescriptions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPrescriptions.map((rx) => (
          <div
            key={rx.id}
            className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4"
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                  <Pill className="w-5 h-5" />
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                  {rx.status}
                </span>
              </div>

              <div className="mt-3">
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  {rx.medication}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{rx.dosage}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Patient:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {rx.patientName} ({rx.patientId})
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Indication:</span>
                  <span className="text-right truncate max-w-[180px]">{rx.diagnosis}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Duration / Refills:</span>
                  <span>{rx.duration} · {rx.refillsLeft} refills</span>
                </div>
              </div>

              {rx.instructions && (
                <div className="mt-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-[11px] text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Instructions: </span>
                  {rx.instructions}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Date: {rx.prescribedDate}</span>
              <span className="font-mono text-[10px]">{rx.id}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
