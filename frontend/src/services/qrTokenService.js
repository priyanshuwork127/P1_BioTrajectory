
import { FirebaseService } from "./firebase";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

/**
 * Authenticated request helper.
 * Uses Firebase Authentication, never a frontend-generated identity.
 */
async function authenticatedRequest(endpoint, options = {}) {
  const user = FirebaseService.getCurrentUser();

  if (!user) {
    throw new Error("Please sign in before using QR authorization.");
  }

  const sendRequest = async (forceRefresh = false) => {
    const token = await FirebaseService.getIdToken(
      user,
      forceRefresh
    );

    return fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
  };

  let response = await sendRequest(false);

  // Refresh the Firebase token once if the backend rejects it.
  if (response.status === 401) {
    response = await sendRequest(true);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.detail ||
      data.message ||
      `QR request failed (${response.status}).`
    );
  }

  return data;
}

export class QrTokenService {
  /**
   * Patient: create a short-lived QR authorization session.
   */
  static async createSession() {
    return authenticatedRequest("/api/qr/sessions", {
      method: "POST",
    });
  }

  /**
   * Doctor: submit the opaque token obtained from the patient's QR.
   */
  static async validateToken(tokenString) {
    if (
      typeof tokenString !== "string" ||
      !tokenString.trim()
    ) {
      throw new Error("Please provide a valid QR token.");
    }

    return authenticatedRequest("/api/qr/scan", {
      method: "POST",
      body: JSON.stringify({
        token: tokenString.trim(),
      }),
    });
  }

  /**
   * Patient: retrieve pending doctor consent requests.
   */
  static async getPendingRequests() {
    return authenticatedRequest("/api/qr/requests/pending");
  }

  /**
   * Patient: explicitly approve or deny a request.
   */
  static async respondToConsent(requestId, approved) {
    if (!requestId) {
      throw new Error("Consent request ID is missing.");
    }

    if (typeof approved !== "boolean") {
      throw new Error("Consent decision must be true or false.");
    }

    return authenticatedRequest(
      `/api/qr/requests/${encodeURIComponent(requestId)}/consent`,
      {
        method: "POST",
        body: JSON.stringify({ approved }),
      }
    );
  }

  /**
   * Doctor: check the status of a consent request.
   */
  static async getDoctorRequest(requestId) {
    if (!requestId) {
      throw new Error("Request ID is required.");
    }

    return authenticatedRequest(
      `/api/qr/doctor/requests/${encodeURIComponent(requestId)}`
    );
  }

  /**
   * Doctor: read patient measurements only after consent is granted.
   */
  static async getAuthorizedReadings(requestId) {
    if (!requestId) {
      throw new Error("Request ID is required.");
    }

    return authenticatedRequest(
      `/api/qr/doctor/requests/${encodeURIComponent(requestId)}/readings`
    );
  }

  /**
   * Patient: revoke an active or pending authorization.
   */
  static async revokeAccess(requestId) {
    if (!requestId) {
      throw new Error("Request ID is required.");
    }

    return authenticatedRequest(
      `/api/qr/requests/${encodeURIComponent(requestId)}/revoke`,
      {
        method: "POST",
      }
    );
  }

  /**
   * Compatibility method for older callers.
   * There is no separate client-side session to close.
   */
  static async closeSession(requestId) {
    if (!requestId) {
      return {
        success: false,
        message: "Request ID is required to revoke access.",
      };
    }

    return this.revokeAccess(requestId);
  }
}

export default QrTokenService;
