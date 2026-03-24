import { create } from 'zustand';
import type { TranscriptEntry, AnswerEntry } from '@/lib/types';

type AnswerMode = 'speed' | 'precise' | 'dual';

interface InterviewState {
  // Connection
  wsStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  setWsStatus: (status: InterviewState['wsStatus']) => void;

  // Session
  sessionId: string | null;
  setSessionId: (id: string | null) => void;

  // Answer mode
  answerMode: AnswerMode;
  setAnswerMode: (mode: AnswerMode) => void;

  // Recording
  isRecording: boolean;
  setIsRecording: (v: boolean) => void;
  recordingDuration: number;
  setRecordingDuration: (d: number) => void;

  // Transcript
  transcripts: TranscriptEntry[];
  addTranscript: (entry: TranscriptEntry) => void;
  updateTranscript: (id: string, updates: Partial<TranscriptEntry>) => void;

  // Q&A (dual-mode)
  questions: AnswerEntry[];
  addQuestion: (entry: AnswerEntry) => void;
  appendAnswerDelta: (questionId: string, delta: string, channel?: 'speed' | 'precise') => void;
  markChannelDone: (questionId: string, channel: 'speed' | 'precise') => void;
  markAnswerDone: (questionId: string) => void;

  // Resume
  resumeText: string | null;
  resumeFileName: string | null;
  setResume: (text: string, fileName: string) => void;
  clearResume: () => void;

  // Settings
  inputMode: 'audio' | 'manual';
  setInputMode: (mode: 'audio' | 'manual') => void;

  // Actions
  clearSession: () => void;
}

export const useInterviewStore = create<InterviewState>((set) => ({
  wsStatus: 'disconnected',
  setWsStatus: (wsStatus) => set({ wsStatus }),

  sessionId: null,
  setSessionId: (sessionId) => set({ sessionId }),

  answerMode: 'dual',
  setAnswerMode: (answerMode) => set({ answerMode }),

  isRecording: false,
  setIsRecording: (isRecording) => set({ isRecording }),
  recordingDuration: 0,
  setRecordingDuration: (recordingDuration) => set({ recordingDuration }),

  transcripts: [],
  addTranscript: (entry) =>
    set((s) => ({ transcripts: [...s.transcripts, entry] })),
  updateTranscript: (id, updates) =>
    set((s) => ({
      transcripts: s.transcripts.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    })),

  questions: [],
  addQuestion: (entry) =>
    set((s) => ({ questions: [entry, ...s.questions] })),
  appendAnswerDelta: (questionId, delta, channel) =>
    set((s) => ({
      questions: s.questions.map((q) => {
        if (q.questionId !== questionId) return q;
        if (channel === 'precise') {
          return { ...q, preciseAnswerText: q.preciseAnswerText + delta };
        }
        return { ...q, answerText: q.answerText + delta };
      }),
    })),
  markChannelDone: (questionId, channel) =>
    set((s) => ({
      questions: s.questions.map((q) => {
        if (q.questionId !== questionId) return q;
        const newSpeedDone = channel === 'speed' ? true : q.isSpeedDone;
        const newPreciseDone = channel === 'precise' ? true : q.isPreciseDone;
        const isGenerating = !(newSpeedDone && newPreciseDone);
        return {
          ...q,
          isSpeedDone: newSpeedDone,
          isPreciseDone: newPreciseDone,
          isGenerating,
        };
      }),
    })),
  markAnswerDone: (questionId) =>
    set((s) => ({
      questions: s.questions.map((q) =>
        q.questionId === questionId
          ? { ...q, isGenerating: false, isSpeedDone: true, isPreciseDone: true }
          : q
      ),
    })),

  resumeText: null,
  resumeFileName: null,
  setResume: (text, fileName) =>
    set({ resumeText: text, resumeFileName: fileName }),
  clearResume: () => set({ resumeText: null, resumeFileName: null }),

  inputMode: 'manual',
  setInputMode: (inputMode) => set({ inputMode }),

  clearSession: () =>
    set({
      transcripts: [],
      questions: [],
      isRecording: false,
      recordingDuration: 0,
    }),
}));
