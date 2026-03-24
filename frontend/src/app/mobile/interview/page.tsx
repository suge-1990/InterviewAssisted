'use client';

import { Suspense, useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Wifi, WifiOff, Sparkles, Zap, Target, Copy, Check, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

import { getWsUrl } from '@/lib/utils';

interface MobileAnswer {
  questionId: string;
  questionText: string;
  speedText: string;
  preciseText: string;
  isSpeedDone: boolean;
  isPreciseDone: boolean;
}

export default function MobileInterviewWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0F0F14] flex items-center justify-center"><Sparkles className="w-8 h-8 text-indigo-500 animate-pulse" /></div>}>
      <MobileInterviewPage />
    </Suspense>
  );
}

function MobileInterviewPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session') || '';
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [answers, setAnswers] = useState<MobileAnswer[]>([]);
  const [duration, setDuration] = useState(0);
  const [manualInput, setManualInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sessionId) return;

    setStatus('connecting');
    const ws = new WebSocket(`${getWsUrl()}/viewer?session=${sessionId}`);
    wsRef.current = ws;

    ws.onopen = () => setStatus('connected');
    ws.onclose = () => {
      setStatus('disconnected');
      // Auto-reconnect after 3s
      setTimeout(() => {
        if (wsRef.current === ws) {
          setStatus('connecting');
          const newWs = new WebSocket(`${getWsUrl()}/viewer?session=${sessionId}`);
          wsRef.current = newWs;
          newWs.onopen = () => setStatus('connected');
          newWs.onclose = () => setStatus('disconnected');
          newWs.onerror = () => setStatus('disconnected');
          newWs.onmessage = ws.onmessage;
        }
      }, 3000);
    };
    ws.onerror = () => setStatus('disconnected');

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'question') {
          setAnswers((prev) => [{
            questionId: msg.id,
            questionText: msg.text,
            speedText: '',
            preciseText: '',
            isSpeedDone: false,
            isPreciseDone: false,
          }, ...prev]);
          topRef.current?.scrollIntoView({ behavior: 'smooth' });
        }

        if (msg.type === 'answer_speed') {
          if (msg.done) {
            setAnswers((prev) => prev.map((a) =>
              a.questionId === msg.question_id ? { ...a, isSpeedDone: true } : a
            ));
          } else {
            setAnswers((prev) => prev.map((a) =>
              a.questionId === msg.question_id ? { ...a, speedText: a.speedText + msg.delta } : a
            ));
          }
        }

        if (msg.type === 'answer_precise') {
          if (msg.done) {
            setAnswers((prev) => prev.map((a) =>
              a.questionId === msg.question_id ? { ...a, isPreciseDone: true } : a
            ));
          } else {
            setAnswers((prev) => prev.map((a) =>
              a.questionId === msg.question_id ? { ...a, preciseText: a.preciseText + msg.delta } : a
            ));
          }
        }
      } catch { /* ignore */ }
    };

    return () => ws.close();
  }, [sessionId]);

  // Duration timer
  useEffect(() => {
    if (status !== 'connected') return;
    const timer = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(timer);
  }, [status]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const handleCopy = useCallback(async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleManualSend = useCallback(() => {
    const text = manualInput.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'manual_input', question: text }));
    setManualInput('');
  }, [manualInput]);

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-[#0F0F14] flex items-center justify-center p-6">
        <div className="text-center">
          <Sparkles className="w-12 h-12 mx-auto text-indigo-500 mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">面试助手 - 副屏</h1>
          <p className="text-sm text-[#9A9AB0]">请从 PC 端扫描二维码进入</p>
        </div>
      </div>
    );
  }

  const isGenerating = (a: MobileAnswer) => !(a.isSpeedDone && a.isPreciseDone);

  return (
    <div className="min-h-screen bg-[#0F0F14] flex flex-col">
      {/* Status bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 bg-[#13131a] border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          {status === 'connected' ? (
            <Wifi className="w-4 h-4 text-emerald-400" />
          ) : (
            <WifiOff className="w-4 h-4 text-[#9A9AB0]" />
          )}
          <span className="text-xs text-[#9A9AB0]">
            {status === 'connected' ? '已连接' : status === 'connecting' ? '连接中...' : '未连接'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-[#5A5A72]">Q{answers.length}</span>
          <span className="text-xs text-[#9A9AB0] font-mono">{formatDuration(duration)}</span>
        </div>
      </div>

      {/* Answers */}
      <div className="flex-1 p-4 space-y-4 pb-20">
        <div ref={topRef} />
        {answers.length === 0 && (
          <div className="text-center py-16">
            <p className="text-sm text-[#9A9AB0]">等待面试问题...</p>
            <p className="text-xs text-[#5A5A72] mt-2">PC 端检测到问题后会自动同步到此</p>
          </div>
        )}
        {answers.map((a) => (
          <div key={a.questionId}
            className={cn(
              'rounded-xl border border-white/[0.06] bg-[#1A1A24] overflow-hidden',
              isGenerating(a) && 'ring-1 ring-indigo-500/30',
            )}>
            {/* Question */}
            <div className="px-4 py-3 border-b border-white/[0.04]">
              <p className="text-sm font-medium text-indigo-400">{a.questionText}</p>
            </div>

            {/* Speed answer */}
            <div className="px-4 py-3 border-b border-white/[0.04]">
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-400 uppercase tracking-wider">
                  <Zap className="w-3 h-3" /> 极速回答
                </span>
                <button onClick={() => handleCopy(a.speedText, `speed-${a.questionId}`)}
                  className="text-[#5A5A72] active:text-white p-1">
                  {copiedId === `speed-${a.questionId}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[15px] text-white/90 whitespace-pre-wrap leading-relaxed">
                {a.speedText}
                {!a.isSpeedDone && <span className="inline-block w-0.5 h-5 bg-amber-400 ml-0.5 animate-pulse" />}
              </p>
            </div>

            {/* Precise answer */}
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
                  <Target className="w-3 h-3" /> 精确回答
                </span>
                <button onClick={() => handleCopy(a.preciseText, `precise-${a.questionId}`)}
                  className="text-[#5A5A72] active:text-white p-1">
                  {copiedId === `precise-${a.questionId}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[15px] text-white/90 whitespace-pre-wrap leading-relaxed">
                {a.preciseText || (!a.isPreciseDone ? <span className="text-[#5A5A72] text-xs">检索中...</span> : '')}
                {!a.isPreciseDone && a.preciseText && <span className="inline-block w-0.5 h-5 bg-emerald-400 ml-0.5 animate-pulse" />}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom bar: manual input */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#13131a] border-t border-white/[0.06] px-4 py-3 safe-area-bottom">
        <div className="flex gap-2">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleManualSend()}
            placeholder="手动输入问题..."
            className="flex-1 px-3 py-2 rounded-lg bg-[#0F0F14] border border-white/[0.06] text-sm text-white placeholder:text-[#5A5A72] focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
          />
          <button onClick={handleManualSend}
            disabled={!manualInput.trim()}
            className="px-3 py-2 rounded-lg bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
