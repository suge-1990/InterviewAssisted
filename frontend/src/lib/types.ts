// WebSocket message types
export interface TranscriptMessage {
  type: 'transcript';
  text: string;
  speaker: 'interviewer' | 'candidate' | 'unknown';
  is_final: boolean;
}

export interface QuestionMessage {
  type: 'question';
  text: string;
  id: string;
}

export interface AnswerMessage {
  type: 'answer';
  question_id: string;
  delta: string;
  done: boolean;
  channel?: 'speed' | 'precise';
}

export interface AnswerSpeedMessage {
  type: 'answer_speed';
  question_id: string;
  delta: string;
  done: boolean;
}

export interface AnswerPreciseMessage {
  type: 'answer_precise';
  question_id: string;
  delta: string;
  done: boolean;
}

export interface ErrorMessage {
  type: 'error';
  message: string;
}

export interface ReadyMessage {
  type: 'ready';
  message: string;
  session_id?: string;
  answer_mode?: string;
}

export interface PongMessage {
  type: 'pong';
}

export interface ModeChangedMessage {
  type: 'mode_changed';
  mode: 'speed' | 'precise' | 'dual';
}

export type WSMessage =
  | TranscriptMessage
  | QuestionMessage
  | AnswerMessage
  | AnswerSpeedMessage
  | AnswerPreciseMessage
  | ErrorMessage
  | ReadyMessage
  | PongMessage
  | ModeChangedMessage;

// UI state types
export interface TranscriptEntry {
  id: string;
  text: string;
  speaker: 'interviewer' | 'candidate' | 'unknown';
  isQuestion: boolean;
  questionId?: string;
  timestamp: Date;
  isFinal: boolean;
}

export interface AnswerEntry {
  questionId: string;
  questionText: string;
  answerText: string;          // speed channel answer (or single-mode)
  preciseAnswerText: string;   // precise channel answer
  isGenerating: boolean;
  isSpeedDone: boolean;
  isPreciseDone: boolean;
  timestamp: Date;
}

// API types
export interface AskRequest {
  question: string;
  resume_context?: string;
  conversation_history?: string[];
}

export interface ResumeUploadResponse {
  resume_id: string;
  file_name: string;
  text_preview: string;
  full_text: string;
}

export interface SessionInfo {
  session_id: string;
  lan_ip: string;
  connect_url: string;
  connect_code: string;
  connected_clients?: number;
}
