/**
 * BioTrajectory Video Consultation Service (Google Meet & Daily.co)
 * 
 * Handles interaction with backend consultation endpoints and generates
 * secure, appointment-specific Google Meet rooms with client-resilient fallbacks.
 */

import { auth } from "./firebase";
import { generateGoogleMeetCode, getGoogleMeetUrl } from "./appointmentService";

export { generateGoogleMeetCode, getGoogleMeetUrl };

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
   * Check video consultation provider status
   */
  async getStatus() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/consultations/status`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        return {
          isConfigured: true,
          provider: "google_meet",
          supportedProviders: ["google_meet", "daily"],
          message: "Google Meet consultation ready (client mode)"
        };
      }
      return await response.json();
    } catch (error) {
      console.warn("Could not check consultation status:", error);
      return {
        isConfigured: true,
        provider: "google_meet",
        supportedProviders: ["google_meet", "daily"],
        message: "Google Meet consultations active"
      };
    }
  },

  /**
   * Start consultation (Doctor host)
   */
  async startConsultation(appointmentId, provider = "google_meet", customMeetUrl = null) {
    if (!appointmentId) {
      throw new Error("Appointment ID is required to start a consultation.");
    }

    const gmeetUrl = getGoogleMeetUrl(appointmentId, customMeetUrl);
    const roomName = generateGoogleMeetCode(appointmentId);

    try {
      const headers = await getAuthHeader();
      const response = await fetch(`${API_BASE_URL}/api/consultations/start`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          appointment_id: appointmentId,
          provider,
          meet_url: customMeetUrl || gmeetUrl,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        try {
          localStorage.setItem(`biotraj_meet_url_${appointmentId}`, data.room_url);
          localStorage.setItem(`biotraj_meet_provider_${appointmentId}`, data.provider || provider);
          localStorage.setItem(`biotraj_call_status_${appointmentId}`, "ACTIVE");
        } catch {}
        return {
          roomUrl: data.room_url,
          token: data.token || "",
          roomName: data.room_name || roomName,
          callStatus: data.call_status || "ACTIVE",
          role: data.role || "doctor",
          appointmentId: data.appointment_id || appointmentId,
          provider: data.provider || provider,
        };
      }
    } catch (err) {
      console.warn("Backend consultation start fallback:", err);
    }

    // Resilient fallback for demo & offline mode
    try {
      localStorage.setItem(`biotraj_meet_url_${appointmentId}`, gmeetUrl);
      localStorage.setItem(`biotraj_meet_provider_${appointmentId}`, provider);
      localStorage.setItem(`biotraj_call_status_${appointmentId}`, "ACTIVE");
      window.dispatchEvent(new CustomEvent("biotraj_call_status_change", {
        detail: { appointmentId, status: "ACTIVE", meetUrl: gmeetUrl, provider }
      }));
    } catch {}

    return {
      roomUrl: gmeetUrl,
      token: "",
      roomName,
      callStatus: "ACTIVE",
      role: "doctor",
      appointmentId,
      provider,
    };
  },

  /**
   * Join consultation (Patient or Doctor attendee)
   */
  async joinConsultation(appointmentId, provider = "google_meet") {
    if (!appointmentId) {
      throw new Error("Appointment ID is required to join a consultation.");
    }

    const gmeetUrl = getGoogleMeetUrl(appointmentId);
    const roomName = generateGoogleMeetCode(appointmentId);

    try {
      const headers = await getAuthHeader();
      const response = await fetch(`${API_BASE_URL}/api/consultations/join`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          appointment_id: appointmentId,
          provider,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          roomUrl: data.room_url,
          token: data.token || "",
          roomName: data.room_name || roomName,
          callStatus: data.call_status || "ACTIVE",
          role: data.role || "patient",
          appointmentId: data.appointment_id || appointmentId,
          provider: data.provider || provider,
        };
      }
    } catch (err) {
      console.warn("Backend consultation join fallback:", err);
    }

    return {
      roomUrl: gmeetUrl,
      token: "",
      roomName,
      callStatus: "ACTIVE",
      role: "patient",
      appointmentId,
      provider,
    };
  },

  /**
   * End the consultation
   */
  async endConsultation(appointmentId) {
    if (!appointmentId) {
      throw new Error("Appointment ID is required to end a consultation.");
    }

    try {
      localStorage.setItem(`biotraj_call_status_${appointmentId}`, "ENDED");
      window.dispatchEvent(new CustomEvent("biotraj_call_status_change", {
        detail: { appointmentId, status: "ENDED" }
      }));
    } catch {}

    try {
      const headers = await getAuthHeader();
      const response = await fetch(`${API_BASE_URL}/api/consultations/end`, {
        method: "POST",
        headers,
        body: JSON.stringify({ appointment_id: appointmentId }),
      });
      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.warn("Backend consultation end fallback:", err);
    }

    return { appointment_id: appointmentId, call_status: "ENDED" };
  },
};

export default consultationService;
