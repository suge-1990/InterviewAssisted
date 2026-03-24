'use client';

import { useState, useCallback } from 'react';
import { Send, Loader2, Clipboard, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn, getApiUrl } from '@/lib/utils';

interface ExamAnswer {
  id: string;
  questionText: string;
  answerText: string;
  isGenerating: boolean;
  imageUrl?: string;
  timestamp: Date;
}

export default function ExamPage() {
  const [questionText, setQuestionText] = useState('');
  const [answers, setAnswers] = useState<ExamAnswer[]>([]);
  const [loading, setLoading] = useState(false);
  const [pastedImage, setPastedImage] = useState<string | null>(null);
  // fileInputRef reserved for future screenshot upload

  const handleSolve = useCallback(async () => {
    const text = questionText.trim();
    if (!text || loading) return;

    const id = `exam_${Date.now()}`;
    const newAnswer: ExamAnswer = {
      id,
      questionText: text,
      answerText: '',
      isGenerating: true,
      imageUrl: pastedImage || undefined,
      timestamp: new Date(),
    };

    setAnswers((prev) => [newAnswer, ...prev]);
    setQuestionText('');
    setPastedImage(null);
    setLoading(true);

    try {
      const res = await fetch(`${getApiUrl()}/chat/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: `笔试题目：${text}\n\n请给出完整解答，如果是编程题请给出可运行的代码。` }),
      });

      if (!res.ok || !res.body) throw new Error('Request failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter((l) => l.startsWith('data: '));

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.done) {
              setAnswers((prev) =>
                prev.map((a) => (a.id === id ? { ...a, isGenerating: false } : a))
              );
            } else if (data.delta) {
              setAnswers((prev) =>
                prev.map((a) => (a.id === id ? { ...a, answerText: a.answerText + data.delta } : a))
              );
            }
          } catch { /* ignore */ }
        }
      }
    } catch {
      setAnswers((prev) =>
        prev.map((a) => (a.id === id ? { ...a, answerText: a.answerText + '\n[错误：解题失败]', isGenerating: false } : a))
      );
    } finally {
      setLoading(false);
    }
  }, [questionText, loading, pastedImage]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => setPastedImage(ev.target?.result as string);
          reader.readAsDataURL(file);
        }
      }
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSolve();
    }
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Input area */}
      <div className="border-b border-white/[0.06] p-4 bg-[#13131a]">
        <div className="max-w-4xl mx-auto space-y-3">
          <h1 className="text-lg font-bold">笔试辅助</h1>
          <p className="text-xs text-[#9A9AB0]">粘贴题目文本或截图，AI 为你解答</p>

          {pastedImage && (
            <div className="relative inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pastedImage} alt="题目截图" className="max-h-40 rounded-lg border border-white/[0.06]" />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6 bg-black/50"
                onClick={() => setPastedImage(null)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          )}

          <div className="flex gap-2 items-end">
            <Textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="粘贴题目文本，或 Ctrl+V 粘贴截图（回车发送）..."
              className="min-h-[60px] max-h-[200px] resize-none bg-[#0F0F14] border-white/[0.06] text-sm"
              rows={2}
            />
            <div className="flex flex-col gap-1">
              <Button size="icon" onClick={handleSolve} disabled={!questionText.trim() || loading} className="h-10 w-10">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Answers */}
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {answers.length === 0 && (
            <div className="text-center py-16">
              <Clipboard className="w-10 h-10 mx-auto text-[#5A5A72] mb-3" />
              <p className="text-sm text-[#9A9AB0]">粘贴题目开始解题</p>
              <p className="text-xs text-[#5A5A72] mt-1">支持文本粘贴和截图粘贴</p>
            </div>
          )}

          {answers.map((answer) => (
            <Card key={answer.id} className={cn(
              'border-white/[0.06] bg-[#1A1A24]',
              answer.isGenerating && 'ring-1 ring-indigo-500/30',
            )}>
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-start justify-between">
                  <p className="text-sm font-medium text-indigo-400">{answer.questionText}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-[#9A9AB0] shrink-0"
                    onClick={() => handleCopy(answer.answerText)}
                    disabled={!answer.answerText}
                  >
                    复制
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="text-sm text-[#F0F0F5]/90 whitespace-pre-wrap leading-relaxed font-mono">
                  {answer.answerText}
                  {answer.isGenerating && (
                    <span className="inline-block w-0.5 h-4 bg-indigo-400 ml-0.5 animate-pulse" />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
