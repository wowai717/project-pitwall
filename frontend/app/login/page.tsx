"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const contentType = res.headers.get('content-type') || '';
      const data = contentType.includes('application/json')
        ? await res.json()
        : { message: await res.text() };

      if (!res.ok) throw new Error(data.message || '로그인 실패');

      // 🚨 핵심: 발급받은 출입증(토큰)을 브라우저 금고(localStorage)에 보관합니다!
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('username', data.username);

      // 로그인 성공 시 커뮤니티(또는 대시보드)로 강제 이동
      router.push('/community');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-[#050505] p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(#222_1px,transparent_1px)] [background-size:24px_24px] opacity-20"></div>
      
      <div className="w-full max-w-md bg-[#0a0a0a] border border-[#222] rounded-xl p-8 relative z-10 shadow-2xl">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-full border border-red-600/30 flex items-center justify-center bg-red-600/10">
              <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>
            </div>
          </div>
          <h1 className="text-3xl font-black italic text-white uppercase tracking-tighter">SECURE LOGIN</h1>
          <p className="text-neutral-500 font-mono text-[10px] tracking-[0.2em] mt-2">IDENTIFICATION REQUIRED</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-900/20 border border-red-900/50 rounded flex items-center gap-2 text-red-500 font-mono text-xs">
            <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-neutral-500 tracking-widest">CALLSIGN</label>
            <input 
              type="text" required
              value={username} onChange={(e) => setUsername(e.target.value)}
              className="bg-[#111] border border-[#333] text-white p-3 rounded font-mono text-sm focus:outline-none focus:border-red-600 focus:bg-red-600/5 transition-colors"
              placeholder="Username"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-neutral-500 tracking-widest">ENCRYPTION KEY</label>
            <input 
              type="password" required
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="bg-[#111] border border-[#333] text-white p-3 rounded font-mono text-sm focus:outline-none focus:border-red-600 focus:bg-red-600/5 transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" disabled={loading}
            className="mt-4 w-full bg-red-600 text-white font-black italic tracking-widest py-3 rounded hover:bg-red-700 transition-all disabled:opacity-50 flex justify-center items-center gap-2"
          >
            {loading ? 'AUTHENTICATING...' : 'INITIATE CONNECTION'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs font-mono text-neutral-500">
          NO ACCESS CREDENTIALS? <Link href="/register" className="text-white hover:text-red-500 underline decoration-[#333] underline-offset-4">REGISTER</Link>
        </p>
      </div>
    </div>
  );
}