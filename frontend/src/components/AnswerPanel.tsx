'use client';

import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useInterviewStore } from '@/stores/interviewStore';
import { QuestionCard } from './QuestionCard';

interface AnswerPanelProps {
  onStopAnswer?: (questionId: string) => void;
  dualMode?: boolean;
}

export function AnswerPanel({ onStopAnswer, dualMode = false }: AnswerPanelProps) {
  const { questions } = useInterviewStore();
  const topRef = useRef<HTMLDivElement>(null);

  const generatingCount = questions.filter((q) => q.isGenerating).length;

  // Auto-scroll to top when a new question arrives
  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [questions.length]);

  // Sort: generating first (newest on top), then completed (newest on top)
  const sorted = [...questions].sort((a, b) => {
    if (a.isGenerating && !b.isGenerating) return -1;
    if (!a.isGenerating && b.isGenerating) return 1;
    return b.timestamp.getTime() - a.timestamp.getTime();
  });

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2.5 border-b border-border/50 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight">AI 参考答案</h2>
        {generatingCount > 0 && (
          <span className="flex items-center gap-1.5 text-[10px] text-emerald-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            {generatingCount > 1 ? `${generatingCount} 个答案生成中` : '生成中'}
          </span>
        )}
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          <div ref={topRef} />
          {questions.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              检测到面试问题后，AI 答案将在此显示
            </p>
          )}
          {sorted.map((entry, index) => (
            <QuestionCard
              key={entry.questionId}
              entry={entry}
              onStop={onStopAnswer}
              autoCollapse={!entry.isGenerating && index > 0 && generatingCount > 0}
              dualMode={dualMode}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
