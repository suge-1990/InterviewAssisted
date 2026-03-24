'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2, Tag, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { getApiUrl } from '@/lib/utils';

interface KnowledgeEntry {
  id: string;
  question_pattern: string;
  answer: string;
  tags: string[];
  priority: number;
}

interface FormData {
  question_pattern: string;
  answer: string;
  tags: string;
  priority: number;
}

const emptyForm: FormData = {
  question_pattern: '',
  answer: '',
  tags: '',
  priority: 0,
};

export default function KnowledgePage() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [loading, setLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${getApiUrl()}/knowledge`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data);
      }
    } catch (err) {
      console.error('Failed to fetch knowledge entries:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleSave = async () => {
    const body = {
      question_pattern: form.question_pattern,
      answer: form.answer,
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      priority: form.priority,
    };

    try {
      if (editingId) {
        const res = await fetch(`${getApiUrl()}/knowledge/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const updated = await res.json();
          setEntries((prev) =>
            prev.map((e) => (e.id === editingId ? updated : e))
          );
        }
      } else {
        const res = await fetch(`${getApiUrl()}/knowledge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const created = await res.json();
          setEntries((prev) => [created, ...prev]);
        }
      }
    } catch (err) {
      console.error('Failed to save entry:', err);
    }

    handleCancel();
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`${getApiUrl()}/knowledge/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setEntries((prev) => prev.filter((e) => e.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete entry:', err);
    }
  };

  const handleEdit = (entry: KnowledgeEntry) => {
    setEditingId(entry.id);
    setForm({
      question_pattern: entry.question_pattern,
      answer: entry.answer,
      tags: entry.tags.join(', '),
      priority: entry.priority,
    });
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const filteredEntries = entries.filter((entry) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      entry.question_pattern.toLowerCase().includes(q) ||
      entry.answer.toLowerCase().includes(q) ||
      entry.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-screen bg-[#0F0F14] text-[#F0F0F5]">
      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#F0F0F5]">
              知识库管理
            </h1>
            <p className="text-sm text-[#9A9AB0] mt-1">
              管理面试问答知识条目，提升 AI 回答质量
            </p>
          </div>
          <Button
            onClick={handleAdd}
            className="bg-indigo-500 hover:bg-indigo-600 text-white gap-2 shadow-lg shadow-indigo-500/20"
          >
            <Plus className="w-4 h-4" />
            新增条目
          </Button>
        </div>

        {/* Search bar */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A5A72]" />
          <Input
            placeholder="搜索问题、答案或标签..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-[#1A1A24] border-white/[0.06] text-[#F0F0F5] placeholder:text-[#5A5A72] focus-visible:ring-indigo-500/40 h-11"
          />
        </div>

        {/* Inline add/edit form */}
        {showForm && (
          <Card className="mb-6 bg-[#1A1A24] border-white/[0.06]">
            <CardHeader className="pb-4">
              <h3 className="text-base font-semibold text-[#F0F0F5]">
                {editingId ? '编辑条目' : '新增条目'}
              </h3>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-medium text-[#9A9AB0] mb-1.5 block">
                  问题模式
                </label>
                <Input
                  placeholder="例如：请介绍一下你自己"
                  value={form.question_pattern}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, question_pattern: e.target.value }))
                  }
                  className="bg-[#0F0F14] border-white/[0.06] text-[#F0F0F5] placeholder:text-[#5A5A72] focus-visible:ring-indigo-500/40"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#9A9AB0] mb-1.5 block">
                  参考答案
                </label>
                <Textarea
                  placeholder="输入参考答案内容..."
                  rows={5}
                  value={form.answer}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, answer: e.target.value }))
                  }
                  className="bg-[#0F0F14] border-white/[0.06] text-[#F0F0F5] placeholder:text-[#5A5A72] focus-visible:ring-indigo-500/40 resize-none"
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs font-medium text-[#9A9AB0] mb-1.5 block">
                    标签（逗号分隔）
                  </label>
                  <Input
                    placeholder="例如：自我介绍, 通用, 开场"
                    value={form.tags}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, tags: e.target.value }))
                    }
                    className="bg-[#0F0F14] border-white/[0.06] text-[#F0F0F5] placeholder:text-[#5A5A72] focus-visible:ring-indigo-500/40"
                  />
                </div>
                <div className="w-28">
                  <label className="text-xs font-medium text-[#9A9AB0] mb-1.5 block">
                    优先级
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={form.priority}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        priority: parseInt(e.target.value, 10) || 0,
                      }))
                    }
                    className="bg-[#0F0F14] border-white/[0.06] text-[#F0F0F5] focus-visible:ring-indigo-500/40"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="ghost"
                  onClick={handleCancel}
                  className="text-[#9A9AB0] hover:text-[#F0F0F5]"
                >
                  取消
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={!form.question_pattern.trim() || !form.answer.trim()}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                >
                  保存
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Content area */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : filteredEntries.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#1A1A24] border border-white/[0.06] flex items-center justify-center mb-5">
              <Brain className="w-8 h-8 text-[#5A5A72]" />
            </div>
            <h3 className="text-lg font-semibold text-[#9A9AB0] mb-2">
              {searchQuery ? '未找到匹配的条目' : '知识库为空'}
            </h3>
            <p className="text-sm text-[#5A5A72] max-w-xs">
              {searchQuery
                ? '请尝试其他搜索关键词'
                : '点击「新增条目」添加你的第一条知识，帮助 AI 更好地回答面试问题'}
            </p>
          </div>
        ) : (
          /* Card grid */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredEntries.map((entry) => (
              <Card
                key={entry.id}
                className="bg-[#1A1A24] border-white/[0.06] hover:border-indigo-500/20 transition-colors group"
              >
                <CardHeader className="pb-2 relative">
                  {/* Priority badge */}
                  <div className="absolute top-4 right-14 flex items-center">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-indigo-500/10 text-indigo-400 text-xs font-bold">
                      {entry.priority}
                    </span>
                  </div>

                  {/* Action buttons */}
                  <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEdit(entry)}
                      className="p-1.5 rounded-md hover:bg-white/[0.06] text-[#5A5A72] hover:text-indigo-400 transition-colors"
                      title="编辑"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="p-1.5 rounded-md hover:bg-white/[0.06] text-[#5A5A72] hover:text-red-400 transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <h4 className="text-sm font-medium text-indigo-400 pr-20 leading-snug">
                    {entry.question_pattern}
                  </h4>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <p className="text-sm text-[#F0F0F5]/80 line-clamp-3 leading-relaxed">
                    {entry.answer}
                  </p>
                  {entry.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {entry.tags.map((tag) => (
                        <Badge
                          key={tag}
                          className="bg-indigo-500/10 text-indigo-400 border-0 text-[11px] font-normal px-2 py-0.5"
                        >
                          <Tag className="w-2.5 h-2.5 mr-1" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
