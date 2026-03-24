'use client';

import { NavBar } from '@/components/NavBar';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <div className="h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent shrink-0" />
      <NavBar />
      <div className="flex-1 overflow-hidden pb-[4.5rem] md:pb-0">
        {children}
      </div>
      {/* Ambient glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-500/[0.03] rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-[500px] h-[500px] bg-purple-600/[0.02] rounded-full blur-[120px] pointer-events-none" />
    </div>
  );
}
