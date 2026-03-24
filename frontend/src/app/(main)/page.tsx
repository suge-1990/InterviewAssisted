'use client';

import { useCallback, useEffect, useState } from 'react';
import { Trash2, MessageSquare, Mic, Settings2, X, ChevronUp, Zap, Target, Layers, Smartphone } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { StatusBar } from '@/components/StatusBar';
import { AudioCapture } from '@/components/AudioCapture';
import { TranscriptPanel } from '@/components/TranscriptPanel';
import { AnswerPanel } from '@/components/AnswerPanel';
import { ManualInput } from '@/components/ManualInput';
import { ResumeUpload } from '@/components/ResumeUpload';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useInterviewStore } from '@/stores/interviewStore';
import { cn } from '@/lib/utils';
import type { WSMessage, SessionInfo } from '@/lib/types';

import { getWsUrl, getApiUrl } from '@/lib/utils';

type MobileTab = 'transcript' | 'answer';

export default function InterviewPage() {
  const store = useInterviewStore();
  const [mobileTab, setMobileTab] = useState<MobileTab>('answer');
  const [showMobileControls, setShowMobileControls] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);

  const handleWSMessage = useCallback((msg: WSMessage) => {
    switch (msg.type) {
      case 'ready': {
        if (msg.session_id) {
          store.setSessionId(msg.session_id);
          // Fetch session connect info for QR code
          fetch(`${getApiUrl()}/session/${msg.session_id}/connect-info`)
            .then((r) => r.json())
            .then((info) => setSessionInfo(info))
            .catch(() => {});
        }
        if (msg.answer_mode) {
          store.setAnswerMode(msg.answer_mode as 'speed' | 'precise' | 'dual');
        }
        break;
      }
      case 'transcript': {
        const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        store.addTranscript({
          id,
          text: msg.text,
          speaker: msg.speaker,
          isQuestion: false,
          timestamp: new Date(),
          isFinal: msg.is_final,
        });
        break;
      }
      case 'question': {
        const transcripts = useInterviewStore.getState().transcripts;
        const last = transcripts[transcripts.length - 1];
        if (last) {
          store.updateTranscript(last.id, { isQuestion: true, questionId: msg.id });
        }
        store.addQuestion({
          questionId: msg.id,
          questionText: msg.text,
          answerText: '',
          preciseAnswerText: '',
          isGenerating: true,
          isSpeedDone: false,
          isPreciseDone: store.answerMode !== 'dual',  // If not dual, precise is "done"
          timestamp: new Date(),
        });
        setMobileTab('answer');
        break;
      }
      case 'answer_speed': {
        if (msg.done) {
          store.markChannelDone(msg.question_id, 'speed');
        } else {
          store.appendAnswerDelta(msg.question_id, msg.delta, 'speed');
        }
        break;
      }
      case 'answer_precise': {
        if (msg.done) {
          store.markChannelDone(msg.question_id, 'precise');
        } else {
          store.appendAnswerDelta(msg.question_id, msg.delta, 'precise');
        }
        break;
      }
      case 'answer': {
        // Legacy single-mode fallback
        if (msg.done) {
          store.markAnswerDone(msg.question_id);
        } else {
          store.appendAnswerDelta(msg.question_id, msg.delta);
        }
        break;
      }
      case 'mode_changed': {
        store.setAnswerMode(msg.mode);
        break;
      }
      case 'error': {
        console.error('WS Error:', msg.message);
        break;
      }
    }
  }, [store]);

  const { status, sendAudio, sendCommand } = useWebSocket({
    url: `${getWsUrl()}/audio`,
    onMessage: handleWSMessage,
    onStatusChange: store.setWsStatus,
  });

  useEffect(() => {
    if (store.resumeText && status === 'connected') {
      sendCommand({ command: 'set_resume', resume_text: store.resumeText });
    }
  }, [store.resumeText, status, sendCommand]);

  const handleStopAnswer = useCallback((questionId: string) => {
    sendCommand({ command: 'stop_answer', question_id: questionId });
    store.markAnswerDone(questionId);
  }, [sendCommand, store]);

  const handleResumeUploaded = useCallback((text: string) => {
    if (status === 'connected') {
      sendCommand({ command: 'set_resume', resume_text: text });
    }
  }, [status, sendCommand]);

  const handleAnswerModeChange = useCallback((mode: 'speed' | 'precise' | 'dual') => {
    store.setAnswerMode(mode);
    sendCommand({ command: 'set_answer_mode', mode });
  }, [store, sendCommand]);

  const newAnswerCount = store.questions.filter((q) => q.isGenerating).length;

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      <StatusBar />

      {/* Mobile tab switcher */}
      <div className="md:hidden flex border-b border-white/[0.06] bg-[#13131a]">
        <button onClick={() => setMobileTab('transcript')}
          className={cn('flex-1 py-2 text-xs font-medium text-center transition-colors relative',
            mobileTab === 'transcript' ? 'text-indigo-400' : 'text-[#5A5A72]')}>
          实时转写
          {mobileTab === 'transcript' && <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-indigo-500 rounded-full" />}
        </button>
        <button onClick={() => setMobileTab('answer')}
          className={cn('flex-1 py-2 text-xs font-medium text-center transition-colors relative',
            mobileTab === 'answer' ? 'text-indigo-400' : 'text-[#5A5A72]')}>
          AI 答案
          {newAnswerCount > 0 && mobileTab !== 'answer' && (
            <span className="absolute top-1.5 ml-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] text-white">{newAnswerCount}</span>
          )}
          {mobileTab === 'answer' && <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-indigo-500 rounded-full" />}
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className="w-56 border-r border-white/[0.06] flex-col bg-[#13131a] shrink-0 hidden lg:flex">
          <div className="p-4 border-b border-white/[0.06] space-y-3">
            <h3 className="text-[10px] font-semibold text-[#5A5A72] uppercase tracking-[0.1em]">语音采集</h3>
            <AudioCapture onAudioData={sendAudio} />
          </div>
          <div className="p-4 border-b border-white/[0.06] space-y-3">
            <h3 className="text-[10px] font-semibold text-[#5A5A72] uppercase tracking-[0.1em]">简历</h3>
            <ResumeUpload onResumeUploaded={handleResumeUploaded} />
          </div>

          {/* Answer mode toggle */}
          <div className="p-4 border-b border-white/[0.06] space-y-3">
            <h3 className="text-[10px] font-semibold text-[#5A5A72] uppercase tracking-[0.1em]">回答模式</h3>
            <div className="flex flex-col gap-1">
              {([
                { mode: 'dual' as const, label: '双模式', icon: Layers },
                { mode: 'speed' as const, label: '极速', icon: Zap },
                { mode: 'precise' as const, label: '精确', icon: Target },
              ]).map(({ mode, label, icon: Icon }) => (
                <Button key={mode} variant="ghost" size="sm"
                  className={cn('justify-start text-xs gap-1.5 h-7',
                    store.answerMode === mode ? 'text-indigo-400 bg-indigo-500/10' : 'text-[#9A9AB0] hover:text-white')}
                  onClick={() => handleAnswerModeChange(mode)}>
                  <Icon className="w-3 h-3" /> {label}
                </Button>
              ))}
            </div>
          </div>

          {/* Input mode toggle */}
          <div className="p-4 border-b border-white/[0.06] space-y-3">
            <h3 className="text-[10px] font-semibold text-[#5A5A72] uppercase tracking-[0.1em]">输入方式</h3>
            <div className="flex gap-1 p-0.5 bg-[#0F0F14] rounded-lg">
              <Button variant={store.inputMode === 'audio' ? 'default' : 'ghost'} size="sm"
                className={`flex-1 text-xs gap-1.5 h-7 ${store.inputMode === 'audio' ? 'bg-indigo-500 hover:bg-indigo-600 shadow-md shadow-indigo-500/25' : 'text-[#9A9AB0] hover:text-white'}`}
                onClick={() => store.setInputMode('audio')}>
                <Mic className="w-3 h-3" /> 语音
              </Button>
              <Button variant={store.inputMode === 'manual' ? 'default' : 'ghost'} size="sm"
                className={`flex-1 text-xs gap-1.5 h-7 ${store.inputMode === 'manual' ? 'bg-indigo-500 hover:bg-indigo-600 shadow-md shadow-indigo-500/25' : 'text-[#9A9AB0] hover:text-white'}`}
                onClick={() => store.setInputMode('manual')}>
                <MessageSquare className="w-3 h-3" /> 文字
              </Button>
            </div>
          </div>

          <div className="flex-1" />

          {/* Mobile QR connect + clear */}
          <div className="p-4 border-t border-white/[0.06] space-y-2">
            <Button variant="ghost" size="sm"
              className="w-full justify-start text-xs text-[#5A5A72] hover:text-white gap-2 h-8"
              onClick={() => setShowQRCode(!showQRCode)}>
              <Smartphone className="w-3 h-3" /> 手机连接
            </Button>
            <Button variant="ghost" size="sm"
              className="w-full justify-start text-xs text-[#5A5A72] hover:text-white gap-2 h-8"
              onClick={() => store.clearSession()}>
              <Trash2 className="w-3 h-3" /> 清除会话
            </Button>
          </div>
        </aside>

        {/* Transcript Panel */}
        <div className={cn(
          'flex-1 flex flex-col min-w-0 border-r border-white/[0.06] bg-[#0F0F14]',
          mobileTab !== 'transcript' && 'hidden md:flex',
        )}>
          <TranscriptPanel />
        </div>

        <div className="w-px bg-gradient-to-b from-transparent via-indigo-500/20 to-transparent hidden md:block" />

        {/* Answer Panel */}
        <div className={cn(
          'flex-1 flex flex-col min-w-0 bg-[#0F0F14]',
          mobileTab !== 'answer' && 'hidden md:flex',
        )}>
          <AnswerPanel onStopAnswer={handleStopAnswer} dualMode={store.answerMode === 'dual'} />
        </div>
      </div>

      {/* Bottom input */}
      <ManualInput sendCommand={sendCommand} wsConnected={status === 'connected'} />

      {/* QR Code modal */}
      {showQRCode && sessionInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowQRCode(false)}>
          <div className="bg-[#1A1A24] border border-white/[0.08] rounded-2xl p-6 w-80 text-center space-y-4"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">手机扫码连接</h3>
              <button onClick={() => setShowQRCode(false)} className="text-[#5A5A72] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-white rounded-xl p-4 inline-block mx-auto">
              <QRCodeSVG value={sessionInfo.connect_url} size={180} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-[#9A9AB0]">或手动输入连接码</p>
              <p className="text-2xl font-mono font-bold text-indigo-400 tracking-widest">{sessionInfo.connect_code}</p>
            </div>
            <p className="text-[10px] text-[#5A5A72]">手机与电脑需在同一 WiFi 网络</p>
          </div>
        </div>
      )}

      {/* Mobile: floating controls button */}
      <div className="md:hidden fixed right-4 bottom-24 z-40 flex flex-col items-end gap-2">
        {showMobileControls && (
          <div className="bg-[#1A1A24] border border-white/[0.08] rounded-2xl p-4 w-64 space-y-4 shadow-2xl shadow-black/50 animate-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#9A9AB0] uppercase tracking-wider">控制面板</span>
              <button onClick={() => setShowMobileControls(false)} className="text-[#5A5A72] active:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              <h4 className="text-[10px] font-semibold text-[#5A5A72] uppercase tracking-[0.1em]">语音采集</h4>
              <AudioCapture onAudioData={sendAudio} />
            </div>
            <div className="space-y-2">
              <h4 className="text-[10px] font-semibold text-[#5A5A72] uppercase tracking-[0.1em]">简历</h4>
              <ResumeUpload onResumeUploaded={handleResumeUploaded} />
            </div>
            <div className="space-y-2">
              <h4 className="text-[10px] font-semibold text-[#5A5A72] uppercase tracking-[0.1em]">回答模式</h4>
              <div className="flex gap-1 p-0.5 bg-[#0F0F14] rounded-lg">
                {([
                  { mode: 'dual' as const, label: '双模式' },
                  { mode: 'speed' as const, label: '极速' },
                  { mode: 'precise' as const, label: '精确' },
                ]).map(({ mode, label }) => (
                  <Button key={mode} variant={store.answerMode === mode ? 'default' : 'ghost'} size="sm"
                    className={cn('flex-1 text-[10px] h-7',
                      store.answerMode === mode ? 'bg-indigo-500 hover:bg-indigo-600 shadow-md shadow-indigo-500/25' : 'text-[#9A9AB0]')}
                    onClick={() => handleAnswerModeChange(mode)}>
                    {label}
                  </Button>
                ))}
              </div>
            </div>
            <Button variant="ghost" size="sm"
              className="w-full justify-start text-xs text-[#5A5A72] hover:text-white gap-2 h-8"
              onClick={() => { store.clearSession(); setShowMobileControls(false); }}>
              <Trash2 className="w-3 h-3" /> 清除会话
            </Button>
          </div>
        )}
        <button
          onClick={() => setShowMobileControls(!showMobileControls)}
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all',
            showMobileControls ? 'bg-[#1A1A24] border border-white/[0.08]' : 'bg-indigo-500 shadow-indigo-500/30',
            store.isRecording && !showMobileControls && 'bg-red-500 shadow-red-500/30 animate-pulse',
          )}>
          {showMobileControls ? <ChevronUp className="w-5 h-5 text-white" />
            : store.isRecording ? <Mic className="w-5 h-5 text-white" />
            : <Settings2 className="w-5 h-5 text-white" />}
        </button>
      </div>
    </div>
  );
}
