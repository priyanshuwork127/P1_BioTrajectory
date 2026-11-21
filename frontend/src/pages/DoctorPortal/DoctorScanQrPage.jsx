
import React, { useState } from "react";
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
} from "lucide-react";
import { useDoctorAuth } from "../../context/DoctorAuthContext";
import QrTokenService from "../../services/qrTokenService";

export default function DoctorScanQrPage() {
  const { isVerified } = useDoctorAuth();

  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [request, setRequest] = useState(null);
  const [readings, setReadings] = useState(null);

  if (!isVerified) {
    return (
      <div className="max-w-3xl mx-auto p-6 rounded-2xl border border-amber-200 bg-amber-50 text-amber-800">
        <AlertTriangle className="inline mr-2" size={18} />
        Doctor verification is required to access patient authorization.
      </div>
    );
  }

  const handleSubmitToken = async (event) => {
    event.preventDefault();
    setError("");
    setRequest(null);
    setReadings(null);

    if (!token.trim()) {
      setError("Enter the token displayed in the patient's QR code.");
      return;
    }

    try {
      setLoading(true);

      const result = await QrTokenService.validateToken(token.trim());

      setRequest(result);
      setToken("");
    } catch (err) {
      setError(err.message || "Unable to verify this QR token.");
    } finally {
      setLoading(false);
    }
  };

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
      setError(err.message || "Unable to check consent status.");
    } finally {
      setLoading(false);
    }
  };

  const loadAuthorizedReadings = async () => {
    if (!request?.requestId) return;

    try {
      setLoading(true);
      setError("");

      const result = await QrTokenService.getAuthorizedReadings(
        request.requestId
      );

      setReadings(result);
    } catch (err) {
      setError(err.message || "Unable to load authorized readings.");
    } finally {
      setLoading(false);
    }
  };

  const requestStatus = request?.status || "PENDING";

  return (
    <div className="max-w-4xl mx-auto space-y-7 pb-12">
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
          Submit a patient-issued token and wait for explicit patient consent.
        </p>
      </div>

      <div className="rounded-2xl border border-cyan-200 dark:border-cyan-900 bg-cyan-50 dark:bg-cyan-950/20 p-5 flex gap-3">
        <ShieldCheck className="w-6 h-6 text-cyan-600 shrink-0" />

        <div>
          <h2 className="font-bold text-cyan-900 dark:text-cyan-300">
            Patient consent is mandatory
          </h2>
          <p className="text-sm text-cyan-800 dark:text-cyan-400 mt-1">
            Submitting a token only creates a consent request. It does not
            grant access to patient records.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
          <QrCode size={36} />
        </div>

        <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-5">
          Enter Patient QR Token
        </h2>

        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
          Enter the token provided by the patient. The backend verifies
          the token and creates a consent request.
        </p>

        <form onSubmit={handleSubmitToken} className="mt-6 space-y-4">
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
        </form>

        {error && (
          <div className="mt-5 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-sm text-red-700 dark:text-red-300">
            <AlertTriangle size={17} className="inline mr-2" />
            {error}
          </div>
        )}

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

        
{readings?.readings?.map((reading, index) => {
  const values = reading.values || {};

  const typeLabel = (reading.type || "Measurement")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

  const units = {
    systolic: "mmHg",
    diastolic: "mmHg",
    pulse: "bpm",
    bpm: "bpm",
    spo2: "%",
  };

  return (
    <div
      key={reading.id || index}
      className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800"
    >
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
        {typeLabel}
      </p>

      <div className="mt-2 space-y-1">
        {Object.entries(values).map(([key, value]) => (
          <p
            key={key}
            className="text-sm text-slate-700 dark:text-slate-300"
          >
            {key.replaceAll("_", " ")}:{" "}
            <strong>{value ?? "Not available"}</strong>{" "}
            {units[key] || ""}
          </p>
        ))}
      </div>

      <p className="text-xs text-slate-500 mt-2">
        {reading.measuredAt
          ? new Date(reading.measuredAt).toLocaleString()
          : "Measurement time unavailable"}
      </p>
    </div>
  );
})}

      </div>

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
