'use client';

import { useCallback, useRef, useState } from 'react';

export type AudioSource = 'mic' | 'system';

interface UseAudioStreamOptions {
  onAudioData: (blob: Blob, source: AudioSource) => void;
  timeslice?: number;
}

export function useAudioStream({ onAudioData, timeslice = 500 }: UseAudioStreamOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [systemAudioActive, setSystemAudioActive] = useState(false);

  const onAudioDataRef = useRef(onAudioData);
  onAudioDataRef.current = onAudioData;

  const micRecorder = useRef<MediaRecorder | null>(null);
  const sysRecorder = useRef<MediaRecorder | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const animationFrame = useRef<number>();
  const durationTimer = useRef<ReturnType<typeof setInterval>>();
  const micStream = useRef<MediaStream | null>(null);
  const sysStream = useRef<MediaStream | null>(null);

  const updateAudioLevel = useCallback(() => {
    if (!analyser.current) return;
    const data = new Uint8Array(analyser.current.frequencyBinCount);
    analyser.current.getByteFrequencyData(data);
    const avg = data.reduce((a, b) => a + b, 0) / data.length;
    setAudioLevel(Math.round((avg / 255) * 100));
    animationFrame.current = requestAnimationFrame(updateAudioLevel);
  }, []);

  const getMimeType = () =>
    MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

  const createRecorder = (stream: MediaStream, source: AudioSource) => {
    const recorder = new MediaRecorder(stream, { mimeType: getMimeType() });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        onAudioDataRef.current(e.data, source);
      }
    };
    return recorder;
  };

  const startRecording = useCallback(async () => {
    try {
      setError(null);

      // 1. Capture microphone (candidate voice)
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStream.current = mic;

      // Audio level analysis on mic
      audioContext.current = new AudioContext();
      const source = audioContext.current.createMediaStreamSource(mic);
      analyser.current = audioContext.current.createAnalyser();
      analyser.current.fftSize = 256;
      source.connect(analyser.current);
      updateAudioLevel();

      // Start mic recorder
      micRecorder.current = createRecorder(mic, 'mic');
      micRecorder.current.start(timeslice);

      // 2. Try to capture system audio (interviewer voice)
      try {
        const display = await navigator.mediaDevices.getDisplayMedia({
          audio: true,
          video: { width: 1, height: 1 }, // minimal video (required by API)
        });

        // Extract audio track only, stop video track
        const videoTracks = display.getVideoTracks();
        videoTracks.forEach((t) => t.stop());

        const audioTracks = display.getAudioTracks();
        if (audioTracks.length > 0) {
          const audioOnly = new MediaStream(audioTracks);
          sysStream.current = audioOnly;
          sysRecorder.current = createRecorder(audioOnly, 'system');
          sysRecorder.current.start(timeslice);
          setSystemAudioActive(true);
          console.log('[Audio] System audio capture started');

          // Stop recording when the user stops sharing
          audioTracks[0].onended = () => {
            console.log('[Audio] System audio sharing stopped by user');
            sysRecorder.current?.stop();
            setSystemAudioActive(false);
          };
        } else {
          console.log('[Audio] No system audio track available');
        }
      } catch (sysErr) {
        // System audio capture is optional — user may deny or browser may not support
        console.log('[Audio] System audio not available:', sysErr);
      }

      setIsRecording(true);
      setDuration(0);
      durationTimer.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '无法访问麦克风';
      setError(msg);
    }
  }, [timeslice, updateAudioLevel]);

  const stopRecording = useCallback(() => {
    micRecorder.current?.stop();
    sysRecorder.current?.stop();
    micStream.current?.getTracks().forEach((t) => t.stop());
    sysStream.current?.getTracks().forEach((t) => t.stop());
    if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
    audioContext.current?.close();
    if (durationTimer.current) clearInterval(durationTimer.current);

    micRecorder.current = null;
    sysRecorder.current = null;
    micStream.current = null;
    sysStream.current = null;
    audioContext.current = null;
    analyser.current = null;

    setIsRecording(false);
    setAudioLevel(0);
    setSystemAudioActive(false);
  }, []);

  const pauseRecording = useCallback(() => {
    if (micRecorder.current?.state === 'recording') micRecorder.current.pause();
    if (sysRecorder.current?.state === 'recording') sysRecorder.current.pause();
  }, []);

  const resumeRecording = useCallback(() => {
    if (micRecorder.current?.state === 'paused') micRecorder.current.resume();
    if (sysRecorder.current?.state === 'paused') sysRecorder.current.resume();
  }, []);

  return {
    isRecording,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    audioLevel,
    duration,
    error,
    systemAudioActive,
  };
}
