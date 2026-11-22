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
} from "lucide-react";

import { useDoctorAuth } from "../../context/DoctorAuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { doctorPatientService } from "../../services/doctorPatientService";
import { appointmentService, setCallStatusOverride } from "../../services/appointmentService";
import { consultationService } from "../../services/consultationService";

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

  // Daily Consultation State
  const [dailyStatus, setDailyStatus] = useState({ isConfigured: false, message: "" });
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

            {dailyStatus.isConfigured ? (
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Daily Prebuilt Ready
              </span>
            ) : (
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Provider Setup Required
              </span>
            )}
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
            {isHindi ? "वीडियो परामर्श कार्यक्षेत्र" : "Video Consultation Workspace"}
          </h1>

          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isHindi
              ? "स्वीकृत वीडियो नियुक्तियों के लिए रीयल-टाइम परामर्श शुरू करें।"
              : "Start real-time in-app video consultations with accepted patients using Daily Prebuilt."}
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

      {/* Provider missing credentials alert */}
      {!dailyStatus.isConfigured && (
        <div className="rounded-2xl p-5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h2 className="font-bold text-sm text-amber-900 dark:text-amber-200">
                {t("consultation.dailyNotConfigured", {}, "Daily.co video consultation provider is not configured.")}
              </h2>
              <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-300 mt-1">
                {t(
                  "consultation.setupInstructions",
                  {},
                  "To enable real Daily video calls, set DAILY_API_KEY in backend/.env. Calls remain gracefully disabled until configured."
                )}
              </p>
              <div className="mt-2 text-xs font-mono bg-amber-100/70 dark:bg-amber-900/40 p-2 rounded-lg text-amber-900 dark:text-amber-200">
                DAILY_API_KEY=your_daily_api_key_here
              </div>
            </div>
          </div>
        </div>
      )}

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
            ) : (
              <div>
                {/* Embed Daily Call Frame Container */}
                <div
                  ref={callContainerRef}
                  className={`aspect-video rounded-2xl overflow-hidden bg-slate-950 transition-all ${
                    callPhase === "connected" || callPhase === "joining" ? "block min-h-[460px]" : "hidden"
                  }`}
                />

                {/* Placeholder view when call is not active */}
                {callPhase !== "connected" && callPhase !== "joining" && (
                  <div className="aspect-video rounded-2xl bg-slate-950 flex flex-col items-center justify-center text-center p-6">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white text-3xl font-bold">
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
                          Ready for Video Consultation
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
                        Consultation in progress via Daily Prebuilt
                      </span>
                    ) : callPhase === "starting" || callPhase === "joining" ? (
                      <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Initializing secure room & issuing meeting token...
                      </span>
                    ) : (
                      <span>
                        {isEligibleToStart
                          ? "Doctor action: Start consultation to open the video room."
                          : "Calls can only be started for accepted video appointments."}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {callPhase === "connected" || callPhase === "joining" ? (
                      <button
                        type="button"
                        onClick={handleEndConsultation}
                        className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold flex items-center gap-2 shadow-sm transition-all"
                      >
                        <PhoneOff className="w-4 h-4" />
                        {t("consultation.endConsultation", {}, "End Consultation")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleStartConsultation}
                        disabled={!isEligibleToStart || callPhase === "starting" || !dailyStatus.isConfigured}
                        className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
                      >
                        {callPhase === "starting" ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            {t("consultation.startingConsultation", {}, "Starting...")}
                          </>
                        ) : (
                          <>
                            <PhoneCall className="w-4 h-4" />
                            {t("consultation.startConsultation", {}, "Start Consultation")}
                          </>
                        )}
                      </button>
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
