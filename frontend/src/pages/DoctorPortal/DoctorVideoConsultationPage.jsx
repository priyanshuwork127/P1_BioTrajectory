import React, { useEffect, useMemo, useState, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import DailyIframe from "@daily-co/daily-js";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  PhoneCall,
  MessageSquare,
  User,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Send,
  FileText,
  RefreshCw,
  LockKeyhole,
  Calendar,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ClipboardList,
} from "lucide-react";

import { useDoctorAuth } from "../../context/DoctorAuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { doctorPatientService } from "../../services/doctorPatientService";
import {
  appointmentService,
  setCallStatusOverride,
  getGoogleMeetUrl,
  setMeetingUrlOverride,
  getMeetingUrlOverride
} from "../../services/appointmentService";
import { consultationService } from "../../services/consultationService";

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

export default function DoctorVideoConsultationPage() {
  const [searchParams] = useSearchParams();
  const { doctor, isVerified } = useDoctorAuth();
  const { t, isHindi } = useLanguage();

  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(
    searchParams.get("patientId") || ""
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [permissionError, setPermissionError] = useState("");

  // Consultation State (Google Meet & Daily)
  const [providerMode, setProviderMode] = useState("google_meet"); // "google_meet" | "daily"
  const [customMeetUrl, setCustomMeetUrl] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [dailyStatus, setDailyStatus] = useState({ isConfigured: true, provider: "google_meet", message: "" });
  const [callPhase, setCallPhase] = useState("idle"); // idle | starting | joining | connected | ended | error
  const [activeRoomUrl, setActiveRoomUrl] = useState("");

  const callContainerRef = useRef(null);
  const dailyFrameRef = useRef(null);

  const [newMessage, setNewMessage] = useState("");
  const [chatMessages, setChatMessages] = useState([]);

  // Check Daily backend configuration on mount
  useEffect(() => {
    let mounted = true;
    consultationService.getStatus().then((res) => {
      if (mounted) {
        setDailyStatus(res);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Cleanup Daily call frame on unmount
  useEffect(() => {
    return () => {
      if (dailyFrameRef.current) {
        try {
          dailyFrameRef.current.destroy();
        } catch (e) {
          console.warn("Error destroying Daily frame on unmount:", e);
        }
        dailyFrameRef.current = null;
      }
    };
  }, []);

  // Subscribe to patient roster
  useEffect(() => {
    if (!doctor?.uid) {
      setPatients([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const unsubscribePatients = doctorPatientService.subscribeToDoctorPatients(
      doctor.uid,
      (data) => {
        setPatients(data);
        setLoading(false);
      },
      (err) => {
        console.error("Video consultation patient roster error:", err);
        setError(err?.message || "Unable to load patients.");
        setLoading(false);
      }
    );

    const unsubscribeAppointments = appointmentService.subscribeToDoctorAppointments(
      doctor.uid,
      (data) => {
        setAppointments(data);
      },
      (err) => {
        console.warn("Appointments subscription note:", err);
      }
    );

    return () => {
      unsubscribePatients?.();
      unsubscribeAppointments?.();
    };
  }, [doctor?.uid]);

  // Handle selected patient from URL or roster
  useEffect(() => {
    if (!patients.length) {
      setSelectedPatientId("");
      return;
    }

    const requestedId = searchParams.get("patientId");
    const requestedPatient = patients.find(
      (p) => p.id === requestedId || p.patientId === requestedId
    );

    const existingSelection = patients.find(
      (p) => p.id === selectedPatientId || p.patientId === selectedPatientId
    );

    if (requestedPatient) {
      setSelectedPatientId(requestedPatient.patientId);
    } else if (!existingSelection) {
      setSelectedPatientId(patients[0].patientId);
    }
  }, [patients, searchParams, selectedPatientId]);

  const selectedPatient = useMemo(
    () => patients.find((p) => p.patientId === selectedPatientId) || null,
    [patients, selectedPatientId]
  );

  // Find matching accepted video appointment for this patient
  const targetAppointment = useMemo(() => {
    if (!selectedPatientId) return null;

    const requestedAptId = searchParams.get("appointmentId");
    if (requestedAptId) {
      const found = appointments.find((a) => a.id === requestedAptId);
      if (found) return found;
    }

    // Otherwise find the first ACCEPTED video appointment for this patient
    return appointments.find(
      (a) =>
        (a.patientId === selectedPatientId || a.id === selectedPatientId) &&
        a.type === "video" &&
        a.status === "ACCEPTED"
    ) || appointments.find(
      (a) => a.patientId === selectedPatientId || a.id === selectedPatientId
    ) || null;
  }, [appointments, selectedPatientId, searchParams]);

  const isEligibleToStart = useMemo(() => {
    return (
      isVerified &&
      targetAppointment &&
      targetAppointment.status === "ACCEPTED" &&
      targetAppointment.type === "video"
    );
  }, [isVerified, targetAppointment]);

  // Compute current Google Meet URL for selected target appointment
  const currentMeetUrl = useMemo(() => {
    if (!targetAppointment?.id) return "";
    return getGoogleMeetUrl(targetAppointment.id, customMeetUrl);
  }, [targetAppointment?.id, customMeetUrl]);

  // Copy Google Meet link with clipboard feedback
  const handleCopyMeetLink = (url) => {
    const linkToCopy = url || currentMeetUrl || activeRoomUrl;
    if (!linkToCopy) return;
    navigator.clipboard.writeText(linkToCopy).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }).catch(() => {});
  };

  // Start Google Meet Consultation
  const handleStartGoogleMeet = async () => {
    if (!targetAppointment?.id) {
      setError(isHindi ? "कोई वैध अपॉइंटमेंट नहीं मिला।" : "No valid appointment found.");
      return;
    }

    if (!isEligibleToStart) {
      setError(
        isHindi
          ? "केवल स्वीकृत वीडियो अपॉइंटमेंट के लिए कॉल शुरू की जा सकती है।"
          : "Consultations can only be started for accepted video appointments."
      );
      return;
    }

    setError("");
    setPermissionError("");
    setCallPhase("starting");

    try {
      const urlToOpen = currentMeetUrl;
      const result = await consultationService.startConsultation(
        targetAppointment.id,
        "google_meet",
        urlToOpen
      );

      const finalUrl = result.roomUrl || urlToOpen;
      setActiveRoomUrl(finalUrl);
      setMeetingUrlOverride(targetAppointment.id, finalUrl);
      setCallStatusOverride(targetAppointment.id, "ACTIVE");
      setCallPhase("connected");

      // Open Google Meet in new tab/window
      window.open(finalUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Failed to launch Google Meet:", err);
      setError(err?.message || "Failed to launch Google Meet consultation.");
      setCallPhase("error");
    }
  };

  const handleRefresh = async () => {
    if (!doctor?.uid) return;
    setRefreshing(true);
    setError("");

    try {
      const data = await doctorPatientService.getDoctorPatients(doctor.uid);
      setPatients(data);
      const statusRes = await consultationService.getStatus();
      setDailyStatus(statusRes);
    } catch (err) {
      console.error("Patient roster refresh failed:", err);
      setError(err?.message || "Unable to refresh patients.");
    } finally {
      setRefreshing(false);
    }
  };

  // Start Consultation Click Handler
  const handleStartConsultation = async () => {
    if (!targetAppointment?.id) {
      setError(isHindi ? "कोई वैध अपॉइंटमेंट नहीं मिला।" : "No valid appointment found.");
      return;
    }

    if (!isEligibleToStart) {
      setError(
        isHindi
          ? "केवल स्वीकृत वीडियो अपॉइंटमेंट के लिए कॉल शुरू की जा सकती है।"
          : "Consultations can only be started for accepted video appointments."
      );
      return;
    }

    setError("");
    setPermissionError("");
    setCallPhase("starting");

    try {
      // 1. Request room and token from backend Daily API
      const result = await consultationService.startConsultation(targetAppointment.id);
      setActiveRoomUrl(result.roomUrl);

      // 2. Mark appointment as active locally & update status override
      setCallStatusOverride(targetAppointment.id, "ACTIVE");

      // 3. Clean up any existing iframe before creating a new one
      if (dailyFrameRef.current) {
        try {
          dailyFrameRef.current.destroy();
        } catch {
          // ignore
        }
      }

      setCallPhase("joining");

      // 4. Create and embed Daily Prebuilt iframe
      const frame = DailyIframe.createFrame(callContainerRef.current, {
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

      dailyFrameRef.current = frame;

      // Event listeners
      frame.on("joining-meeting", () => {
        setCallPhase("joining");
      });

      frame.on("joined-meeting", () => {
        setCallPhase("connected");
      });

      frame.on("left-meeting", () => {
        handleEndConsultation();
      });

      frame.on("camera-error", (e) => {
        const msg = e?.errorMsg?.errorMsg || e?.errorMsg || "Camera or microphone permission error.";
        setPermissionError(msg);
      });

      frame.on("error", (e) => {
        console.error("Daily frame error:", e);
        setError(e?.errorMsg || "Video conferencing provider encountered an error.");
        setCallPhase("error");
      });

      // 5. Join meeting with doctor host token
      await frame.join({
        url: result.roomUrl,
        token: result.token,
      });
    } catch (err) {
      console.error("Failed to start video consultation:", err);
      setCallPhase("error");
      setError(err?.message || "Failed to start consultation room with Daily.co.");
    }
  };

  // End Consultation Handler
  const handleEndConsultation = async () => {
    if (targetAppointment?.id) {
      try {
        await consultationService.endConsultation(targetAppointment.id);
      } catch (err) {
        console.warn("End consultation notification error:", err);
      }
      setCallStatusOverride(targetAppointment.id, "ENDED");
    }

    if (dailyFrameRef.current) {
      try {
        dailyFrameRef.current.destroy();
      } catch {
        // ignore
      }
      dailyFrameRef.current = null;
    }

    setCallPhase("ended");
  };

  const handleSendMessage = (event) => {
    event.preventDefault();
    if (!newMessage.trim()) return;

    setChatMessages((previous) => [
      ...previous,
      {
        id: `${Date.now()}-${previous.length}`,
        text: newMessage.trim(),
        sender: "doctor",
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);
    setNewMessage("");
  };

  const patientName =
    selectedPatient?.name ||
    selectedPatient?.patientName ||
    targetAppointment?.patientName ||
    "Patient";

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
              {t("consultation.videoConsultation", {}, "Video Consultation")}
            </span>

            {isVerified && (
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Verified Doctor
              </span>
            )}

            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-teal-100 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 flex items-center gap-1.5 shadow-sm">
              <GoogleMeetIcon className="w-3.5 h-3.5" />
              Google Meet Consultation Ready
            </span>
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
            {isHindi ? "वीडियो परामर्श कार्यक्षेत्र" : "Video Consultation Workspace"}
          </h1>

          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isHindi
              ? "स्वीकृत वीडियो नियुक्तियों के लिए गूगल मीट (Google Meet) के माध्यम से सुरक्षित परामर्श संचालित करें।"
              : "Conduct secure, clinical video consultations via Google Meet with accepted patients."}
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading || refreshing}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          {isHindi ? "रिफ्रेश" : "Refresh"}
        </button>
      </div>

      {/* Google Meet Info Banner */}
      <div className="rounded-2xl p-4 bg-gradient-to-r from-teal-50 to-blue-50 dark:from-teal-950/20 dark:to-blue-950/20 border border-teal-200/80 dark:border-teal-800/50 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-800 flex items-center justify-center shrink-0">
            <GoogleMeetIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-teal-950 dark:text-teal-200 flex items-center gap-1.5">
              Google Meet Telemedicine Integration
            </h2>
            <p className="text-xs text-teal-800/80 dark:text-teal-300/80 mt-0.5">
              Clinical consultations launch securely in dedicated Google Meet windows with automatic meeting links and real-time status synchronization.
            </p>
          </div>
        </div>
      </div>

      {/* Camera / Mic Permission Alert */}
      {permissionError && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-sm flex items-start gap-2">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">{t("consultation.cameraPermissionDenied", {}, "Camera or microphone permission error.")}</p>
            <p className="text-xs mt-0.5">{permissionError}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-sm">
          {error}
        </div>
      )}

      {/* Patient roster & Consultation workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Patient / Appointment list */}
        <div className="lg:col-span-1 rounded-2xl p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <User className="w-5 h-5 text-blue-500" />
              {isHindi ? "मरीज और नियुक्तियां" : "Patients & Appointments"}
            </h2>
            <span className="text-xs text-slate-500">{loading ? "—" : patients.length}</span>
          </div>

          {loading ? (
            <div className="py-8 text-center text-slate-500 text-sm">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              Loading roster...
            </div>
          ) : patients.length === 0 ? (
            <div className="py-8 text-center">
              <User className="w-8 h-8 mx-auto text-slate-400 mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                No patients available
              </p>
              <Link
                to="/doctor/appointments"
                className="inline-block mt-3 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                View Appointments
              </Link>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {patients.map((patient) => {
                const name = patient.name || patient.patientName || "Patient";
                const isSelected = selectedPatientId === patient.patientId;
                const patientApts = appointments.filter(
                  (a) => a.patientId === patient.patientId
                );
                const hasAcceptedVideo = patientApts.some(
                  (a) => a.type === "video" && a.status === "ACCEPTED"
                );

                return (
                  <button
                    type="button"
                    key={patient.patientId}
                    onClick={() => {
                      setSelectedPatientId(patient.patientId);
                      if (callPhase === "connected" || callPhase === "joining") {
                        if (window.confirm("Switching patients will leave the current consultation. Proceed?")) {
                          handleEndConsultation();
                        }
                      }
                    }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-950/30 border-blue-400 dark:border-blue-700"
                        : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-blue-300"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold shrink-0">
                      {name.charAt(0).toUpperCase()}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {name}
                        </p>
                        {hasAcceptedVideo && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500" title="Accepted Video Appointment Ready" />
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        {patient.nextFollowUp || patient.status}
                      </p>
                    </div>

                    {isSelected && (
                      <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column: Consultation Workspace */}
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-2xl p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 flex items-center justify-center">
                  <Video className="w-6 h-6" />
                </div>

                <div>
                  <h2 className="font-bold text-slate-900 dark:text-white">
                    {t("consultation.consultationWorkspace", {}, "Consultation Workspace")}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {selectedPatient ? patientName : "Select a patient to continue"}
                  </p>
                </div>
              </div>

              {/* Consultation Status Pill */}
              <div className="flex items-center gap-2">
                {callPhase === "connected" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    {t("consultation.callActive", {}, "Consultation Live")}
                  </span>
                )}
                {callPhase === "joining" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    {t("consultation.joiningConsultation", {}, "Joining...")}
                  </span>
                )}
                {callPhase === "ended" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {t("consultation.callEndedSuccess", {}, "Consultation Ended")}
                  </span>
                )}
              </div>
            </div>

            {/* Video Box / Container */}
            {!selectedPatient ? (
              <div className="aspect-video rounded-2xl bg-slate-950 flex flex-col items-center justify-center text-center p-6">
                <VideoOff className="w-12 h-12 text-slate-500 mb-3" />
                <p className="text-white font-semibold">No patient selected</p>
                <p className="text-xs text-slate-400 mt-1">
                  Choose an appointment from the roster to start or join a consultation.
                </p>
              </div>
            ) : callPhase === "connected" && providerMode === "google_meet" ? (
              <div className="aspect-video rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-teal-950/80 border border-teal-500/30 flex flex-col items-center justify-center text-center p-6 relative overflow-hidden">
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    Google Meet Active
                  </span>
                </div>

                <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center p-3 mb-4 shadow-xl">
                  <GoogleMeetIcon className="w-12 h-12" />
                </div>

                <h3 className="text-xl font-bold text-white">Google Meet Consultation Live</h3>
                <p className="text-xs text-teal-300 mt-1">
                  Patient: <span className="font-semibold text-white">{patientName}</span> ({selectedPatient?.patientId})
                </p>

                <div className="mt-4 px-4 py-2 rounded-xl bg-black/40 border border-white/10 text-xs font-mono text-teal-300 flex items-center gap-2">
                  <span>{activeRoomUrl || currentMeetUrl}</span>
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => window.open(activeRoomUrl || currentMeetUrl, "_blank", "noopener,noreferrer")}
                    className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition-all"
                  >
                    <GoogleMeetIcon className="w-4 h-4" />
                    Return to Google Meet Window
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyMeetLink(activeRoomUrl || currentMeetUrl)}
                    className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/20 flex items-center gap-2 transition-all"
                  >
                    {copiedLink ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <ClipboardList className="w-4 h-4" />
                        Copy Patient Link
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleEndConsultation}
                    className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs flex items-center gap-2 transition-all"
                  >
                    <PhoneOff className="w-4 h-4" />
                    End Consultation
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {/* Embed Daily Call Frame Container */}
                <div
                  ref={callContainerRef}
                  className={`aspect-video rounded-2xl overflow-hidden bg-slate-950 transition-all ${
                    callPhase === "connected" && providerMode === "daily" ? "block min-h-[460px]" : "hidden"
                  }`}
                />

                {/* Placeholder view when call is not active */}
                {callPhase !== "connected" && (
                  <div className="aspect-video rounded-2xl bg-slate-950 flex flex-col items-center justify-center text-center p-6">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-teal-600 to-blue-600 flex items-center justify-center text-white text-3xl font-bold">
                      {patientName.charAt(0).toUpperCase()}
                    </div>

                    <h3 className="text-white text-lg font-bold mt-4">{patientName}</h3>

                    {targetAppointment ? (
                      <div className="mt-2 text-xs text-slate-300 space-y-1">
                        <p>
                          {targetAppointment.appointmentDate} · {targetAppointment.appointmentTime}
                        </p>
                        <p className="text-slate-400">
                          {targetAppointment.reason || "General Clinical Consultation"}
                        </p>
                      </div>
                    ) : (
                      <p className="text-slate-400 text-xs mt-1">
                        No accepted video appointments for this patient.
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      {isEligibleToStart ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Ready for Google Meet Video Consultation
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-semibold">
                          <LockKeyhole className="w-3.5 h-3.5" />
                          {targetAppointment?.status !== "ACCEPTED"
                            ? "Appointment Pending Doctor Acceptance"
                            : targetAppointment?.type !== "video"
                            ? "Clinic In-Person Appointment"
                            : "Session Not Connected"}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Call Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 mt-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    {callPhase === "connected" ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                        Consultation in progress via Google Meet
                      </span>
                    ) : callPhase === "starting" ? (
                      <span className="text-teal-600 dark:text-teal-400 flex items-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Launching Google Meet consultation...
                      </span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          Google Meet Room: <code className="text-teal-600 dark:text-teal-400 font-mono text-[11px]">{currentMeetUrl}</code>
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Click "Start Google Meet Consultation" to launch the room and notify the patient.
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5">
                    {callPhase === "connected" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleCopyMeetLink(activeRoomUrl || currentMeetUrl)}
                          className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5"
                        >
                          {copiedLink ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <ClipboardList className="w-3.5 h-3.5" />}
                          {copiedLink ? "Copied" : "Copy Link"}
                        </button>

                        <button
                          type="button"
                          onClick={handleEndConsultation}
                          className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
                        >
                          <PhoneOff className="w-4 h-4" />
                          End Call
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleCopyMeetLink(currentMeetUrl)}
                          disabled={!targetAppointment}
                          className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {copiedLink ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <ClipboardList className="w-3.5 h-3.5" />}
                          {copiedLink ? "Copied Link" : "Copy Meet Link"}
                        </button>

                        <button
                          type="button"
                          onClick={handleStartGoogleMeet}
                          disabled={!isEligibleToStart || callPhase === "starting"}
                          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700 text-white text-xs font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-all"
                        >
                          {callPhase === "starting" ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              Launching...
                            </>
                          ) : (
                            <>
                              <GoogleMeetIcon className="w-4 h-4" />
                              Start Google Meet Consultation
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Patient appointment details card */}
          {selectedPatient && (
            <div className="rounded-2xl p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-blue-500" />
                {isHindi ? "अपॉइंटमेंट जानकारी" : "Appointment Details"}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                  <p className="text-xs text-slate-500">Patient ID</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white break-all">
                    {selectedPatient.patientId}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                  <p className="text-xs text-slate-500">Appointment Type</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white capitalize">
                    {targetAppointment?.type || "video"} Consultation
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                  <p className="text-xs text-slate-500">Status</p>
                  <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    {targetAppointment?.status || selectedPatient.status}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                  <p className="text-xs text-slate-500">Scheduled Time</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {targetAppointment ? `${targetAppointment.appointmentDate} at ${targetAppointment.appointmentTime}` : selectedPatient.nextFollowUp}
                  </p>
                </div>
              </div>

              {targetAppointment?.reason && (
                <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                  <p className="text-xs text-slate-500 font-semibold mb-1">Chief Reason for Consultation</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{targetAppointment.reason}</p>
                </div>
              )}
            </div>
          )}

          {/* Consultation Notes */}
          <div className="rounded-2xl p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-2">
              <MessageSquare className="w-5 h-5 text-blue-500" />
              {t("consultation.sessionNotes", {}, "Clinical Consultation Notes")}
            </h3>

            <div className="space-y-3 max-h-52 overflow-y-auto">
              {chatMessages.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-5">
                  No notes recorded yet in this consultation session.
                </p>
              ) : (
                chatMessages.map((message) => (
                  <div key={message.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                    <div className="flex justify-between gap-2">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        {message.sender === "doctor" ? "Doctor Note" : "Observation"}
                      </span>
                      <span className="text-[10px] text-slate-400">{message.time}</span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">{message.text}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleSendMessage} className="flex gap-2 mt-4">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Write consultation note or observation..."
                className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={!newMessage.trim()}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-all"
                title="Add note"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
