'use client';

import { useEffect, useRef, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useInterviewStore } from '@/stores/interviewStore';
import { cn } from '@/lib/utils';

export function TranscriptPanel() {
  const { transcripts } = useInterviewStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcripts, autoScroll]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    setAutoScroll(atBottom);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2.5 border-b border-border/50">
        <h2 className="text-sm font-semibold tracking-tight">实时转写</h2>
      </div>
      <ScrollArea className="flex-1" onScrollCapture={handleScroll}>
        <div className="p-4 space-y-2">
          {transcripts.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              开始录音或在下方输入问题
            </p>
          )}
          {transcripts.map((entry) => (
            <div
              key={entry.id}
              className={cn(
                'text-sm px-3 py-2 rounded-lg transition-colors',
                entry.isQuestion && 'border-l-2 border-indigo-500 bg-indigo-500/[0.08]',
                !entry.isFinal && 'opacity-50',
                entry.speaker === 'interviewer' && 'text-blue-300',
                entry.speaker === 'candidate' && 'text-indigo-300',
                entry.speaker === 'unknown' && 'text-foreground/80',
              )}
            >
              <span className="text-[10px] uppercase text-muted-foreground mr-2">
                {entry.speaker === 'interviewer' ? '面试官' : entry.speaker === 'candidate' ? '我' : '发言人'}
              </span>
              {entry.text}
              {entry.isQuestion && (
                <span className="ml-2 text-[10px] text-indigo-400 font-medium">问题</span>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  );
}
