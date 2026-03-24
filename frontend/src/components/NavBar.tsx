'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, Mic, BookOpen, Brain, Clock, PenTool } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: '面试辅助', icon: Mic },
  { href: '/knowledge', label: '知识库', icon: Brain },
  { href: '/practice', label: '题库练习', icon: BookOpen },
  { href: '/history', label: '面试记录', icon: Clock },
  { href: '/exam', label: '笔试辅助', icon: PenTool },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop: top nav */}
      <nav className="hidden md:flex items-center gap-1 px-4 py-1.5 border-b border-white/[0.06] bg-[#0F0F14]">
        <Link href="/" className="flex items-center gap-2 mr-6 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-bold text-white">面试助手</span>
        </Link>
        <div className="flex items-center gap-0.5 overflow-x-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap',
                  isActive
                    ? 'bg-indigo-500/15 text-indigo-400'
                    : 'text-[#9A9AB0] hover:text-white hover:bg-white/[0.04]',
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Mobile: bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.06] bg-[#0F0F14]/95 backdrop-blur-lg safe-area-bottom">
        <div className="flex items-center justify-around px-1 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg min-w-[3rem] transition-colors',
                  isActive
                    ? 'text-indigo-400'
                    : 'text-[#5A5A72] active:text-white',
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
