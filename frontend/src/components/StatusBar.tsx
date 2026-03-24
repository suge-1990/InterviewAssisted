'use client';

import { useInterviewStore } from '@/stores/interviewStore';
import { Mic, MicOff, Wifi, WifiOff, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function StatusBar() {
  const { wsStatus, isRecording, recordingDuration, resumeFileName } = useInterviewStore();

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-4 px-4 py-2 border-b border-border/50 bg-card/50 backdrop-blur-sm">
      {/* Connection status */}
      <div className="flex items-center gap-1.5">
        {wsStatus === 'connected' ? (
          <Wifi className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <WifiOff className="w-3.5 h-3.5 text-muted-foreground" />
        )}
        <Badge
          variant={wsStatus === 'connected' ? 'default' : 'secondary'}
          className="text-[10px] px-1.5 py-0"
        >
          {wsStatus === 'connected' ? '已连接' : wsStatus === 'connecting' ? '连接中...' : '未连接'}
        </Badge>
      </div>

      {/* Recording status */}
      <div className="flex items-center gap-1.5">
        {isRecording ? (
          <>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
            <Mic className="w-3.5 h-3.5 text-red-400" />
            <span className="text-xs text-red-400 font-mono">{formatDuration(recordingDuration)}</span>
          </>
        ) : (
          <MicOff className="w-3.5 h-3.5 text-muted-foreground" />
        )}
      </div>

      {/* Resume status */}
      {resumeFileName && (
        <div className="flex items-center gap-1.5 ml-auto">
          <FileText className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-xs text-muted-foreground truncate max-w-[150px]">{resumeFileName}</span>
        </div>
      )}
    </div>
  );
}
