'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Clock,
  MessageSquare,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Loader2,
  FileWarning,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, getBaseUrl } from '@/lib/utils';

interface QuestionAnalysis {
  question: string;
  category?: string;
  score?: number;
  notes?: string;
}

interface ReportData {
  summary: string;
  duration: number;
  total_questions: number;
  question_categories: Record<string, number>;
  strengths: string[];
  improvements: string[];
  question_analysis: QuestionAnalysis[];
  recommended_practice: string[];
}

export default function ReportPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchReport() {
      try {
        const res = await fetch(`${getBaseUrl()}/api/interviews/${params.id}/report`);
        if (!res.ok) throw new Error('请求失败');
        const data: ReportData = await res.json();
        setReport(data);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchReport();
  }, [params.id]);

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-[#9A9AB0]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
        <span className="text-sm">正在加载面试报告...</span>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-[#9A9AB0]">
        <FileWarning className="w-12 h-12 mb-3 text-[#5A5A72]" />
        <p className="text-base mb-1">无法加载报告</p>
        <p className="text-sm text-[#5A5A72] mb-4">请检查网络连接后重试</p>
        <Button
          variant="ghost"
          size="sm"
          className="text-indigo-400 hover:bg-indigo-500/10"
          onClick={() => router.push('/history')}
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          返回记录列表
        </Button>
      </div>
    );
  }

  const totalCategoryCount = Object.values(report.question_categories).reduce(
    (sum, v) => sum + v,
    0
  );

  const categoryColors = [
    'bg-indigo-500',
    'bg-purple-500',
    'bg-emerald-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-cyan-500',
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Back button + header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            size="sm"
            className="text-[#9A9AB0] hover:text-[#F0F0F5] hover:bg-white/[0.04] mb-4 -ml-2"
            onClick={() => router.push('/history')}
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            返回记录列表
          </Button>
          <h1 className="text-2xl font-bold text-[#F0F0F5] mb-2">面试分析报告</h1>
          {report.summary && (
            <p className="text-sm text-[#9A9AB0] leading-relaxed">{report.summary}</p>
          )}
        </div>

        {/* Top summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Duration */}
          <Card className="bg-[#1A1A24] border-white/[0.06]">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <p className="text-xs text-[#9A9AB0]">面试时长</p>
                  <p className="text-xl font-bold text-[#F0F0F5]">
                    {report.duration}{' '}
                    <span className="text-sm font-normal text-[#9A9AB0]">分钟</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Question count */}
          <Card className="bg-[#1A1A24] border-white/[0.06]">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-xs text-[#9A9AB0]">问题数量</p>
                  <p className="text-xl font-bold text-[#F0F0F5]">
                    {report.total_questions}{' '}
                    <span className="text-sm font-normal text-[#9A9AB0]">道</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Category distribution */}
          <Card className="bg-[#1A1A24] border-white/[0.06]">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-[#9A9AB0]">题型分布</p>
                </div>
              </div>
              {totalCategoryCount > 0 && (
                <div className="space-y-2">
                  {Object.entries(report.question_categories).map(
                    ([cat, count], idx) => {
                      const pct = Math.round((count / totalCategoryCount) * 100);
                      return (
                        <div key={cat}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-[#9A9AB0]">{cat}</span>
                            <span className="text-[#5A5A72]">{count} ({pct}%)</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all',
                                categoryColors[idx % categoryColors.length]
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Strengths + Improvements */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Strengths */}
          <Card className="bg-[#1A1A24] border-white/[0.06]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base text-[#F0F0F5]">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                表现优势
              </CardTitle>
            </CardHeader>
            <CardContent>
              {report.strengths?.length > 0 ? (
                <ul className="space-y-2.5">
                  {report.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                      <span className="text-[#F0F0F5]/80 leading-relaxed">{s}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[#5A5A72]">暂无数据</p>
              )}
            </CardContent>
          </Card>

          {/* Improvements */}
          <Card className="bg-[#1A1A24] border-white/[0.06]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base text-[#F0F0F5]">
                <AlertCircle className="w-5 h-5 text-amber-400" />
                改进建议
              </CardTitle>
            </CardHeader>
            <CardContent>
              {report.improvements?.length > 0 ? (
                <ul className="space-y-2.5">
                  {report.improvements.map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                      <span className="text-[#F0F0F5]/80 leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[#5A5A72]">暂无数据</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Question Analysis */}
        {report.question_analysis?.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-[#F0F0F5] mb-4">题目分析</h2>
            <div className="space-y-3">
              {report.question_analysis.map((qa, i) => (
                <Card
                  key={i}
                  className="bg-[#1A1A24] border-white/[0.06]"
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <p className="font-medium text-[#F0F0F5] text-sm leading-relaxed">
                        {qa.question}
                      </p>
                      {qa.score != null && (
                        <span
                          className={cn(
                            'text-xs font-semibold px-2 py-0.5 rounded-full shrink-0',
                            qa.score >= 80
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : qa.score >= 60
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-red-500/20 text-red-400'
                          )}
                        >
                          {qa.score} 分
                        </span>
                      )}
                    </div>
                    {qa.category && (
                      <Badge className="bg-indigo-500/20 text-indigo-400 border-indigo-500/30 text-[11px] mb-2">
                        {qa.category}
                      </Badge>
                    )}
                    {qa.notes && (
                      <p className="text-sm text-[#9A9AB0] leading-relaxed mt-2">
                        {qa.notes}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Recommended Practice */}
        {report.recommended_practice?.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-[#F0F0F5] mb-4">推荐练习方向</h2>
            <div className="flex flex-wrap gap-2">
              {report.recommended_practice.map((item, i) => (
                <span
                  key={i}
                  className="px-3 py-1.5 text-sm rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
