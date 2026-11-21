
/** Authenticated BioTrajectory AI client. Groq credentials never reach the browser. */
import { FirebaseService } from './firebase';

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  'http://127.0.0.1:8000'
).replace(/\/$/, '');

let activeConversationId = null;
let activeUid = null;

async function token(forceRefresh = false) {
  const user = FirebaseService.getCurrentUser();
  if (!user) throw new Error('Please sign in to use BioTrajectory AI.');
  activeUid = user.uid;
  return FirebaseService.getIdToken(user, forceRefresh);
}

async function request(path, options = {}, retry = true) {
  let idToken = await token(false);
  let response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${idToken}` },
    cache: 'no-store'
  });

  if (response.status === 401 && retry) {
    idToken = await token(true);
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: { ...(options.headers || {}), Authorization: `Bearer ${idToken}` },
      cache: 'no-store'
    });
  }

  if (!response.ok) {
    let detail = `Request failed (${response.status}).`;
    try {
      const body = await response.json();
      detail = body.detail || detail;
    } catch {}

    const error = new Error(detail);
    error.status = response.status;
    throw error;
  }

  return response;
}

function conversationStorageKey(uid) {
  return `bt_ai_conversation_${uid}`;
}

export const GeminiAssistantService = {
  resetConversation() {
    if (activeUid) {
      localStorage.removeItem(conversationStorageKey(activeUid));
    }
    activeConversationId = null;
  },

  getConversationId() {
    return activeConversationId;
  },

  async initializeConversation() {
    const user = FirebaseService.getCurrentUser();
    if (!user) throw new Error('Please sign in first.');

    activeUid = user.uid;
    activeConversationId =
      localStorage.getItem(conversationStorageKey(user.uid)) || null;

    if (!activeConversationId) return [];

    try {
      const response = await request(
        `/api/history?conversation_id=${encodeURIComponent(activeConversationId)}`
      );

      const data = await response.json();
      return data.messages || [];

    } catch (error) {
      if (error.status === 403 || error.status === 404) {
        this.resetConversation();
        return [];
      }
      throw error;
    }
  },

  async queryAssistant({ query, reportIds = [] }) {
    const message = String(query || '').trim();

    if (!message) {
      throw new Error('Enter a question first.');
    }

    const response = await request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        conversation_id: activeConversationId,
        report_ids: reportIds,
        user_consent_given: true
      })
    });

    const data = await response.json();

    activeConversationId = data.conversation_id;

    if (activeUid && activeConversationId) {
      localStorage.setItem(
        conversationStorageKey(activeUid),
        activeConversationId
      );
    }

    return {
      text: data.text || data.response || 'No response generated.',
      warningCard: data.warningCard || null,
      isEmergency: Boolean(data.is_emergency),
      conversationId: data.conversation_id,
      timestamp: data.timestamp,
      modelUsed: data.model_used
    };
  },

  async uploadReport(file, consentConfirmed) {
    if (!(file instanceof File)) {
      throw new Error('Choose a PDF report.');
    }

    const form = new FormData();
    form.append('file', file);
    form.append('consent', String(Boolean(consentConfirmed)));

    const response = await request('/api/ai/reports', {
      method: 'POST',
      body: form
    });

    return response.json();
  },

  async deleteConversation() {
    if (!activeConversationId) return;

    await request(
      `/api/history?conversation_id=${encodeURIComponent(activeConversationId)}`,
      { method: 'DELETE' }
    );

    this.resetConversation();
  },

  async fetchHealthSummary() {
    const response = await request('/api/health/summary');
    return response.json();
  }
};

export default GeminiAssistantService;
