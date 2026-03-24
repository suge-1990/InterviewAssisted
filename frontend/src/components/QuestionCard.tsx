'use client';

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Check, Square, ChevronDown, ChevronUp, Zap, Target } from 'lucide-react';
import type { AnswerEntry } from '@/lib/types';
import { cn } from '@/lib/utils';

interface QuestionCardProps {
  entry: AnswerEntry;
  onStop?: (questionId: string) => void;
  autoCollapse?: boolean;
  dualMode?: boolean;
}

export function QuestionCard({ entry, onStop, autoCollapse = false, dualMode = false }: QuestionCardProps) {
  const [copied, setCopied] = useState<'speed' | 'precise' | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (autoCollapse && !entry.isGenerating) {
      setCollapsed(true);
    }
  }, [autoCollapse, entry.isGenerating]);

  const handleCopy = useCallback(async (text: string, channel: 'speed' | 'precise') => {
    await navigator.clipboard.writeText(text);
    setCopied(channel);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const speedLines = entry.answerText.split('\n');
  const preciseLines = entry.preciseAnswerText.split('\n');
  const canCollapse = !entry.isGenerating && (speedLines.length > 4 || preciseLines.length > 4);

  const showDual = dualMode && (entry.preciseAnswerText || !entry.isPreciseDone);

  return (
    <Card className={cn(
      'border-border/50 bg-card/80 transition-all duration-300',
      entry.isGenerating && 'ring-1 ring-indigo-500/30 shadow-lg shadow-indigo-500/5',
      !entry.isGenerating && collapsed && 'opacity-80',
    )}>
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {entry.isGenerating && (
                <span className="shrink-0 relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
                </span>
              )}
              <p className={cn(
                'text-sm font-medium leading-snug',
                entry.isGenerating ? 'text-indigo-400' : 'text-indigo-400/70',
              )}>
                {entry.questionText}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {entry.isGenerating && onStop && (
              <Button variant="ghost" size="icon" className="h-6 w-6"
                onClick={() => onStop(entry.questionId)} title="停止生成">
                <Square className="w-3 h-3" />
              </Button>
            )}
            {canCollapse && (
              <Button variant="ghost" size="icon" className="h-6 w-6"
                onClick={() => setCollapsed(!collapsed)} title={collapsed ? '展开' : '收起'}>
                {collapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        {showDual && !collapsed ? (
          // Dual-mode: speed + precise side by side
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Speed channel */}
            <div className="rounded-lg bg-[#0F0F14] p-3 border border-white/[0.04]">
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-400 uppercase tracking-wider">
                  <Zap className="w-3 h-3" /> 极速
                </span>
                <Button variant="ghost" size="icon" className="h-5 w-5"
                  onClick={() => handleCopy(entry.answerText, 'speed')} disabled={!entry.answerText}>
                  {copied === 'speed' ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                </Button>
              </div>
              <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                {entry.answerText}
                {!entry.isSpeedDone && (
                  <span className="inline-block w-0.5 h-4 bg-amber-400 ml-0.5 animate-pulse" />
                )}
              </div>
            </div>
            {/* Precise channel */}
            <div className="rounded-lg bg-[#0F0F14] p-3 border border-white/[0.04]">
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
                  <Target className="w-3 h-3" /> 精确
                </span>
                <Button variant="ghost" size="icon" className="h-5 w-5"
                  onClick={() => handleCopy(entry.preciseAnswerText, 'precise')} disabled={!entry.preciseAnswerText}>
                  {copied === 'precise' ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                </Button>
              </div>
              <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                {entry.preciseAnswerText || (
                  <span className="text-[#5A5A72] text-xs">检索中...</span>
                )}
                {!entry.isPreciseDone && entry.preciseAnswerText && (
                  <span className="inline-block w-0.5 h-4 bg-emerald-400 ml-0.5 animate-pulse" />
                )}
              </div>
            </div>
          </div>
        ) : (
          // Single mode or collapsed
          <div>
            <div className={cn('text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed')}>
              {collapsed
                ? speedLines.slice(0, 3).join('\n') + '...'
                : entry.answerText}
              {entry.isGenerating && !collapsed && (
                <span className="inline-block w-0.5 h-4 bg-indigo-400 ml-0.5 animate-pulse" />
              )}
            </div>
            {!collapsed && !showDual && entry.answerText && (
              <div className="flex justify-end mt-2">
                <Button variant="ghost" size="icon" className="h-6 w-6"
                  onClick={() => handleCopy(entry.answerText, 'speed')}>
                  {copied === 'speed' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
