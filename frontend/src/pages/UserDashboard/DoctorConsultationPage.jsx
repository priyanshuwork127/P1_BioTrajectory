import React, { useEffect, useMemo, useState } from "react";

import {
  Search,
  Stethoscope,
  ShieldCheck,
  RefreshCw,
  UserRound,
  CalendarClock,
  Video,
  AlertCircle,
  History,
  CheckCircle2,
  X,
  CalendarDays,
  Clock,
  MapPin,
  ClipboardList,
  AlertOctagon,
  Zap
} from "lucide-react";

import { approvedDoctorService } from "../../services/approvedDoctorService";
import { appointmentService, getGoogleMeetUrl, getMeetingUrlOverride } from "../../services/appointmentService";
import { consultationService } from "../../services/consultationService";
import DailyIframe from "@daily-co/daily-js";
import { getPatientPriorityStatus, subscribeToPriorityChanges } from "../../services/patientPriorityService";
import DisclaimerBanner from "../../components/common/DisclaimerBanner";

function GoogleMeetIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 87.5 72" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M49.5 36L64.5 48V24L49.5 36Z" fill="#00832D" />
      <path d="M0 51.5C0 57.299 4.701 62 10.5 62H49.5V41H0V51.5Z" fill="#0066DA" />
      <path d="M49.5 41V10H10.5C4.701 10 0 14.701 0 20.5V41H49.5Z" fill="#E94235" />
      <path d="M49.5 10H64.5V36L49.5 24V10Z" fill="#FFBA00" />
      <path d="M64.5 36L87.5 53.5V18.5L64.5 36Z" fill="#00AC47" />
    </svg>
  );
}

function getLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatAppointmentDate(dateString) {
  if (!dateString) return "Date unavailable";

  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatAppointmentTime(timeString) {
  if (!timeString) return "Time unavailable";

  const [hours, minutes] = timeString.split(":");
  const date = new Date();
  date.setHours(Number(hours), Number(minutes), 0, 0);

  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getStatusStyle(status) {
  switch (status) {
    case "ACCEPTED":
      return "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300";
    case "REJECTED":
      return "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300";
    case "COMPLETED":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
    default:
      return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
  }
}

function getStatusDescription(status) {
  switch (status) {
    case "ACCEPTED":
      return "The doctor has accepted your appointment request.";
    case "REJECTED":
      return "The doctor has declined this appointment request.";
    case "COMPLETED":
      return "This appointment has been marked as completed.";
    default:
      return "Your appointment request is waiting for doctor approval.";
  }
}

export default function DoctorConsultationPage() {
  const [activeTab, setActiveTab] = useState("browse");
  const [priorityStatus, setPriorityStatus] = useState(() => getPatientPriorityStatus());

  useEffect(() => {
    const unsubscribe = subscribeToPriorityChanges((status) => {
      setPriorityStatus(status);
    });
    return unsubscribe;
  }, []);

  // Doctor discovery
  const [doctors, setDoctors] = useState([]);
  const [selectedSpecialty, setSelectedSpecialty] =
    useState("All Specialties");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // Patient appointment history
  const [appointments, setAppointments] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyFilter, setHistoryFilter] = useState("ALL");

  // In-App Video Consultation (Google Meet & Daily)
  const [copiedAptId, setCopiedAptId] = useState(null);
  const [activeVideoAppointment, setActiveVideoAppointment] = useState(null);
  const [patientCallPhase, setPatientCallPhase] = useState("idle"); // idle | joining | connected | ended | error
  const [patientCallError, setPatientCallError] = useState("");
  const patientCallContainerRef = React.useRef(null);
  const patientDailyFrameRef = React.useRef(null);

  const handleCopyMeetLink = (aptId, url) => {
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedAptId(aptId);
      setTimeout(() => setCopiedAptId(null), 2000);
    }).catch(() => {});
  };

  const handleOpenGoogleMeet = async (appointment) => {
    // 1. Check local override or appointment property first
    let meetUrl = getMeetingUrlOverride(appointment.id) || appointment.meetingUrl;
    // 2. Fetch latest verified Google Meet link from backend if available
    try {
      const res = await consultationService.joinConsultation(appointment.id, "google_meet");
      if (res?.roomUrl) {
        meetUrl = res.roomUrl;
      }
    } catch (e) {
      console.warn("Could not fetch remote meet URL on join:", e);
    }
    // 3. Fallback to deterministic appointment Google Meet URL (100% matched with doctor)
    if (!meetUrl) {
      meetUrl = getGoogleMeetUrl(appointment.id);
    }
    window.open(meetUrl, "_blank", "noopener,noreferrer");
  };

  // Sync Google Meet link and call status changes in real time across tabs
  useEffect(() => {
    const handleUrlChange = (e) => {
      const { appointmentId, url } = e.detail || {};
      if (appointmentId && url) {
        setAppointments((prev) =>
          prev.map((a) => (a.id === appointmentId ? { ...a, meetingUrl: url } : a))
        );
      }
    };

    const handleStatusChange = (e) => {
      const { appointmentId, status, meetUrl } = e.detail || {};
      if (appointmentId) {
        setAppointments((prev) =>
          prev.map((a) =>
            a.id === appointmentId
              ? { ...a, callStatus: status, ...(meetUrl ? { meetingUrl: meetUrl } : {}) }
              : a
          )
        );
      }
    };

    const handleStorage = (e) => {
      if (e.key && e.key.startsWith("biotraj_meet_url_")) {
        const aptId = e.key.replace("biotraj_meet_url_", "");
        setAppointments((prev) =>
          prev.map((a) => (a.id === aptId ? { ...a, meetingUrl: e.newValue } : a))
        );
      }
      if (e.key && e.key.startsWith("biotraj_call_status_")) {
        const aptId = e.key.replace("biotraj_call_status_", "");
        setAppointments((prev) =>
          prev.map((a) => (a.id === aptId ? { ...a, callStatus: e.newValue } : a))
        );
      }
    };

    window.addEventListener("biotraj_meet_url_change", handleUrlChange);
    window.addEventListener("biotraj_call_status_change", handleStatusChange);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("biotraj_meet_url_change", handleUrlChange);
      window.removeEventListener("biotraj_call_status_change", handleStatusChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const handlePatientJoinCall = async (appointment) => {
    setActiveVideoAppointment(appointment);
    setPatientCallPhase("joining");
    setPatientCallError("");

    try {
      // Fetch attendee token from backend Daily API
      const result = await consultationService.joinConsultation(appointment.id);

      if (patientDailyFrameRef.current) {
        try {
          patientDailyFrameRef.current.destroy();
        } catch {
          // ignore
        }
      }

      // Small delay to allow container mount
      setTimeout(async () => {
        if (!patientCallContainerRef.current) return;

        const frame = DailyIframe.createFrame(patientCallContainerRef.current, {
          iframeStyle: {
            width: "100%",
            height: "100%",
            border: "0",
            borderRadius: "16px",
            minHeight: "420px",
          },
          showLeaveButton: true,
          showFullscreenButton: true,
        });

        patientDailyFrameRef.current = frame;

        frame.on("joining-meeting", () => setPatientCallPhase("joining"));
        frame.on("joined-meeting", () => setPatientCallPhase("connected"));
        frame.on("left-meeting", () => handlePatientLeaveCall());
        frame.on("camera-error", (e) => {
          setPatientCallError("Camera or microphone permission error: " + (e?.errorMsg?.errorMsg || e?.errorMsg || "Denied"));
        });
        frame.on("error", (e) => {
          setPatientCallError(e?.errorMsg || "Failed to establish video connection.");
          setPatientCallPhase("error");
        });

        await frame.join({
          url: result.roomUrl,
          token: result.token,
        });
      }, 100);
    } catch (err) {
      console.error("Failed to join video consultation:", err);
      setPatientCallError(err?.message || "Could not join video consultation.");
      setPatientCallPhase("error");
    }
  };

  const handlePatientLeaveCall = () => {
    if (patientDailyFrameRef.current) {
      try {
        patientDailyFrameRef.current.destroy();
      } catch {
        // ignore
      }
      patientDailyFrameRef.current = null;
    }
    setActiveVideoAppointment(null);
    setPatientCallPhase("idle");
    setPatientCallError("");
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (patientDailyFrameRef.current) {
        try {
          patientDailyFrameRef.current.destroy();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // Booking
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [appointmentType, setAppointmentType] = useState("in-person");
  const [reason, setReason] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState("");

  // Load approved doctors
  useEffect(() => {
    let active = true;

    const loadDoctors = async () => {
      setLoading(true);
      setError("");

      try {
        const result = await approvedDoctorService.getAll();

        if (active) {
          setDoctors(result);
        }
      } catch (err) {
        console.error("Failed to load doctors:", err);

        if (active) {
          setError(err.message || "Unable to load approved doctors.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadDoctors();

    return () => {
      active = false;
    };
  }, [reloadKey]);

  // Subscribe to the logged-in patient's appointments.
  // Firestore updates this list automatically when the doctor changes a status.
  useEffect(() => {
    if (activeTab !== "history") return;

    setHistoryLoading(true);
    setHistoryError("");

    const unsubscribe = appointmentService.subscribeToPatientAppointments(
      (data) => {
        setAppointments(data);
        setHistoryLoading(false);
        setHistoryError("");
      },
      (err) => {
        console.error("Unable to load patient appointment history:", err);
        setHistoryError(
          err.message || "Unable to load your appointment history."
        );
        setHistoryLoading(false);
      }
    );

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [activeTab]);

  // Specialties
  const specialties = useMemo(() => {
    const unique = [
      ...new Set(
        doctors
          .map((doctor) => doctor.specialty?.trim())
          .filter(Boolean)
      ),
    ];

    return [
      "All Specialties",
      ...unique.sort((a, b) => a.localeCompare(b)),
    ];
  }, [doctors]);

  // Doctor search
  const filteredDoctors = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return doctors.filter((doctor) => {
      const matchesSpecialty =
        selectedSpecialty === "All Specialties" ||
        doctor.specialty === selectedSpecialty;

      const searchableText = [
        doctor.name,
        doctor.fullName,
        doctor.specialty,
        doctor.qualification,
        doctor.clinic,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        matchesSpecialty &&
        (!query || searchableText.includes(query))
      );
    });
  }, [doctors, selectedSpecialty, searchQuery]);

  // History filter
  const filteredAppointments = useMemo(() => {
    if (historyFilter === "ALL") return appointments;

    return appointments.filter(
      (appointment) => appointment.status === historyFilter
    );
  }, [appointments, historyFilter]);

  const appointmentCounts = useMemo(() => {
    return {
      ALL: appointments.length,
      PENDING: appointments.filter((a) => a.status === "PENDING").length,
      ACCEPTED: appointments.filter((a) => a.status === "ACCEPTED").length,
      REJECTED: appointments.filter((a) => a.status === "REJECTED").length,
      COMPLETED: appointments.filter((a) => a.status === "COMPLETED").length,
    };
  }, [appointments]);

  const handleRetry = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 450));
    setReloadKey((previous) => previous + 1);
  };

  const openBooking = (doctor) => {
    setSelectedDoctor(doctor);
    setAppointmentDate("");
    setAppointmentTime("");
    setAppointmentType("in-person");
    setReason("");
    setBookingError("");
    setBookingSuccess("");
    setShowBookingModal(true);
  };

  const closeBooking = () => {
    if (bookingLoading) return;

    setShowBookingModal(false);
    setSelectedDoctor(null);
    setBookingError("");
  };

  const handleBooking = async (event) => {
    event.preventDefault();

    if (!selectedDoctor) {
      setBookingError("Please select a doctor.");
      return;
    }

    if (!appointmentDate || !appointmentTime) {
      setBookingError("Please select a date and time.");
      return;
    }

    const requestedDateTime = new Date(
      `${appointmentDate}T${appointmentTime}`
    );

    if (
      Number.isNaN(requestedDateTime.getTime()) ||
      requestedDateTime <= new Date()
    ) {
      setBookingError("Please select a future date and time.");
      return;
    }

    try {
      setBookingLoading(true);
      setBookingError("");

      await appointmentService.createAppointment(selectedDoctor, {
        appointmentDate,
        appointmentTime,
        type: appointmentType,
        reason,
      });

      setShowBookingModal(false);
      setSelectedDoctor(null);
      setBookingSuccess(
        "Appointment request submitted successfully. You can track its status in Past Doctor Visits."
      );
    } catch (err) {
      console.error("Appointment booking failed:", err);
      setBookingError(
        err.message || "Unable to submit appointment request."
      );
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Talk to Doctor
          </h1>
          <p className="text-[17px] text-slate-600 dark:text-slate-400 mt-1">
            Discover and request consultations with approved doctors.
          </p>
        </div>

        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-white dark:bg-[#2B1E15] border border-slate-200 dark:border-slate-800 text-sm font-semibold">
          <button
            onClick={() => setActiveTab("browse")}
            className={`px-5 py-2.5 rounded-xl ${
              activeTab === "browse"
                ? "bg-cyan-500 text-slate-950 font-bold"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            Find a Doctor
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`px-5 py-2.5 rounded-xl ${
              activeTab === "history"
                ? "bg-cyan-500 text-slate-950 font-bold"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            Past Doctor Visits
          </button>
        </div>
      </div>

      {/* PRIORITY PATIENT FAST-TRACK NOTICE */}
      {priorityStatus?.isPriority && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-red-600/15 via-rose-600/10 to-red-600/5 border-2 border-red-500 text-red-600 dark:text-red-400 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md shadow-red-500/10 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-600 text-white shrink-0 shadow-sm">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-wider text-red-600 dark:text-red-400">
                🚨 FAST-TRACK CLINICAL PRIORITY ROUTING ACTIVE
              </div>
              <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                Danger Condition: {priorityStatus.primaryDisease}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Because you are flagged with an active critical condition, your consultation requests are routed with zero-minute hold emergency physician priority.
              </p>
            </div>
          </div>
          <span className="self-start sm:self-auto px-3 py-1 rounded-full bg-red-600 text-white text-xs font-black uppercase tracking-wider shrink-0 shadow-xs">
            EXPEDITED QUEUE
          </span>
        </div>
      )}

      {/* SUCCESS MESSAGE */}
      {bookingSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm flex items-start gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-bold">Request submitted</p>
            <p>{bookingSuccess}</p>
          </div>
          <button
            onClick={() => setBookingSuccess("")}
            className="ml-auto"
            aria-label="Dismiss"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {/* DOCTOR DISCOVERY */}
      {activeTab === "browse" && (
        <div className="space-y-6">
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <ShieldCheck className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-emerald-700 dark:text-emerald-400">
                Verified doctor listings
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Only profiles approved by an administrator are displayed.
              </p>
            </div>
          </div>

          {/* SEARCH */}
          <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#2B1E15] border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search doctor or specialty..."
                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-50 dark:bg-[#1F150E] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1">
              {specialties.map((specialty) => (
                <button
                  key={specialty}
                  onClick={() => setSelectedSpecialty(specialty)}
                  className={`px-4 py-2.5 rounded-2xl text-sm font-semibold whitespace-nowrap ${
                    selectedSpecialty === specialty
                      ? "bg-cyan-500 text-slate-950"
                      : "bg-slate-50 dark:bg-[#1F150E] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {specialty}
                </button>
              ))}
            </div>
          </div>

          {/* LOADING */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <RefreshCw className="w-9 h-9 text-cyan-500 animate-spin mb-4" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Loading approved doctors
              </h3>
              <p className="text-slate-500 mt-1">
                Fetching doctor profiles from Firestore.
              </p>
            </div>
          )}

          {/* ERROR */}
          {!loading && error && (
            <div className="p-8 rounded-3xl border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/20 text-center">
              <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Unable to load doctors
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mt-2">
                {error}
              </p>
              <button
                onClick={handleRetry}
                className="mt-5 px-6 py-3 rounded-xl bg-cyan-500 text-slate-950 font-bold"
              >
                Try Again
              </button>
            </div>
          )}

          {/* EMPTY */}
          {!loading && !error && doctors.length === 0 && (
            <div className="p-10 rounded-3xl bg-white dark:bg-[#2B1E15] border border-slate-200 dark:border-slate-800 text-center">
              <Stethoscope className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                No approved doctors yet
              </h3>
              <p className="text-slate-500 mt-2">
                Approved doctor profiles will appear here after verification.
              </p>
              <button
                onClick={handleRetry}
                disabled={loading}
                className="mt-5 inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-300 dark:border-slate-700 hover:border-cyan-500 cursor-pointer active:scale-95 transition-all disabled:opacity-60"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-500' : ''}`} />
                <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            </div>
          )}

          {/* NO SEARCH RESULTS */}
          {!loading &&
            !error &&
            doctors.length > 0 &&
            filteredDoctors.length === 0 && (
              <div className="p-10 rounded-3xl bg-white dark:bg-[#2B1E15] border border-slate-200 dark:border-slate-800 text-center">
                <Search className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  No matching doctors
                </h3>
                <p className="text-slate-500 mt-2">
                  Try another name or specialty.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedSpecialty("All Specialties");
                  }}
                  className="mt-4 text-cyan-600 font-semibold"
                >
                  Clear filters
                </button>
              </div>
            )}

          {/* DOCTOR CARDS */}
          {!loading && !error && filteredDoctors.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {filteredDoctors.length} approved doctor
                  {filteredDoctors.length !== 1 ? "s" : ""} found
                </p>

                <button
                  onClick={handleRetry}
                  disabled={loading}
                  className="flex items-center gap-2 text-sm font-semibold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer active:scale-95 transition-all disabled:opacity-60"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-500' : ''}`} />
                  <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredDoctors.map((doctor) => (
                  <div
                    key={doctor.uid}
                    className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#2B1E15] border border-slate-200 dark:border-slate-800 shadow-sm hover:border-cyan-500/40 transition-all space-y-5"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                        <UserRound className="w-8 h-8 text-cyan-500" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white break-words">
                          {doctor.name}
                        </h3>
                        <p className="text-sm text-cyan-600 dark:text-cyan-400 font-semibold mt-1">
                          {doctor.specialty}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                          Administrator approved
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
                      {doctor.qualification && (
                        <div className="flex items-start gap-3">
                          <Stethoscope className="w-5 h-5 text-slate-400 shrink-0" />
                          <div>
                            <p className="text-xs text-slate-500">
                              Qualification
                            </p>
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                              {doctor.qualification}
                            </p>
                          </div>
                        </div>
                      )}

                      {doctor.clinic && (
                        <div className="flex items-start gap-3">
                          <CalendarClock className="w-5 h-5 text-slate-400 shrink-0" />
                          <div>
                            <p className="text-xs text-slate-500">
                              Clinic / Organization
                            </p>
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                              {doctor.clinic}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-4">
                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                        Public profile from verified application
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => openBooking(doctor)}
                          className="py-3 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2"
                        >
                          <CalendarClock className="w-4 h-4" />
                          Book Appointment
                        </button>

                        <button
                          type="button"
                          disabled
                          title="Video consultation is not connected yet."
                          className="py-3 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-semibold text-sm cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          <Video className="w-4 h-4" />
                          Video soon
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* PATIENT APPOINTMENT HISTORY */}
      {activeTab === "history" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Your Appointments
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Live updates from your doctor appointment requests.
              </p>
            </div>

            <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Firestore updates
            </div>
          </div>

          {/* STATUS COUNTS */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { key: "ALL", label: "All", color: "text-slate-700 dark:text-white" },
              { key: "PENDING", label: "Pending", color: "text-amber-600" },
              { key: "ACCEPTED", label: "Accepted", color: "text-blue-600" },
              { key: "REJECTED", label: "Rejected", color: "text-rose-600" },
              { key: "COMPLETED", label: "Completed", color: "text-emerald-600" },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => setHistoryFilter(item.key)}
                className={`p-4 rounded-2xl border text-left transition ${
                  historyFilter === item.key
                    ? "border-cyan-500 bg-cyan-500/10"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-[#2B1E15]"
                }`}
              >
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {item.label}
                </p>
                <p className={`text-2xl font-extrabold mt-1 ${item.color}`}>
                  {appointmentCounts[item.key]}
                </p>
              </button>
            ))}
          </div>

          {/* HISTORY LOADING */}
          {historyLoading && (
            <div className="py-16 text-center rounded-3xl bg-white dark:bg-[#2B1E15] border border-slate-200 dark:border-slate-800">
              <RefreshCw className="w-9 h-9 text-cyan-500 animate-spin mx-auto mb-3" />
              <p className="font-semibold text-slate-800 dark:text-white">
                Loading your appointments...
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Connecting to your Firestore records.
              </p>
            </div>
          )}

          {/* HISTORY ERROR */}
          {!historyLoading && historyError && (
            <div className="p-6 rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/20">
              <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-semibold">
                <AlertCircle size={20} />
                Unable to load appointment history
              </div>
              <p className="text-sm mt-2 text-rose-700 dark:text-rose-300">
                {historyError}
              </p>
              <p className="text-xs mt-2 text-slate-500">
                Check that you are logged in and that your Firestore rules allow
                patients to read appointments where patientId matches their UID.
              </p>
            </div>
          )}

          {/* EMPTY HISTORY */}
          {!historyLoading &&
            !historyError &&
            appointments.length === 0 && (
              <div className="p-10 rounded-3xl bg-white dark:bg-[#2B1E15] border border-slate-200 dark:border-slate-800 text-center">
                <History className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  No appointments yet
                </h3>
                <p className="text-slate-500 mt-2">
                  When you request a consultation, it will appear here.
                </p>
                <button
                  onClick={() => setActiveTab("browse")}
                  className="mt-5 px-6 py-3 rounded-xl bg-cyan-500 text-slate-950 font-bold"
                >
                  Find a Doctor
                </button>
              </div>
            )}

          {/* FILTERED EMPTY STATE */}
          {!historyLoading &&
            !historyError &&
            appointments.length > 0 &&
            filteredAppointments.length === 0 && (
              <div className="p-8 rounded-2xl bg-white dark:bg-[#2B1E15] border border-slate-200 dark:border-slate-800 text-center">
                <ClipboardList className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                <h3 className="font-bold text-slate-900 dark:text-white">
                  No {historyFilter.toLowerCase()} appointments
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Try selecting another status filter.
                </p>
              </div>
            )}

          {/* APPOINTMENT CARDS */}
          {!historyLoading &&
            !historyError &&
            filteredAppointments.length > 0 && (
              <div className="space-y-4">
                {filteredAppointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#2B1E15] border border-slate-200 dark:border-slate-800 shadow-sm"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center shrink-0">
                          <Stethoscope className="w-6 h-6 text-cyan-500" />
                        </div>

                        <div>
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                            {appointment.doctorName || "Doctor"}
                          </h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            Doctor consultation
                          </p>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold w-fit ${getStatusStyle(
                          appointment.status
                        )}`}
                      >
                        {appointment.status || "PENDING"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5 pt-5 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-3">
                        <CalendarDays className="w-5 h-5 text-slate-400" />
                        <div>
                          <p className="text-xs text-slate-500">Date</p>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                            {formatAppointmentDate(appointment.appointmentDate)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Clock className="w-5 h-5 text-slate-400" />
                        <div>
                          <p className="text-xs text-slate-500">Time</p>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                            {formatAppointmentTime(appointment.appointmentTime)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {appointment.type === "video" ? (
                          <Video className="w-5 h-5 text-slate-400" />
                        ) : (
                          <MapPin className="w-5 h-5 text-slate-400" />
                        )}
                        <div>
                          <p className="text-xs text-slate-500">
                            Consultation type
                          </p>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                            {appointment.type === "video"
                              ? "Video consultation request"
                              : "Clinic / In-person"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <CalendarClock className="w-5 h-5 text-slate-400" />
                        <div>
                          <p className="text-xs text-slate-500">Request ID</p>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 break-all">
                            {appointment.id}
                          </p>
                        </div>
                      </div>
                    </div>

                    {appointment.reason && (
                      <div className="mt-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60">
                        <p className="text-xs font-semibold text-slate-500 mb-1">
                          Reason for consultation
                        </p>
                        <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                          {appointment.reason}
                        </p>
                      </div>
                    )}

                    {/* Video Consultation Action Card for Accepted Video Appointments */}
                    {appointment.status === "ACCEPTED" && appointment.type === "video" && (
                      <div className="mt-5 p-4 rounded-2xl bg-gradient-to-r from-teal-50 to-blue-50 dark:from-teal-950/20 dark:to-blue-950/20 border border-teal-200 dark:border-teal-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 shadow-sm">
                            <GoogleMeetIcon className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                                {isHindi ? "गूगल मीट वीडियो परामर्श" : "Google Meet Video Consultation"}
                              </h4>
                              {appointment.callStatus === "ACTIVE" && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                                  Live Now
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                              {appointment.callStatus === "ACTIVE"
                                ? isHindi
                                  ? "डॉक्टर गूगल मीट रूम में उपस्थित हैं! कृपया नीचे क्लिक करके मीटिंग जॉइन करें।"
                                  : "Doctor is in Google Meet room! Click below to join the live video session."
                                : isHindi
                                ? "स्वीकृत परामर्श — मीटिंग लिंक नीचे उपलब्ध है। समय होने पर गूगल मीट खोलें।"
                                : "Accepted appointment — Google Meet room link is ready."}
                            </p>
                            <p className="text-[11px] font-mono text-teal-600 dark:text-teal-400 mt-1">
                              {appointment.meetingUrl || getMeetingUrlOverride(appointment.id) || getGoogleMeetUrl(appointment.id)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopyMeetLink(appointment.id, appointment.meetingUrl || getMeetingUrlOverride(appointment.id) || getGoogleMeetUrl(appointment.id))}
                            className="px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center gap-1.5"
                          >
                            {copiedAptId === appointment.id ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                {isHindi ? "कॉपी हो गया" : "Copied!"}
                              </>
                            ) : (
                              <>
                                <ClipboardList className="w-3.5 h-3.5" />
                                {isHindi ? "लिंक कॉपी करें" : "Copy Link"}
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenGoogleMeet(appointment)}
                            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all ${
                              appointment.callStatus === "ACTIVE"
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse"
                                : "bg-teal-600 hover:bg-teal-700 text-white"
                            }`}
                          >
                            <GoogleMeetIcon className="w-4 h-4" />
                            {appointment.callStatus === "ACTIVE"
                              ? isHindi
                                ? "गूगल मीट में जुड़ें (Join Now)"
                                : "Join Google Meet Now"
                              : isHindi
                              ? "गूगल मीट खोलें"
                              : "Open Google Meet"}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="mt-5 flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <p>{getStatusDescription(appointment.status)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      )}

      {/* BOOKING MODAL */}
      {showBookingModal && selectedDoctor && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Request an Appointment
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  With {selectedDoctor.name}
                </p>
                <p className="text-xs text-cyan-600 mt-1">
                  {selectedDoctor.specialty}
                </p>
              </div>

              <button
                onClick={closeBooking}
                disabled={bookingLoading}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close booking form"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleBooking} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">
                  Appointment date
                </label>
                <div className="relative">
                  <CalendarDays
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={18}
                  />
                  <input
                    type="date"
                    required
                    min={getLocalDate()}
                    value={appointmentDate}
                    onChange={(event) =>
                      setAppointmentDate(event.target.value)
                    }
                    className="w-full pl-10 pr-3 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">
                  Preferred time
                </label>
                <div className="relative">
                  <Clock
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={18}
                  />
                  <input
                    type="time"
                    required
                    value={appointmentTime}
                    onChange={(event) =>
                      setAppointmentTime(event.target.value)
                    }
                    className="w-full pl-10 pr-3 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  This is a requested time, not a confirmed available slot.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">
                  Consultation type
                </label>
                <select
                  value={appointmentType}
                  onChange={(event) => setAppointmentType(event.target.value)}
                  className="w-full px-3 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                >
                  <option value="in-person">Clinic / In-person</option>
                  <option value="video">Video consultation request</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">
                  Reason for consultation (optional)
                </label>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={1000}
                  rows={3}
                  placeholder="Briefly describe why you need a consultation..."
                  className="w-full px-3 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white resize-y"
                />
              </div>

              {bookingError && (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm">
                  <AlertCircle className="inline mr-2" size={16} />
                  {bookingError}
                </div>
              )}

              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs">
                Submitting this form sends an appointment request. The
                appointment is not confirmed until the doctor accepts it.
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeBooking}
                  disabled={bookingLoading}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={bookingLoading}
                  className="flex-1 px-4 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold disabled:opacity-50"
                >
                  {bookingLoading ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* In-App Daily Video Consultation Modal for Patient */}
      {activeVideoAppointment && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full p-5 shadow-2xl flex flex-col space-y-4 max-h-[95vh] overflow-hidden">
            <div className="flex items-center justify-between text-white pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600/30 flex items-center justify-center text-purple-400">
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">
                    {activeVideoAppointment.doctorName || "Doctor Consultation"}
                  </h3>
                  <p className="text-xs text-slate-400">
                    In-app video consultation via Daily Prebuilt
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handlePatientLeaveCall}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
                title="Close video call"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {patientCallError && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{patientCallError}</span>
              </div>
            )}

            {/* Embedded Daily Frame Container */}
            <div
              ref={patientCallContainerRef}
              className="w-full aspect-video min-h-[440px] rounded-2xl overflow-hidden bg-black flex items-center justify-center relative"
            >
              {patientCallPhase === "joining" && (
                <div className="text-center text-slate-400">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-purple-400" />
                  <p className="text-sm font-semibold text-white">Connecting to secure consultation room...</p>
                  <p className="text-xs text-slate-400 mt-1">Please allow camera and mic access when prompted</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Zero-knowledge private token session (Daily.co)
              </span>

              <button
                type="button"
                onClick={handlePatientLeaveCall}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition-all"
              >
                Leave Call
              </button>
            </div>
          </div>
        </div>
      )}

      <DisclaimerBanner />
    </div>
  );
}