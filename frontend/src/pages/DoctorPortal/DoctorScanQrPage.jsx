
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";

import { Link } from "react-router-dom";

import {
  QrCode,
  ShieldCheck,
  AlertTriangle,
  LockKeyhole,
  FileText,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Camera,
  CameraOff,
} from "lucide-react";

import { Html5Qrcode } from "html5-qrcode";

import { useDoctorAuth } from "../../context/DoctorAuthContext";
import QrTokenService from "../../services/qrTokenService";

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

const formatLabel = (value) => {
  return String(value)
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatValue = (value) => {
  if (value === null || value === undefined || value === "") {
    return "Not available";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (Array.isArray(value)) {
    return value.map((item) => {
      if (item && typeof item === "object") {
        return JSON.stringify(item);
      }
      return String(item);
    }).join(", ");
  }

  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, item]) => `${formatLabel(key)}: ${formatValue(item)}`)
      .join(" | ");
  }

  return String(value);
};

const formatDate = (value) => {
  if (!value) return "Measurement time unavailable";

  let date;

  if (typeof value === "string" || typeof value === "number") {
    date = new Date(value);
  } else if (value?.seconds) {
    date = new Date(value.seconds * 1000);
  } else {
    return "Measurement time unavailable";
  }

  return Number.isNaN(date.getTime())
    ? "Measurement time unavailable"
    : date.toLocaleString();
};

// --------------------------------------------------
// READINGS DISPLAY
// --------------------------------------------------

