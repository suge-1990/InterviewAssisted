'use client';

import { useState, useCallback, useRef } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useInterviewStore } from '@/stores/interviewStore';

import { getApiUrl } from '@/lib/utils';

interface ManualInputProps {
  sendCommand?: (cmd: object) => void;
  wsConnected?: boolean;
}

export function ManualInput({ sendCommand, wsConnected }: ManualInputProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { addQuestion, appendAnswerDelta, markAnswerDone, resumeText } = useInterviewStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(async () => {
    const question = input.trim();
    if (!question || loading) return;

    setInput('');
    setLoading(true);

    const questionId = `q_${Date.now().toString(36)}`;

    addQuestion({
      questionId,
      questionText: question,
      answerText: '',
      preciseAnswerText: '',
      isGenerating: true,
      isSpeedDone: false,
      isPreciseDone: true,  // manual input only uses speed channel
      timestamp: new Date(),
    });

    // If WebSocket is connected, send via WS for unified handling
    if (wsConnected && sendCommand) {
      sendCommand({ command: 'ask', text: question });
      setLoading(false);
      return;
    }

    // Otherwise use HTTP SSE
    try {
      const res = await fetch(`${getApiUrl()}/chat/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          resume_context: resumeText || undefined,
        }),
      });

      if (!res.ok || !res.body) throw new Error('Request failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n').filter((l) => l.startsWith('data: '));

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.done) {
              markAnswerDone(questionId);
            } else if (data.delta) {
              appendAnswerDelta(questionId, data.delta);
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch {
      appendAnswerDelta(questionId, '\n[错误：获取答案失败]');
    } finally {
      markAnswerDone(questionId);
      setLoading(false);
    }
  }, [input, loading, wsConnected, sendCommand, resumeText, addQuestion, appendAnswerDelta, markAnswerDone]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-border/50 p-3 bg-card/30">
      <div className="flex gap-2 items-end">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入面试问题（回车发送，Shift+回车换行）..."
          className="min-h-[40px] max-h-[120px] resize-none bg-background/50 border-border/50 text-sm"
          rows={1}
        />
        <Button
          size="icon"
          onClick={handleSubmit}
          disabled={!input.trim() || loading}
          className="shrink-0 h-10 w-10"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}
