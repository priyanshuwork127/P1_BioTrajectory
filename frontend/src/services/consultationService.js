/**
 * BioTrajectory Video Consultation Service (Daily.co Prebuilt)
 * 
 * Handles interaction with backend Daily.co endpoints:
 * - Room creation (backend-only)
 * - Secure role-based meeting token issuance
 * - Live consultation status
 */

import { auth } from "./firebase";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

async function getAuthHeader() {
  const user = auth?.currentUser;
  if (!user) {
    throw new Error("You must be logged in to participate in a video consultation.");
  }
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export const consultationService = {
  /**
   * Check backend Daily.co video consultation configuration status
   */
  async getStatus() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/consultations/status`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        return { isConfigured: false, provider: "daily", message: "Consultation service unavailable" };
      }
      return await response.json();
    } catch (error) {
      console.warn("Could not check consultation status:", error);
      return { isConfigured: false, provider: "daily", message: error.message };
    }
  },

  /**
   * Verified Doctor starts the consultation room for an accepted appointment
   */
  async startConsultation(appointmentId) {
    if (!appointmentId) {
      throw new Error("Appointment ID is required to start a consultation.");
    }

    const headers = await getAuthHeader();
    const response = await fetch(`${API_BASE_URL}/api/consultations/start`, {
      method: "POST",
      headers,
      body: JSON.stringify({ appointment_id: appointmentId }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.detail ||
        data.message ||
        `Failed to start consultation (${response.status})`
      );
    }

    return {
      roomUrl: data.room_url,
      token: data.token,
      roomName: data.room_name,
      callStatus: data.call_status,
      role: data.role,
      appointmentId: data.appointment_id,
    };
  },

  /**
   * Patient or Doctor joins the active consultation room
   */
  async joinConsultation(appointmentId) {
    if (!appointmentId) {
      throw new Error("Appointment ID is required to join a consultation.");
    }

    const headers = await getAuthHeader();
    const response = await fetch(`${API_BASE_URL}/api/consultations/join`, {
      method: "POST",
      headers,
      body: JSON.stringify({ appointment_id: appointmentId }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.detail ||
        data.message ||
        `Failed to join consultation (${response.status})`
      );
    }

    return {
      roomUrl: data.room_url,
      token: data.token,
      roomName: data.room_name,
      callStatus: data.call_status,
      role: data.role,
      appointmentId: data.appointment_id,
    };
  },

  /**
   * End the consultation
   */
  async endConsultation(appointmentId) {
    if (!appointmentId) {
      throw new Error("Appointment ID is required to end a consultation.");
    }

    const headers = await getAuthHeader();
    const response = await fetch(`${API_BASE_URL}/api/consultations/end`, {
      method: "POST",
      headers,
      body: JSON.stringify({ appointment_id: appointmentId }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.detail ||
        data.message ||
        `Failed to end consultation (${response.status})`
      );
    }

    return data;
  },
};

export default consultationService;
