"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const form = new FormData(e.currentTarget as HTMLFormElement);
    const submittedPassword = String(form.get('password') ?? '');

    if (submittedPassword !== form.get('confirmPassword')) {
      return setError('비밀번호가 일치하지 않습니다.');
    }
    if (new TextEncoder().encode(submittedPassword).length > 72) {
      return setError('비밀번호는 UTF-8 기준 72바이트 이하로 입력해주세요.');
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: form.get('username'), password: submittedPassword }),
      });

      const contentType = res.headers.get('content-type') || '';
      const data = contentType.includes('application/json')
        ? await res.json()
        : { message: await res.text() };

      if (!res.ok) throw new Error(data.message || '회원가입 실패');

      alert('접근 권한이 생성되었습니다. 로그인해 주세요.');
      router.push('/login');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '회원가입에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-[#050505] p-4 relative overflow-hidden">
      {/* 배경 장식 */}
      <div className="absolute inset-0 bg-[radial-gradient(#222_1px,transparent_1px)] [background-size:24px_24px] opacity-20"></div>
      
      <div className="w-full max-w-md bg-[#0a0a0a] border border-[#222] rounded-xl p-8 relative z-10 shadow-2xl">
        <div className="text-center mb-8">
          <span className="inline-block w-8 h-1 bg-red-600 mb-4"></span>
          <h1 className="text-3xl font-black italic text-white uppercase tracking-tighter">NEW PERSONNEL</h1>
          <p className="text-neutral-500 font-mono text-[10px] tracking-[0.2em] mt-2">SYSTEM REGISTRATION // SECURE LINK</p>
        </div>

        {error && (
          <div role="alert" className="mb-6 p-3 bg-red-900/20 border border-red-900/50 rounded flex items-center gap-2 text-red-300 font-mono text-xs">
            <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse"></span>
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <label htmlFor="username" className="text-sm text-neutral-300">아이디</label>
            <input 
              id="username" name="username" autoComplete="username" type="text" required minLength={3} maxLength={32} pattern="[a-zA-Z0-9_]{3,32}" aria-describedby="username-rules"
              value={username} onChange={(e) => setUsername(e.target.value)}
              className="bg-[#111] border border-[#333] text-white p-3 rounded font-mono text-sm focus:outline-none focus:border-red-600 focus:bg-red-600/5 transition-colors"
              placeholder="Enter your callsign..."
            />
            <p id="username-rules" className="text-xs text-neutral-400">영문, 숫자, 밑줄 3~32자</p>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm text-neutral-300">비밀번호</label>
            <input 
              id="password" name="password" autoComplete="new-password" type="password" required minLength={12} maxLength={72} aria-describedby="password-rules"
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="bg-[#111] border border-[#333] text-white p-3 rounded font-mono text-sm focus:outline-none focus:border-red-600 focus:bg-red-600/5 transition-colors"
              placeholder="••••••••"
            />
            <p id="password-rules" className="text-xs text-neutral-400">12자 이상, 최대 72바이트 (한글은 보통 글자당 3바이트)</p>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="confirmPassword" className="text-sm text-neutral-300">비밀번호 확인</label>
            <input 
              id="confirmPassword" name="confirmPassword" autoComplete="new-password" type="password" required
              value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              className="bg-[#111] border border-[#333] text-white p-3 rounded font-mono text-sm focus:outline-none focus:border-red-600 focus:bg-red-600/5 transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" disabled={loading}
            className="mt-4 w-full bg-white text-black font-black italic tracking-widest py-3 rounded hover:bg-red-600 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '가입 중...' : '회원가입'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs font-mono text-neutral-500">
          ALREADY AUTHORIZED? <Link href="/login" className="text-white hover:text-red-500 underline decoration-[#333] underline-offset-4">LOGIN HERE</Link>
        </p>
      </div>
    </div>
  );
}
