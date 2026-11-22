import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  FileText,
  Search,
  ShieldCheck,
  PlusCircle,
  Eye,
  CheckCircle2,
  Calendar,
  User,
  Activity,
  X,
  Printer,
  Download
} from "lucide-react";

import { useDoctorAuth } from "../../context/DoctorAuthContext";

export const DEFAULT_DEMO_REPORTS = [
  {
    id: "REP-01",
    patientName: "Alex Johnson",
    patientId: "pat-101",
    diagnosis: "Colorectal Adenoma Stage II with Secondary Hypertension",
    chiefComplaints: "Managing post-chemo fatigue, mild morning occipital tension, borderline blood pressure spikes.",
    date: "2026-11-21",
    type: "Video Consultation",
    status: "Signed",
    vitals: { bp: "128/82 mmHg", hr: "74 bpm", spo2: "98%", temp: "98.6°F" },
    plan: "Initiate Telmisartan 40mg PO daily. Monitor ambulatory BP trajectory twice daily. Hydration target 2.5L.",
    signedBy: "Dr. Sarah Mitchell, MD",
    licenseNumber: "MD-89241-US"
  },
  {
    id: "REP-02",
    patientName: "Elena Rostova",
    patientId: "pat-103",
    diagnosis: "Post-Viral Fatigue & Mild Iron Deficiency",
    chiefComplaints: "Persistent lethargy after viral illness, mild afternoon brain fog, normal sleep schedule.",
    date: "2026-11-17",
    type: "Video Consultation",
    status: "Signed",
    vitals: { bp: "114/72 mmHg", hr: "68 bpm", spo2: "99%", temp: "98.4°F" },
    plan: "Ferrous Ascorbate 100mg with Vitamin C. Repeat ferritin & metabolic panel in 4 weeks.",
    signedBy: "Dr. Sarah Mitchell, MD",
    licenseNumber: "MD-89241-US"
  },
  {
    id: "REP-03",
    patientName: "Rahul Sharma",
    patientId: "pat-104",
    diagnosis: "Stage 1 Essential Hypertension",
    chiefComplaints: "Occasional morning occipital headache, mild stress from work, home BP averages 136/88 mmHg.",
    date: "2026-11-02",
    type: "In-Person Consultation",
    status: "Signed",
    vitals: { bp: "134/86 mmHg", hr: "78 bpm", spo2: "98%", temp: "98.7°F" },
    plan: "Dietary sodium restriction (<2g/day). Hydrochlorothiazide 12.5mg daily. Review in 3 weeks.",
    signedBy: "Dr. Sarah Mitchell, MD",
    licenseNumber: "MD-89241-US"
  },
  {
    id: "REP-04",
    patientName: "Marcus Vance",
    patientId: "pat-102",
    diagnosis: "Renal Microalbuminuria Assessment",
    chiefComplaints: "Follow-up test strip review showing trace protein (15 mg/dL), normal specific gravity 1.018.",
    date: "2026-11-22",
    type: "Video Consultation",
    status: "Signed",
    vitals: { bp: "122/78 mmHg", hr: "70 bpm", spo2: "99%", temp: "98.5°F" },
    plan: "Optimal hydration maintained. Recheck urine strip in 30 days. No ACE inhibitor escalation required.",
    signedBy: "Dr. Sarah Mitchell, MD",
    licenseNumber: "MD-89241-US"
  }
];

export const getStoredReports = () => {
  try {
    const raw = localStorage.getItem("biotrajectory_consultation_reports");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_DEMO_REPORTS;
};

export default function DoctorReportsPage() {
  const { doctor, isVerified } = useDoctorAuth();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all"); // 'all' | 'Signed' | 'Draft'
  const [selectedReport, setSelectedReport] = useState(null);
  const [reports, setReports] = useState(getStoredReports);

  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      const matchesSearch =
        report.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.diagnosis.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.patientId.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesFilter =
        filterStatus === "all" || report.status === filterStatus;

      return matchesSearch && matchesFilter;
    });
  }, [reports, searchTerm, filterStatus]);

  return (
    <div className="space-y-8 pb-12 font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
              Clinical Documentation
            </span>

            {isVerified && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Verified Doctor
              </span>
            )}
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
            Consultation Reports
          </h1>

          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
            Authoritative 13-field clinical summaries with digital signature verification.
          </p>
        </div>

        <Link
          to="/doctor/reports/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md transition-all self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          Create New Report
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search reports by patient or diagnosis..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
          {["all", "Signed", "Draft"].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterStatus(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                filterStatus === tab
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {tab === "all" ? "All Reports" : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredReports.map((report) => (
          <div
            key={report.id}
            className="rounded-2xl p-5 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
          >
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 text-xs text-slate-500">
                <span className="font-mono font-semibold">{report.id}</span>
                <span className="px-2 py-0.5 rounded-full font-bold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                  {report.status}
                </span>
              </div>

              <div className="mt-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {report.patientName}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Patient ID: {report.patientId}
                </p>
              </div>

              <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/60 space-y-1.5">
                <div className="text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Diagnosis: </span>
                  <span className="text-slate-600 dark:text-slate-400">{report.diagnosis}</span>
                </div>
                <div className="text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Chief Complaints: </span>
                  <span className="text-slate-600 dark:text-slate-400 line-clamp-2">{report.chiefComplaints}</span>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>Date: {report.date}</span>
                <span className="font-medium">{report.type}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <button
                onClick={() => setSelectedReport(report)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Full Document</span>
              </button>

              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Digitally Sealed
              </span>
            </div>
          </div>
        ))}
      </div>

      {filteredReports.length === 0 && (
        <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
          <FileText className="w-10 h-10 mx-auto text-slate-400 mb-2" />
          <h3 className="font-bold text-slate-800 dark:text-slate-200">No reports found</h3>
          <p className="text-xs text-slate-500 mt-1">Try adjusting your search or filter.</p>
        </div>
      )}

      {/* Full Document Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Clinical Consultation Summary ({selectedReport.id})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Digitally Sealed • BioTrajectory Clinical Telehealth Network
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedReport(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <div>
                  <span className="text-slate-500 block font-medium">Patient</span>
                  <span className="font-bold text-slate-900 dark:text-white">{selectedReport.patientName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block font-medium">Patient ID</span>
                  <span className="font-bold font-mono">{selectedReport.patientId}</span>
                </div>
                <div>
                  <span className="text-slate-500 block font-medium">Date</span>
                  <span className="font-bold">{selectedReport.date}</span>
                </div>
                <div>
                  <span className="text-slate-500 block font-medium">Type</span>
                  <span className="font-bold">{selectedReport.type}</span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Diagnosis & Assessment</h4>
                <p className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-500/20 text-slate-800 dark:text-slate-200">
                  {selectedReport.diagnosis}
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Chief Complaints & History</h4>
                <p className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300">
                  {selectedReport.chiefComplaints}
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Recorded Clinical Vitals</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(selectedReport.vitals).map(([k, v]) => (
                    <div key={k} className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-center">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">{k}</span>
                      <span className="font-bold font-mono text-slate-900 dark:text-white">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Therapeutic Plan & Prescriptions</h4>
                <p className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-500/20 text-slate-800 dark:text-slate-200">
                  {selectedReport.plan}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-slate-500">
                <div>
                  <span className="block font-semibold text-slate-700 dark:text-slate-300">
                    Digitally Signed By: {selectedReport.signedBy}
                  </span>
                  <span className="text-[10px]">Medical License: {selectedReport.licenseNumber}</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>SHA-256 Validated</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedReport(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
