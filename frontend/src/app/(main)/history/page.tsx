'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Clock, Building2, Briefcase, FileText, Loader2, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { getBaseUrl } from '@/lib/utils';

interface InterviewRecord {
  id: string;
  session_id: string;
  company: string | null;
  position: string | null;
  start_time: string;
  duration_minutes: number;
  questions: string;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function getQuestionCount(questionsJson: string): number {
  try {
    const arr = JSON.parse(questionsJson);
    return Array.isArray(arr) ? arr.length : 0;
  } catch {
    return 0;
  }
}

export default function HistoryPage() {
  const [records, setRecords] = useState<InterviewRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRecords() {
      try {
        const res = await fetch(`${getBaseUrl()}/api/interviews`);
        if (!res.ok) throw new Error('请求失败');
        const data: InterviewRecord[] = await res.json();
        setRecords(data);
      } catch {
        setRecords([]);
      } finally {
        setLoading(false);
      }
    }
    fetchRecords();
  }, []);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#F0F0F5] mb-1">面试记录</h1>
          <p className="text-sm text-[#9A9AB0]">查看历次面试记录和分析报告</p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-[#9A9AB0]">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
            <span className="text-sm">正在加载面试记录...</span>
          </div>
        )}

        {/* Empty */}
        {!loading && records.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-[#9A9AB0]">
            <Clock className="w-12 h-12 mb-3 text-[#5A5A72]" />
            <p className="text-base mb-1">暂无面试记录</p>
            <p className="text-sm text-[#5A5A72]">完成一次面试后，记录将显示在这里</p>
          </div>
        )}

        {/* Records */}
        {!loading && records.length > 0 && (
          <div className="space-y-3">
            {records.map((record) => {
              const questionCount = getQuestionCount(record.questions);
              return (
                <Card
                  key={record.id}
                  className="bg-[#1A1A24] border-white/[0.06] hover:border-white/[0.12] transition-colors"
                >
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Company + Position */}
                        <div className="flex items-center gap-3 mb-3">
                          <div className="flex items-center gap-1.5 text-[#F0F0F5]">
                            <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
                            <span className="font-medium">
                              {record.company || '未填写'}
                            </span>
                          </div>
                          <span className="text-[#5A5A72]">/</span>
                          <div className="flex items-center gap-1.5 text-[#F0F0F5]">
                            <Briefcase className="w-4 h-4 text-purple-400 shrink-0" />
                            <span className="font-medium">
                              {record.position || '未填写'}
                            </span>
                          </div>
                        </div>

                        {/* Meta info */}
                        <div className="flex items-center gap-4 text-sm text-[#9A9AB0]">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{formatDate(record.start_time)}</span>
                          </div>
                          <span className="text-[#5A5A72]">|</span>
                          <span>{record.duration_minutes} 分钟</span>
                          <span className="text-[#5A5A72]">|</span>
                          <div className="flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5" />
                            <span>{questionCount} 道题目</span>
                          </div>
                        </div>
                      </div>

                      {/* Report link */}
                      <Link href={`/history/${record.id}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 gap-1.5"
                        >
                          查看报告
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
