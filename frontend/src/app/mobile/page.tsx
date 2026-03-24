'use client';

import { Suspense, useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sparkles, Wifi, ArrowRight } from 'lucide-react';

export default function MobilePageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0F0F14] flex items-center justify-center"><Sparkles className="w-8 h-8 text-indigo-500 animate-pulse" /></div>}>
      <MobileConnectPage />
    </Suspense>
  );
}

function MobileConnectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionFromUrl = searchParams.get('session') || '';

  const [connectCode, setConnectCode] = useState(sessionFromUrl);
  const [error, setError] = useState('');

  // Auto-redirect if session is in URL
  useEffect(() => {
    if (sessionFromUrl) {
      router.replace(`/mobile/interview?session=${sessionFromUrl}`);
    }
  }, [sessionFromUrl, router]);

  const handleConnect = useCallback(() => {
    const code = connectCode.trim();
    if (!code) {
      setError('请输入连接码');
      return;
    }
    if (code.length < 6) {
      setError('连接码格式不正确');
      return;
    }
    router.push(`/mobile/interview?session=${code}`);
  }, [connectCode, router]);

  if (sessionFromUrl) {
    return (
      <div className="min-h-screen bg-[#0F0F14] flex items-center justify-center">
        <Sparkles className="w-8 h-8 text-indigo-500 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F0F14] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white mb-1">面试助手 - 移动端</h1>
          <p className="text-sm text-[#9A9AB0]">输入连接码或扫描 PC 端二维码</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs text-[#5A5A72] uppercase tracking-wider font-semibold">连接码</label>
            <input
              type="text"
              value={connectCode}
              onChange={(e) => { setConnectCode(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
              placeholder="输入 PC 端显示的连接码"
              className="w-full px-4 py-3 rounded-xl bg-[#1A1A24] border border-white/[0.06] text-white text-center text-2xl font-mono tracking-[0.3em] placeholder:text-[#5A5A72] placeholder:text-sm placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              maxLength={12}
              autoFocus
            />
            {error && <p className="text-xs text-red-400 text-center">{error}</p>}
          </div>

          <button
            onClick={handleConnect}
            className="w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <Wifi className="w-4 h-4" /> 连接
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="text-center">
          <p className="text-[10px] text-[#5A5A72]">确保手机与电脑在同一 WiFi 网络</p>
        </div>
      </div>
    </div>
  );
}
