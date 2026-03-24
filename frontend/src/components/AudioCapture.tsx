'use client';

import { useCallback, useEffect } from 'react';
import { Mic, Square, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAudioStream } from '@/hooks/useAudioStream';
import { useInterviewStore } from '@/stores/interviewStore';
import type { AudioSource } from '@/hooks/useAudioStream';

interface AudioCaptureProps {
  onAudioData: (blob: Blob, source: AudioSource) => void;
}

export function AudioCapture({ onAudioData }: AudioCaptureProps) {
  const { setIsRecording, setRecordingDuration } = useInterviewStore();
  const {
    isRecording,
    startRecording,
    stopRecording,
    audioLevel,
    duration,
    error,
    systemAudioActive,
  } = useAudioStream({ onAudioData });

  useEffect(() => {
    setIsRecording(isRecording);
  }, [isRecording, setIsRecording]);

  useEffect(() => {
    setRecordingDuration(duration);
  }, [duration, setRecordingDuration]);

  const handleToggle = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Volume bars
  const bars = 5;
  const barHeights = Array.from({ length: bars }, (_, i) => {
    const threshold = (i + 1) * (100 / bars);
    return audioLevel >= threshold ? 100 : Math.max(20, (audioLevel / threshold) * 100);
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <Button
          variant={isRecording ? 'destructive' : 'default'}
          size="sm"
          onClick={handleToggle}
          className="gap-1.5"
        >
          {isRecording ? (
            <>
              <Square className="w-3.5 h-3.5" />
              停止
            </>
          ) : (
            <>
              <Mic className="w-3.5 h-3.5" />
              录音
            </>
          )}
        </Button>

        {/* Volume indicator */}
        {isRecording && (
          <div className="flex items-end gap-0.5 h-4">
            {barHeights.map((h, i) => (
              <div
                key={i}
                className="w-1 bg-emerald-400 rounded-full transition-all duration-100"
                style={{ height: `${h}%`, minHeight: 3 }}
              />
            ))}
          </div>
        )}
      </div>

      {/* System audio status */}
      {isRecording && (
        <div className="flex items-center gap-1.5">
          <Monitor className="w-3 h-3" />
          {systemAudioActive ? (
            <span className="text-[10px] text-emerald-400">系统音频已采集</span>
          ) : (
            <span className="text-[10px] text-[#9A9AB0]">系统音频未开启</span>
          )}
        </div>
      )}

      {error && (
        <span className="text-xs text-destructive">{error}</span>
      )}
    </div>
  );
}
