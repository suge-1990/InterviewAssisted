'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload, FileText, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useInterviewStore } from '@/stores/interviewStore';

import { getApiUrl } from '@/lib/utils';

interface ResumeUploadProps {
  onResumeUploaded?: (text: string) => void;
}

export function ResumeUpload({ onResumeUploaded }: ResumeUploadProps) {
  const { resumeFileName, setResume, clearResume } = useInterviewStore();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['pdf', 'docx', 'txt'].includes(ext)) {
      setError('仅支持 PDF、DOCX、TXT 格式');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('文件过大（最大 10MB）');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${getApiUrl()}/resume/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Upload failed');
      }

      const data = await res.json();
      setResume(data.full_text, data.file_name);
      setPreview(data.text_preview);
      onResumeUploaded?.(data.full_text);
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setUploading(false);
    }
  }, [setResume, onResumeUploaded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }, [handleUpload]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  }, [handleUpload]);

  if (resumeFileName) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <FileText className="w-4 h-4 text-indigo-400" />
          <span className="truncate flex-1">{resumeFileName}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { clearResume(); setPreview(null); }}>
            <X className="w-3 h-3" />
          </Button>
        </div>
        {preview && (
          <p className="text-xs text-muted-foreground line-clamp-4 bg-background/30 p-2 rounded">
            {preview}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
        className="border border-dashed border-border/50 rounded-lg p-4 text-center cursor-pointer hover:border-indigo-500/50 hover:bg-indigo-500/[0.04] transition-colors"
      >
        {uploading ? (
          <Loader2 className="w-5 h-5 mx-auto animate-spin text-muted-foreground" />
        ) : (
          <>
            <Upload className="w-5 h-5 mx-auto text-muted-foreground mb-1.5" />
            <p className="text-xs text-muted-foreground">
              拖拽简历到此处或点击上传
            </p>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">支持 PDF、DOCX、TXT（最大 10MB）</p>
          </>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.txt"
        className="hidden"
        onChange={handleFileChange}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
