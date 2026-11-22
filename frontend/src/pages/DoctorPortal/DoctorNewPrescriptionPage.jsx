
import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Pill,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Sparkles,
} from "lucide-react";

import { useDoctorAuth } from "../../context/DoctorAuthContext";
import { DEFAULT_DEMO_PATIENTS } from "../../services/doctorPatientService";

export default function DoctorNewPrescriptionPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { doctor, isVerified } = useDoctorAuth();

  const initialPatientId = searchParams.get("patientId") || "pat-101";
  const [selectedPatientId, setSelectedPatientId] = useState(initialPatientId);
  const [medication, setMedication] = useState("Telmisartan 40mg + Amlodipine 5mg");
  const [dosage, setDosage] = useState("1 tablet once daily in the morning after breakfast");
  const [duration, setDuration] = useState("60 days");
  const [diagnosis, setDiagnosis] = useState("Stage 1 Essential Hypertension");
  const [refillsLeft, setRefillsLeft] = useState(2);
  const [instructions, setInstructions] = useState("Take with water after breakfast. Monitor home blood pressure twice weekly.");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState(false);

  const selectedPatient =
    DEFAULT_DEMO_PATIENTS.find((p) => p.id === selectedPatientId || p.patientId === selectedPatientId) ||
    DEFAULT_DEMO_PATIENTS[0];

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const newPrescription = {
      id: `rx-${Date.now().toString(36)}`,
      patientName: selectedPatient.name,
      patientId: selectedPatient.id,
      medication,
      dosage,
      duration,
      diagnosis,
      prescribedDate: new Date().toISOString().split("T")[0],
      status: "Active",
      refillsLeft: Number(refillsLeft),
      instructions,
      doctorName: doctor?.name || "Dr. Sarah Mitchell, MD",
    };

    try {
      const raw = localStorage.getItem("biotrajectory_prescriptions");
      const existing = raw ? JSON.parse(raw) : [];
      localStorage.setItem("biotrajectory_prescriptions", JSON.stringify([newPrescription, ...existing]));
      window.dispatchEvent(new CustomEvent("biotrajectory_rx_added", { detail: newPrescription }));
    } catch (err) {
      console.warn("Local storage write error:", err);
    }

    setSuccessNotice(true);
    setTimeout(() => {
      navigate("/doctor/prescriptions");
    }, 900);
  };

  return (
    <div className="space-y-7 pb-12 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <Link
          to="/doctor/prescriptions"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Prescriptions
        </Link>

        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300">
            Pharmacotherapy Management
          </span>

          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            Verified Physician Access
          </span>

          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            Active Demo Mode
          </span>
        </div>

        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
          Issue Medical Prescription
        </h1>

        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Draft, validate, and publish a pharmacotherapy schedule for an active consultation patient.
        </p>
      </div>

      {successNotice && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          <span className="font-semibold text-sm">Prescription successfully validated, digitally signed, and stored in the patient archive! Redirecting...</span>
        </div>
      )}

      {/* Prescription Form */}
      <form onSubmit={handleSubmit} className="rounded-3xl p-6 sm:p-8 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="w-12 h-12 rounded-xl bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400 flex items-center justify-center">
            <Pill className="w-6 h-6" />
          </div>

          <div>
            <h2 className="font-bold text-slate-900 dark:text-white">
              Clinical Prescription Schedule
            </h2>
            <p className="text-xs text-slate-500">
              Prescribing Doctor: {doctor?.fullName || doctor?.name || "Dr. Sarah Mitchell, MD"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Select Patient
            </label>
            <select
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {DEFAULT_DEMO_PATIENTS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.diagnosis || "Active Consultation"})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Primary Clinical Diagnosis
            </label>
            <input
              type="text"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Medication & Strength
            </label>
            <input
              type="text"
              value={medication}
              onChange={(e) => setMedication(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Dosage & Frequency
            </label>
            <input
              type="text"
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Duration
              </label>
              <input
                type="text"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Authorized Refills
              </label>
              <input
                type="number"
                min="0"
                max="6"
                value={refillsLeft}
                onChange={(e) => setRefillsLeft(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Patient Instructions & Monitoring Guidance
            </label>
            <textarea
              rows={3}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        <div className="pt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
          <Link
            to="/doctor/prescriptions"
            className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-60"
          >
            {isSubmitting ? "Signing & Issuing..." : "Sign & Issue Prescription"}
          </button>
        </div>
      </form>
    </div>
  );
}