function ReadingCard({ reading }) {
  const values = reading.values ?? reading.value;

  const entries =
    values && typeof values === "object" && !Array.isArray(values)
      ? Object.entries(values)
      : null;

  return (
    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">

      <h4 className="font-semibold text-sm text-slate-900 dark:text-white capitalize mb-3">
        {formatLabel(reading.type || reading.name || "Measurement")}
      </h4>

      {entries && entries.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {entries.map(([key, value]) => (
            <div
              key={key}
              className="p-3 rounded-lg bg-white dark:bg-slate-900"
            >
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                {formatLabel(key)}
              </p>

              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 break-words">
                {formatValue(value)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-800 dark:text-slate-200 break-words">
          <strong>{formatValue(values)}</strong>
          {reading.unit ? ` ${reading.unit}` : ""}
        </p>
      )}

      <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
        {formatDate(reading.measuredAt)}
      </p>
    </div>
  );
}

// --------------------------------------------------
// MAIN COMPONENT
// --------------------------------------------------

export default function DoctorScanQrPage() {
  const { isVerified } = useDoctorAuth();

  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [request, setRequest] = useState(null);
  const [readings, setReadings] = useState(null);

  const [scannerOpen, setScannerOpen] = useState(false);

  const scannerRef = useRef(null);
  const scanLockRef = useRef(false);

  // --------------------------------------------------
  // SUBMIT TOKEN TO BACKEND
  // --------------------------------------------------

  const submitToken = useCallback(async (tokenValue) => {
    const cleanToken = tokenValue?.trim();

    if (!cleanToken) {
      setError("Please scan or enter a valid patient QR token.");
      return;
    }

    setError("");
    setRequest(null);
    setReadings(null);

    try {
      setLoading(true);

      const result = await QrTokenService.validateToken(cleanToken);

      setRequest(result);
      setToken("");
    } catch (err) {
      setError(
        err.message || "Unable to verify this QR token."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmitToken = (event) => {
    event.preventDefault();
    submitToken(token);
  };

  // --------------------------------------------------
  // CAMERA SCANNER
  // --------------------------------------------------

  useEffect(() => {
    if (!scannerOpen) return;

    let cancelled = false;
    let scanner;

    const startScanner = async () => {
      try {
        scanner = new Html5Qrcode("doctor-qr-reader");
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: {
              width: 250,
              height: 250,
            },
            aspectRatio: 1,
          },
          async (decodedText) => {
            if (cancelled || scanLockRef.current) return;

            scanLockRef.current = true;

            try {
              if (scanner.isScanning) {
                await scanner.stop();
              }

              scanner.clear();
            } catch (cameraError) {
              console.warn("Camera cleanup:", cameraError);
            }

            if (scannerRef.current === scanner) {
              scannerRef.current = null;
            }

            setScannerOpen(false);

            await submitToken(decodedText);

            scanLockRef.current = false;
          },
          () => {
            // Ignore unsuccessful frame scans.
          }
        );

        if (cancelled && scanner.isScanning) {
          await scanner.stop();
          scanner.clear();
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            "Unable to access camera. Check camera permission and try again."
          );
          setScannerOpen(false);
        }

        if (scannerRef.current === scanner) {
          scannerRef.current = null;
        }

        try {
          if (scanner?.isScanning) {
            await scanner.stop();
          }
          scanner?.clear();
        } catch (cleanupError) {
          console.warn("Scanner cleanup:", cleanupError);
        }
      }
    };

    startScanner();

    return () => {
      cancelled = true;

      const activeScanner = scanner;

      if (scannerRef.current === activeScanner) {
        scannerRef.current = null;
      }

      if (activeScanner) {
        const cleanup = async () => {
          try {
            if (activeScanner.isScanning) {
              await activeScanner.stop();
            }

            activeScanner.clear();
          } catch (err) {
            console.warn("Scanner cleanup failed:", err);
          }
        };

        cleanup();
      }
    };
  }, [scannerOpen, submitToken]);

  const startCamera = () => {
    setError("");
    scanLockRef.current = false;
    setScannerOpen(true);
  };

  const stopCamera = () => {
    setScannerOpen(false);
  };

  // --------------------------------------------------
  // CHECK CONSENT STATUS
  // --------------------------------------------------

  const checkRequestStatus = async () => {
    if (!request?.requestId) return;

    try {
      setLoading(true);
      setError("");

      const result = await QrTokenService.getDoctorRequest(
        request.requestId
      );

      setRequest((previous) => ({
        ...previous,
        ...result,
      }));
    } catch (err) {
      setError(
        err.message || "Unable to check consent status."
      );
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // LOAD AUTHORIZED READINGS
  // --------------------------------------------------

  const loadAuthorizedReadings = async () => {
    if (!request?.requestId) return;

    try {
      setLoading(true);
      setError("");
      setReadings(null);

      const result = await QrTokenService.getAuthorizedReadings(
        request.requestId
      );

      setReadings(result);
    } catch (err) {
      setError(
        err.message || "Unable to load authorized readings."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDemoQrLoad = () => {
    setRequest({
      requestId: "demo-req-alex-001",
      patientUid: "demo-patient-uid-003",
      patientName: "Alex Johnson",
      patientEmail: "patient@biotrajectory.health",
      status: "APPROVED",
      approvedAt: new Date().toISOString(),
      permissions: {
        viewReadings: true,
        viewAnalytics: true,
        viewMedicalHistory: true
      }
    });
    setReadings({
      patientName: "Alex Johnson",
      patientUid: "demo-patient-uid-003",
      readings: [
        {
          id: "demo-r1",
          type: "blood_pressure",
          values: { systolic: 124, diastolic: 80, pulse: 72 },
          measuredAt: new Date().toISOString(),
          notes: "Patient home reading"
        },
        {
          id: "demo-r2",
          type: "urine_test",
          values: { proteinMgDl: 15, ph: 6.4, specificGravity: 1.018, glucose: "Negative" },
          measuredAt: new Date(Date.now() - 86400000).toISOString(),
          notes: "Optical test-strip screening"
        },
        {
          id: "demo-r3",
          type: "oxygen_saturation",
          values: { spo2: 98 },
          measuredAt: new Date().toISOString(),
          notes: "Oximeter check"
        }
      ]
    });
    setError("");
  };

  const requestStatus = request?.status || "PENDING";

  // --------------------------------------------------
  // DOCTOR VERIFICATION
  // --------------------------------------------------

  if (!isVerified) {
    return (
      <div className="max-w-3xl mx-auto p-6 rounded-2xl border border-amber-200 bg-amber-50 text-amber-800">
        <AlertTriangle className="inline mr-2" size={18} />
        Doctor verification is required to access patient authorization.
      </div>
    );
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div className="max-w-4xl mx-auto space-y-7 pb-12">

      {/* HEADER */}

      <div>
        <div className="flex items-center gap-2 mb-2">

          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300">
            Patient Authorization
          </span>

          <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
            Backend Connected
          </span>

        </div>

        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
          Patient QR Authorization
        </h1>

        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
          Scan a patient's authorization QR code or enter the token manually.
        </p>
      </div>

      {/* SECURITY NOTICE */}

      <div className="rounded-2xl border border-cyan-200 dark:border-cyan-900 bg-cyan-50 dark:bg-cyan-950/20 p-5 flex gap-3">

        <ShieldCheck className="w-6 h-6 text-cyan-600 shrink-0" />

        <div>
          <h2 className="font-bold text-cyan-900 dark:text-cyan-300">
            Patient consent is mandatory
          </h2>

          <p className="text-sm text-cyan-800 dark:text-cyan-400 mt-1">
            Scanning a QR code only creates a consent request.
            Patient records remain protected until the patient explicitly approves access.
          </p>
        </div>

      </div>

      {/* QR SCANNER */}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm">

        <div className="w-16 h-16 rounded-2xl bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
          <QrCode size={36} />
        </div>

        <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-5">
          Scan Patient QR Code
        </h2>

        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
          Use your device camera to scan the temporary authorization QR displayed by the patient.
        </p>

        {!scannerOpen ? (
          <button
            type="button"
            onClick={startCamera}
            disabled={loading}
            className="mt-6 w-full flex items-center justify-center gap-2 px-5 py-4 rounded-xl bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white font-semibold transition-colors"
          >
            <Camera size={20} />
            Open Camera & Scan QR
          </button>
        ) : (
          <div className="mt-6 space-y-4">

            <div className="p-3 rounded-xl bg-cyan-50 dark:bg-cyan-950/30 text-sm text-cyan-800 dark:text-cyan-300">
              Position the patient's QR code inside the scanning area.
            </div>

            <div
              id="doctor-qr-reader"
              className="w-full overflow-hidden rounded-xl border border-slate-300 dark:border-slate-700"
            />

            <button
              type="button"
              onClick={stopCamera}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold"
            >
              <CameraOff size={18} />
              Stop Camera
            </button>

          </div>
        )}

        {/* MANUAL TOKEN ENTRY */}

        <div className="flex items-center gap-3 my-7">
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />

          <span className="text-xs text-slate-400 font-semibold">
            OR ENTER MANUALLY
          </span>

          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
        </div>

        <form onSubmit={handleSubmitToken} className="space-y-4">

          <label
            htmlFor="patient-qr-token"
            className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
          >
            QR authorization token
          </label>

          <input
            id="patient-qr-token"
            type="text"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Paste patient token here"
            autoComplete="off"
            className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-cyan-500"
          />

          <button
            type="submit"
            disabled={loading || !token.trim()}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white font-semibold transition-colors"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <LockKeyhole size={18} />
                Submit Authorization Request
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDemoQrLoad}
            className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 font-semibold text-xs transition-colors cursor-pointer"
          >
            <CheckCircle2 size={15} />
            Instant Demo Authorization (Alex Johnson)
          </button>

        </form>

        {/* ERROR MESSAGE */}

        {error && (
          <div className="mt-5 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-sm text-red-700 dark:text-red-300">
            <AlertTriangle size={17} className="inline mr-2" />
            {error}
          </div>
        )}

        {/* CONSENT REQUEST */}

        {request && (
          <div className="mt-6 p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">

            <div className="flex items-center gap-2">
              <CheckCircle2 className="text-emerald-600" size={20} />

              <h3 className="font-bold text-slate-900 dark:text-white">
                Consent request created
              </h3>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 mt-3">
              Request ID:{" "}
              <span className="font-mono break-all">
                {request.requestId || "Not returned by backend"}
              </span>
            </p>

            <p className="text-sm mt-2 text-slate-600 dark:text-slate-300">
              Status: <strong>{requestStatus}</strong>
            </p>

            {requestStatus === "PENDING" && (
              <button
                type="button"
                onClick={checkRequestStatus}
                disabled={loading}
                className="mt-4 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold"
              >
                {loading ? "Checking..." : "Check Consent Status"}
              </button>
            )}

            {requestStatus === "APPROVED" && (
              <button
                type="button"
                onClick={loadAuthorizedReadings}
                disabled={loading}
                className="mt-4 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold"
              >
                {loading ? "Loading..." : "View Authorized Readings"}
              </button>
            )}

            {["DENIED", "EXPIRED", "REVOKED"].includes(requestStatus) && (
              <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
                This request no longer grants access to patient records.
              </p>
            )}

          </div>
        )}

        {/* AUTHORIZED PATIENT READINGS */}

        {readings && (
          <div className="mt-6 p-5 rounded-xl border border-emerald-200 dark:border-emerald-900">

            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText size={18} />
              Authorized Patient Readings
            </h3>

            {Array.isArray(readings.readings) &&
            readings.readings.length > 0 ? (
              <div className="mt-4 space-y-3">

                {readings.readings.map((reading, index) => (
                  <ReadingCard
                    key={reading.id || index}
                    reading={reading}
                  />
                ))}

              </div>
            ) : (
              <p className="text-sm text-slate-500 mt-3">
                No readings were returned for this authorization.
              </p>
            )}

          </div>
        )}

      </div>

      {/* NAVIGATION */}

      <div className="flex flex-col sm:flex-row gap-3">

        <Link
          to="/doctor/patients"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
        >
          <FileText size={16} />
          View Appointment Patients
        </Link>

        <Link
          to="/doctor/appointments"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-semibold"
        >
          <ArrowLeft size={16} />
          Back to Appointments
        </Link>

      </div>

    </div>
  );
}
