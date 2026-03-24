'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, ChevronDown, ChevronUp, Loader2, BookOpen } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn, getBaseUrl } from '@/lib/utils';

interface Question {
  id: string;
  question: string;
  category: string;
  position: string;
  difficulty: string;
  tags: string[];
  reference_answer: string;
  follow_up_questions: string[];
}

const CATEGORY_OPTIONS = ['全部', '技术', '行为', '情景', '系统设计', '算法'];
const POSITION_OPTIONS = ['全部', '前端', '后端', '产品经理'];
const DIFFICULTY_OPTIONS = ['全部', '初级', '中级', '高级'];

const difficultyColor: Record<string, string> = {
  '初级': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  '中级': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  '高级': 'bg-red-500/20 text-red-400 border-red-500/30',
};

function FilterGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-[#9A9AB0] whitespace-nowrap">{label}</span>
      <div className="flex gap-1">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt === '全部' ? '' : opt)}
            className={cn(
              'px-3 py-1.5 text-xs rounded-md transition-colors border',
              (opt === '全部' && value === '') || value === opt
                ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40'
                : 'bg-[#1A1A24] text-[#9A9AB0] border-white/[0.06] hover:border-white/[0.12] hover:text-[#F0F0F5]'
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function PracticePage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [category, setCategory] = useState('');
  const [position, setPosition] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('q', searchQuery);
      if (category) params.set('category', category);
      if (position) params.set('position', position);
      const url = `${getBaseUrl()}/api/questions/search?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('请求失败');
      const data: Question[] = await res.json();
      // Client-side difficulty filter
      const filtered = difficulty
        ? data.filter((q) => q.difficulty === difficulty)
        : data;
      setQuestions(filtered);
    } catch {
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, category, position, difficulty]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#F0F0F5] mb-1">题库练习</h1>
          <p className="text-sm text-[#9A9AB0]">浏览和练习面试题目，提升面试表现</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-6 p-4 rounded-xl bg-[#1A1A24] border border-white/[0.06]">
          <FilterGroup
            label="题目类型:"
            options={CATEGORY_OPTIONS}
            value={category}
            onChange={setCategory}
          />
          <FilterGroup
            label="岗位:"
            options={POSITION_OPTIONS}
            value={position}
            onChange={setPosition}
          />
          <FilterGroup
            label="难度:"
            options={DIFFICULTY_OPTIONS}
            value={difficulty}
            onChange={setDifficulty}
          />
          <div className="ml-auto relative min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A5A72]" />
            <Input
              placeholder="搜索题目..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-[#0F0F14] border-white/[0.06] text-[#F0F0F5] placeholder:text-[#5A5A72] focus-visible:ring-indigo-500/40"
            />
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-[#9A9AB0]">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
            <span className="text-sm">正在加载题目...</span>
          </div>
        )}

        {/* Empty */}
        {!loading && questions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-[#9A9AB0]">
            <BookOpen className="w-12 h-12 mb-3 text-[#5A5A72]" />
            <p className="text-base mb-1">暂无匹配的题目</p>
            <p className="text-sm text-[#5A5A72]">尝试调整筛选条件或搜索关键词</p>
          </div>
        )}

        {/* Questions */}
        {!loading && questions.length > 0 && (
          <div className="space-y-3">
            {questions.map((q) => {
              const isExpanded = expandedId === q.id;
              return (
                <Card
                  key={q.id}
                  className="bg-[#1A1A24] border-white/[0.06] hover:border-white/[0.12] transition-colors cursor-pointer"
                  onClick={() => toggleExpand(q.id)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[#F0F0F5] mb-3 leading-relaxed">
                          {q.question}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="bg-indigo-500/20 text-indigo-400 border-indigo-500/30 text-[11px]">
                            {q.category}
                          </Badge>
                          {q.difficulty && (
                            <Badge
                              className={cn(
                                'text-[11px]',
                                difficultyColor[q.difficulty] ||
                                  'bg-[#5A5A72]/20 text-[#9A9AB0] border-[#5A5A72]/30'
                              )}
                            >
                              {q.difficulty}
                            </Badge>
                          )}
                          {q.position && (
                            <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[11px]">
                              {q.position}
                            </Badge>
                          )}
                          {q.tags?.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 text-[11px] rounded-full bg-white/[0.04] text-[#9A9AB0] border border-white/[0.06]"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-[#5A5A72] shrink-0 mt-1">
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5" />
                        ) : (
                          <ChevronDown className="w-5 h-5" />
                        )}
                      </div>
                    </div>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="mt-5 pt-5 border-t border-white/[0.06] space-y-4">
                        {q.reference_answer && (
                          <div>
                            <h4 className="text-xs font-semibold text-[#9A9AB0] uppercase tracking-wider mb-2">
                              参考答案
                            </h4>
                            <p className="text-sm text-[#F0F0F5]/80 leading-relaxed whitespace-pre-wrap">
                              {q.reference_answer}
                            </p>
                          </div>
                        )}
                        {q.follow_up_questions?.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-[#9A9AB0] uppercase tracking-wider mb-2">
                              追问题目
                            </h4>
                            <ul className="space-y-1.5">
                              {q.follow_up_questions.map((fq, i) => (
                                <li
                                  key={i}
                                  className="text-sm text-[#9A9AB0] flex items-start gap-2"
                                >
                                  <span className="text-indigo-400 mt-0.5 shrink-0">
                                    {i + 1}.
                                  </span>
                                  {fq}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
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
