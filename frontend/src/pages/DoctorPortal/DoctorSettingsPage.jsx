
import React, { useState } from "react";
import {
  Bell,
  Lock,
  ShieldCheck,
  RefreshCw,
  Stethoscope,
  Video,
  FileText,
  CalendarClock,
  CheckCircle2,
} from "lucide-react";

const initialSettings = [
  {
    id: "clinical_alerts",
    label: "Clinical alerts & vital threshold alarms",
    description: "Receive priority alerts when patient readings exceed critical systolic (>160) or microalbumin thresholds.",
    icon: Bell,
    enabled: true,
  },
  {
    id: "consent_prompts",
    label: "Patient consent verification prompts",
    description: "Require cryptographic patient authorization before accessing longitudinal clinical vaults.",
    icon: Lock,
    enabled: true,
  },
  {
    id: "telemedicine",
    label: "Telemedicine & video consultation availability",
    description: "Allow accepted appointment patients to initiate Daily Prebuilt video rooms directly with you.",
    icon: Video,
    enabled: true,
  },
  {
    id: "care_notes",
    label: "Auto-generated care trajectory notes",
    description: "Generate structured clinical trajectory summaries following completed video consultations.",
    icon: FileText,
    enabled: true,
  },
  {
    id: "reminders",
    label: "Follow-up consultation reminders",
    description: "Automated schedule reminders for patients flagged with stage 2 hypertension or proteinuria.",
    icon: CalendarClock,
    enabled: true,
  },
  {
    id: "note_locking",
    label: "Secure note locking & digital seal",
    description: "Apply SHA-256 digital signature stamp upon finalizing medical consultation reports.",
    icon: ShieldCheck,
    enabled: true,
  },
];

export default function DoctorSettingsPage() {
  const [preferences, setPreferences] = useState(() => {
    try {
      const stored = localStorage.getItem("biotrajectory_doc_settings");
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {}
    return initialSettings.reduce((acc, s) => ({ ...acc, [s.id]: s.enabled }), {});
  });

  const [toast, setToast] = useState("");

  const toggleSetting = (id, label) => {
    setPreferences((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem("biotrajectory_doc_settings", JSON.stringify(next));
      } catch {}
      setToast(`${label}: ${next[id] ? "Enabled" : "Disabled"}`);
      setTimeout(() => setToast(""), 2500);
      return next;
    });
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] px-2.5 py-1 rounded-full bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300">
            Practice Settings
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
            <CheckCircle2 size={12} />
            Live Preferences Active
          </span>
        </div>

        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
          Clinical Workspace Preferences
        </h1>

        <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm">
          Configure security, telemedicine controls, and automated clinical documentation workflows for your practice.
        </p>
      </div>

      {toast && (
        <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-700 dark:text-cyan-300 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 size={16} className="text-cyan-500 shrink-0" />
          {toast}
        </div>
      )}

      {/* Settings list */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-cyan-100 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-300 flex items-center justify-center">
            <Stethoscope className="w-5 h-5" />
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Secure practice controls
            </h2>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Active practitioner governance preferences
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {initialSettings.map(({ id, label, description, icon: Icon }) => {
            const isEnabled = preferences[id] ?? true;
            return (
              <div
                key={id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-white dark:bg-slate-900/80 flex items-center justify-center text-slate-500 dark:text-slate-300 shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>

                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white text-sm">
                      {label}
                    </p>

                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {description}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => toggleSetting(id, label)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isEnabled ? "bg-cyan-500" : "bg-slate-300 dark:bg-slate-700"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      isEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Security information */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-5">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-5 h-5 text-blue-600 dark:text-blue-400" />

          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Compliance & Audit Log
            </h3>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Verified clinical practice environment with continuous audit synchronization.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
          <ShieldCheck size={16} className="shrink-0 mt-0.5 text-emerald-500" />

          <p>
            All consultations, prescriptions, and medical records are subject to strict role-based access boundaries and auditable doctor-patient consent sessions.
          </p>
        </div>
      </div>
    </div>
  );
}
