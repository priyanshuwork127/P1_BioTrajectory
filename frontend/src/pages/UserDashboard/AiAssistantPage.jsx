
import React, {
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react';

import {
  Bot,
  Send,
  Mic,
  MicOff,
  Paperclip,
  Trash2,
  Volume2,
  VolumeX,
  Sparkles,
  AlertTriangle,
  ShieldCheck,
  FileText,
  X,
  Settings,
  StopCircle
} from 'lucide-react';

import { Link } from 'react-router-dom';

import { GeminiAssistantService } from '../../services/gemini';
import { useAuth } from '../../context/AuthContext';
import DisclaimerBanner from '../../components/common/DisclaimerBanner';


const nowLabel = (value = new Date()) =>
  new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });


const toMessage = (item) => ({
  id: item.id || `${item.sender}_${Date.now()}_${Math.random()}`,
  sender: item.sender === 'user' ? 'user' : 'assistant',
  text: item.text || '',
  timestamp: item.timestamp ? nowLabel(item.timestamp) : nowLabel(),
  attachments: item.attachments || [],
  warningCard: item.warningCard || null
});


export default function AiAssistantPage() {

  const { currentUser, healthProfile } = useAuth();

  const hasAIConsent =
    healthProfile?.consent?.aiAssistantAnalysis === true;

  const [messages, setMessages] = useState([{
    id: 'welcome',
    sender: 'assistant',
    text: 'Hello! I am your BioTrajectory AI Health Assistant. I can explain health concepts and, when you have enabled AI analysis consent, help you understand your own recorded readings. I do not diagnose or prescribe.',
    timestamp: 'Welcome',
    warningCard: null
  }]);

  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [reportConsent, setReportConsent] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reports, setReports] = useState([]);
  const [error, setError] = useState('');
  const [historyLoading, setHistoryLoading] = useState(true);

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);


  const suggestedQuestions = [
    'Summarize my recent health readings.',
    'Explain my blood pressure readings in simple language.',
    'What does urine protein mean?',
    'What questions should I ask my doctor about my results?'
  ];


  useEffect(() => {

    let alive = true;

    (async () => {
      try {

        const history =
          await GeminiAssistantService.initializeConversation();

        if (alive && history.length) {
          setMessages(history.map(toMessage));
        }

      } catch (err) {

        if (alive) {
          setError(
            err.message || 'Could not load saved conversation.'
          );
        }

      } finally {

        if (alive) {
          setHistoryLoading(false);
        }

      }
    })();

    return () => {
      alive = false;
    };

  }, [currentUser?.uid]);


  useEffect(() => {

    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth'
    });

  }, [messages, isLoading]);


  useEffect(() => {

    return () => {

      try {
        recognitionRef.current?.stop();
      } catch {}

      if (
        typeof window !== 'undefined' &&
        window.speechSynthesis
      ) {
        window.speechSynthesis.cancel();
      }

    };

  }, []);


  const speak = useCallback((text) => {

    if (
      !voiceEnabled ||
      !('speechSynthesis' in window)
    ) {
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.lang = 'en-IN';
    utterance.rate = 1;

    window.speechSynthesis.speak(utterance);

  }, [voiceEnabled]);


  const handleSend = async (query = inputText) => {

    const clean = String(query || '').trim();

    if ((!clean && !reports.length) || isLoading) {
      return;
    }

    setError('');

    const userMsg = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: clean || 'Please explain my uploaded report.',
      timestamp: nowLabel(),
      attachments: reports.map(r => ({
        name: r.file_name,
        type: 'application/pdf'
      }))
    };

    setMessages(prev => [...prev, userMsg]);

    setInputText('');
    setIsLoading(true);

    try {

      const result =
        await GeminiAssistantService.queryAssistant({
          query: clean ||
            'Please summarize and explain the report I uploaded. Clearly separate reported values from general explanations.',
          reportIds: reports.map(r => r.report_id)
        });

      const assistantMsg = {
        id: `asst_${Date.now()}`,
        sender: 'assistant',
        text: result.text,
        timestamp: nowLabel(result.timestamp || new Date()),
        warningCard: result.warningCard
      };

      setMessages(prev => [...prev, assistantMsg]);

      speak(result.text);

    } catch (err) {

      setError(
        err.message || 'The AI request failed. Please try again.'
      );

      setMessages(prev => [...prev, {
        id: `err_${Date.now()}`,
        sender: 'assistant',
        text: 'I could not complete that request. Please check the connection and try again.',
        timestamp: nowLabel(),
        warningCard: null
      }]);

    } finally {

      setIsLoading(false);

    }

  };


  const handleFileSelected = async (event) => {

    const file = event.target.files?.[0];

    event.target.value = '';

    if (!file) return;

    if (!hasAIConsent) {
      setError(
        'Enable AI Assistant Analysis in Settings before uploading a report.'
      );
      return;
    }

    if (!reportConsent) {
      setError(
        'Confirm the report-sharing checkbox before uploading.'
      );
      return;
    }

    if (
      file.type !== 'application/pdf' &&
      !file.name.toLowerCase().endsWith('.pdf')
    ) {
      setError('Only PDF files are supported.');
      return;
    }

    setError('');
    setUploading(true);

    try {

      const result =
        await GeminiAssistantService.uploadReport(file, true);

      setReports(prev => [
        ...prev.filter(r => r.report_id !== result.report_id),
        result
      ]);

    } catch (err) {

      setError(err.message || 'Report upload failed.');

    } finally {

      setUploading(false);

    }

  };


  const toggleRecording = () => {

    if (isRecording) {

      recognitionRef.current?.stop();
      setIsRecording(false);

      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {

      setError(
        'Speech recognition is not supported in this browser. Try Chrome or use typing.'
      );

      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = 'en-IN';
    recognition.interimResults = true;
    recognition.continuous = false;

    recognitionRef.current = recognition;

    recognition.onresult = (event) => {

      const transcript = Array.from(event.results)
        .map(r => r[0].transcript)
        .join('');

      setInputText(transcript);

    };

    recognition.onerror = (event) => {

      setError(
        `Voice input failed: ${event.error || 'microphone unavailable'}.`
      );

      setIsRecording(false);

    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    try {

      recognition.start();
      setIsRecording(true);

    } catch {

      setError(
        'Could not start microphone. Check browser permission.'
      );

      setIsRecording(false);

    }

  };


  const clearChat = async () => {

    if (isLoading) return;

    setError('');

    try {

      await GeminiAssistantService.deleteConversation();

      setMessages([{
        id: `welcome_${Date.now()}`,
        sender: 'assistant',
        text: 'Conversation cleared. What would you like to understand about your health?',
        timestamp: nowLabel(),
        warningCard: null
      }]);

      setReports([]);

    } catch (err) {

      setError(
        err.message || 'Could not clear the saved conversation.'
      );

    }

  };


  return (

    <div className="space-y-5 max-w-5xl mx-auto h-[calc(100vh-8.5rem)] min-h-[620px] flex flex-col">

      {/* Header */}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">

        <div>

          <div className="flex items-center gap-3 flex-wrap">

            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Ask AI
            </h1>

            <span className="text-xs font-bold px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/20">
              Personal Health Assistant
            </span>

          </div>

          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Understand your recorded readings and reports in simple language.
          </p>

        </div>

        <div className="flex items-center gap-2">

          <button
            onClick={() => setVoiceEnabled(v => !v)}
            className="px-3 py-2 rounded-xl border glass-card flex items-center gap-2 text-sm"
            title="Toggle spoken answers"
          >
            {voiceEnabled
              ? <Volume2 size={18} />
              : <VolumeX size={18} />
            }

            Voice {voiceEnabled ? 'On' : 'Off'}
          </button>

          <button
            onClick={() => window.speechSynthesis?.cancel()}
            className="p-2.5 rounded-xl glass-card text-slate-500"
            title="Stop spoken answer"
          >
            <StopCircle size={19} />
          </button>

          <button
            onClick={clearChat}
            disabled={isLoading}
            className="p-2.5 rounded-xl glass-card text-slate-500 hover:text-rose-500"
            title="Clear saved chat"
          >
            <Trash2 size={19} />
          </button>

        </div>

      </div>


      {/* Consent status */}

      <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">

        <div className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">

          <ShieldCheck className="w-5 h-5 text-cyan-600 shrink-0 mt-0.5" />

          <div>

            <p className="font-semibold">
              Personal health data access: {hasAIConsent ? 'Enabled' : 'Off'}
            </p>

            <p className="text-xs mt-1">
              Your readings are retrieved on the backend using your verified Firebase UID. They are not sent unless your AI consent is enabled.
            </p>

          </div>

        </div>

        {!hasAIConsent && (

          <Link
            to="/dashboard/settings"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border text-cyan-700 dark:text-cyan-300 text-xs font-bold"
          >
            <Settings size={15} />
            Manage AI consent
          </Link>

        )}

      </div>


      {/* Chat messages */}

      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 rounded-3xl glass-card border border-slate-200 dark:border-slate-800 space-y-5">

        {historyLoading && (
          <p className="text-xs text-slate-500">
            Loading your saved conversation…
          </p>
        )}

        {messages.map(msg => (

          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.sender === 'user'
                ? 'items-end'
                : 'items-start'
            } space-y-1.5`}
          >

            <div className="text-xs text-slate-500 px-1">
              {msg.sender === 'user'
                ? 'You'
                : 'BioTrajectory Assistant'
              } · {msg.timestamp}
            </div>

            <div
              className={`p-4 sm:p-5 rounded-3xl max-w-[95%] sm:max-w-[88%] text-sm leading-relaxed whitespace-pre-wrap ${
                msg.sender === 'user'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-tr-none'
                  : 'bg-white/90 dark:bg-[#1F150E]/90 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-tl-none'
              }`}
            >

              {msg.text}

              {msg.attachments?.length > 0 && (

                <div className="mt-3 pt-2 border-t border-current/20 text-xs flex flex-wrap gap-2">

                  {msg.attachments.map((a, i) => (

                    <span
                      key={i}
                      className="inline-flex gap-1 items-center"
                    >
                      <FileText size={13} />
                      {a.name}
                    </span>

                  ))}

                </div>

              )}

              {msg.warningCard && (

                <div
                  className={`mt-4 p-3 rounded-xl border ${
                    msg.warningCard.level === 'critical'
                      ? 'border-rose-400 bg-rose-500/10'
                      : 'border-amber-400 bg-amber-500/10'
                  }`}
                >

                  <div className="font-bold flex items-center gap-2">
                    <AlertTriangle size={17} />
                    {msg.warningCard.title}
                  </div>

                  <p className="mt-2 text-xs">
                    {msg.warningCard.measurement}
                  </p>

                  <p className="mt-1 text-xs">
                    {msg.warningCard.recommendation}
                  </p>

                </div>

              )}

            </div>

          </div>

        ))}

        {isLoading && (

          <div className="flex items-center gap-3 text-sm text-cyan-600 p-3">
            <Bot className="animate-bounce" size={20} />
            Reading your authorized context and preparing an explanation…
          </div>

        )}

        <div ref={messagesEndRef} />

      </div>


      {/* Suggested questions */}

      <div className="flex gap-2 overflow-x-auto pb-1 shrink-0">

        <span className="text-xs font-bold text-slate-500 shrink-0 flex items-center gap-1">
          <Sparkles size={14} />
          Ideas:
        </span>

        {suggestedQuestions.map(q => (

          <button
            key={q}
            onClick={() => handleSend(q)}
            disabled={isLoading}
            className="px-3 py-2 rounded-xl text-xs glass-card whitespace-nowrap hover:border-cyan-400 disabled:opacity-50"
          >
            {q}
          </button>

        ))}

      </div>


      {/* Input and report upload */}

      <div className="p-3 rounded-3xl glass-card border border-slate-200 dark:border-slate-800 shrink-0 space-y-3">

        <div className="flex flex-wrap items-center gap-2">

          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">

            <input
              type="checkbox"
              checked={reportConsent}
              onChange={e => setReportConsent(e.target.checked)}
              disabled={!hasAIConsent}
            />

            I explicitly consent to sending the selected PDF text to the AI service for explanation.

          </label>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || !hasAIConsent || !reportConsent}
            className="ml-auto px-3 py-2 rounded-xl bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 text-xs font-bold flex items-center gap-2 disabled:opacity-40"
          >
            <Paperclip size={15} />
            {uploading ? 'Extracting PDF…' : 'Attach PDF'}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={handleFileSelected}
          />

        </div>


        {reports.length > 0 && (

          <div className="flex flex-wrap gap-2">

            {reports.map(r => (

              <span
                key={r.report_id}
                className="text-xs rounded-lg bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 px-2 py-1 inline-flex items-center gap-2"
              >

                <FileText size={13} />

                {r.file_name}

                <button
                  onClick={() => setReports(
                    prev => prev.filter(
                      x => x.report_id !== r.report_id
                    )
                  )}
                  aria-label="Remove report from chat"
                >
                  <X size={13} />
                </button>

              </span>

            ))}

          </div>

        )}


        <div className="flex items-center gap-2">

          <button
            onClick={toggleRecording}
            className={`p-3 rounded-xl ${
              isRecording
                ? 'bg-rose-500 text-white animate-pulse'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title={isRecording ? 'Stop recording' : 'Speak your question'}
          >
            {isRecording
              ? <MicOff size={19} />
              : <Mic size={19} />
            }
          </button>

          <input
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e =>
              e.key === 'Enter' &&
              !e.shiftKey &&
              handleSend()
            }
            placeholder={
              isRecording
                ? 'Listening…'
                : 'Ask about your readings, reports or health questions…'
            }
            className="flex-1 min-w-0 py-3 px-3 bg-transparent text-sm text-slate-900 dark:text-white focus:outline-none"
          />

          <button
            onClick={() => handleSend()}
            disabled={
              isLoading ||
              (!inputText.trim() && reports.length === 0)
            }
            className="px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 font-bold disabled:opacity-40 flex items-center gap-2"
          >
            <Send size={16} />
            <span className="hidden sm:inline">Send</span>
          </button>

        </div>

        {error && (
          <p className="text-xs text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}

      </div>


      <DisclaimerBanner text="BioTrajectory AI provides educational explanations, not diagnosis or treatment. It may make mistakes. For urgent symptoms, contact local emergency services; in India call 112." />

    </div>

  );

}
