
import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  FileText,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

import { useDoctorAuth } from "../../context/DoctorAuthContext";
import { DEFAULT_DEMO_PATIENTS } from "../../services/doctorPatientService";

export default function DoctorNewReportPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { doctor, isVerified } = useDoctorAuth();

  const initialPatientId = searchParams.get("patientId") || "pat-101";
  const [selectedPatientId, setSelectedPatientId] = useState(initialPatientId);
  const [reportType, setReportType] = useState("Video Consultation");
  const [diagnosis, setDiagnosis] = useState("Stage 1 Essential Hypertension & Trajectory Review");
  const [chiefComplaints, setChiefComplaints] = useState("Follow-up review of ambulatory blood pressure and lifestyle adherence. Occasional mild occipital tightness.");
  const [bp, setBp] = useState("124/80 mmHg");
  const [hr, setHr] = useState("72 bpm");
  const [spo2, setSpo2] = useState("98%");
  const [temp, setTemp] = useState("98.6°F");
  const [plan, setPlan] = useState("Maintain dietary sodium moderation (<2g/day). Continue prescribed pharmacotherapy schedule. Scheduled routine urinalysis strip scan in 3 weeks.");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState(false);

  const selectedPatient =
    DEFAULT_DEMO_PATIENTS.find((p) => p.id === selectedPatientId || p.patientId === selectedPatientId) ||
    DEFAULT_DEMO_PATIENTS[0];

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const newReport = {
      id: `REP-${Math.floor(10 + Math.random() * 90)}`,
      patientName: selectedPatient.name,
      patientId: selectedPatient.id,
      diagnosis,
      chiefComplaints,
      date: new Date().toISOString().split("T")[0],
      type: reportType,
      status: "Signed",
      vitals: { bp, hr, spo2, temp },
      plan,
      signedBy: doctor?.name || "Dr. Sarah Mitchell, MD",
      licenseNumber: "MED-94827-DL",
    };

    try {
      const raw = localStorage.getItem("biotrajectory_consultation_reports");
      const existing = raw ? JSON.parse(raw) : [];
      localStorage.setItem("biotrajectory_consultation_reports", JSON.stringify([newReport, ...existing]));
      window.dispatchEvent(new CustomEvent("biotrajectory_report_added", { detail: newReport }));
    } catch (err) {
      console.warn("Local storage write error:", err);
    }

    setSuccessNotice(true);
    setTimeout(() => {
      navigate("/doctor/reports");
    }, 900);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-7 pb-12">
      <div>
        <Link
          to="/doctor/reports"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Consultation Reports
        </Link>

        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
            Clinical Documentation
          </span>

          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            Verified Physician Access
          </span>

          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-cyan-100 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-400 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            Active Demo Mode
          </span>
        </div>

        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
          Write Consultation Report
        </h1>

        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Draft and publish clinical consultation notes, objective vitals, and trajectory care plans.
        </p>
      </div>

      {successNotice && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          <span className="font-semibold text-sm">Consultation report signed and published to patient archive! Redirecting...</span>
        </div>
      )}

      {/* Report Form */}
      <form onSubmit={handleSubmit} className="rounded-3xl p-6 sm:p-8 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>

          <div>
            <h2 className="font-bold text-slate-900 dark:text-white">
              Official Consultation Report
            </h2>
            <p className="text-xs text-slate-500">
              Physician: {doctor?.fullName || doctor?.name || "Dr. Sarah Mitchell, MD"}
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
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              Consultation Format
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Video Consultation">In-App Video Consultation</option>
              <option value="In-Person Consultation">In-Person Clinic Visit</option>
              <option value="Urinalysis Lab Review">Urinalysis Biomarker Review</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Clinical Diagnosis / Assessment
            </label>
            <input
              type="text"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Chief Complaints & Subjective Findings
            </label>
            <textarea
              rows={2}
              value={chiefComplaints}
              onChange={(e) => setChiefComplaints(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Objective Vitals */}
          <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Blood Pressure</label>
              <input
                type="text"
                value={bp}
                onChange={(e) => setBp(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Heart Rate</label>
              <input
                type="text"
                value={hr}
                onChange={(e) => setHr(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">SpO2</label>
              <input
                type="text"
                value={spo2}
                onChange={(e) => setSpo2(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Temperature</label>
              <input
                type="text"
                value={temp}
                onChange={(e) => setTemp(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Treatment Plan & Clinical Trajectory Recommendations
            </label>
            <textarea
              rows={3}
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="pt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
          <Link
            to="/doctor/reports"
            className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-60"
          >
            {isSubmitting ? "Publishing..." : "Sign & Publish Report"}
          </button>
        </div>
      </form>
    </div>
  );
}
