"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { clearSession, readSession } from '../lib/auth';

interface Entry { id: string; title?: string; content: string; createdAt: string; author: { username: string } | null }
interface Page { items: Entry[]; total: number; page: number }
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const inputStyle = 'w-full rounded border border-neutral-700 bg-neutral-900 p-3 text-sm';
const buttonStyle = 'min-h-11 rounded bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-40';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API}/community${path}`, options);
  if (response.status === 401) {
    clearSession();
    throw new Error('로그인이 만료되었습니다. 다시 로그인해주세요.');
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(data?.message || '요청에 실패했습니다. 잠시 후 다시 시도해주세요.');
  }
  return response.json() as Promise<T>;
}

function postOptions(body: object): RequestInit {
  const session = readSession();
  if (!session) throw new Error('로그인 후 작성해주세요.');
  return { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` }, body: JSON.stringify(body) };
}

function Comments({ postId }: { postId: string }) {
  const [data, setData] = useState<Page>({ items: [], total: 0, page: 1 });
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    request<Page>(`/posts/${postId}/comments?page=${page}`, { signal: controller.signal })
      .then(setData).catch((e: Error) => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [postId, page, revision]);

  return <section className="mt-6 border-t border-neutral-800 pt-4" aria-label="댓글">
    <h3 className="font-semibold">댓글 {data.total}</h3>
    {error && <p role="alert" className="mt-3 text-sm text-red-300">{error} <button onClick={() => { setError(''); setLoading(true); setRevision(revision + 1); }} className="underline">다시 시도</button></p>}
    {loading ? <p role="status" className="py-4 text-neutral-400">댓글 불러오는 중...</p> : <ul className="divide-y divide-neutral-800">
      {data.items.map(comment => <li key={comment.id} className="py-4"><p className="text-xs text-neutral-400">{comment.author?.username ?? '탈퇴한 사용자'}</p><p className="mt-2 whitespace-pre-wrap text-sm">{comment.content}</p></li>)}
      {!error && data.total === 0 && <li className="py-4 text-sm text-neutral-400">아직 댓글이 없습니다.</li>}
    </ul>}
    {data.total > 20 && <div className="my-3 flex items-center gap-4"><button disabled={loading || page === 1} onClick={() => { setLoading(true); setPage(page - 1); }} className={buttonStyle}>이전 댓글</button><span>{page}</span><button disabled={loading || page * 20 >= data.total} onClick={() => { setLoading(true); setPage(page + 1); }} className={buttonStyle}>다음 댓글</button></div>}
    <form className="mt-4 flex flex-col items-start gap-3" onSubmit={async event => {
      event.preventDefault(); const form = event.currentTarget; setError(''); setSaving(true);
      try {
        await request(`/posts/${postId}/comments`, postOptions({ content: new FormData(form).get('content') }));
        form.reset(); setLoading(true); setPage(Math.ceil((data.total + 1) / 20)); setRevision(revision + 1);
      } catch (e) { setError(e instanceof Error ? e.message : '댓글 작성에 실패했습니다.'); }
      finally { setSaving(false); }
    }}>
      <label htmlFor={`comment-${postId}`} className="text-sm">댓글 작성</label>
      <textarea id={`comment-${postId}`} name="content" required maxLength={2000} rows={3} className={inputStyle} />
      <button disabled={saving} className={buttonStyle}>{saving ? '등록 중...' : '댓글 등록'}</button>
    </form>
  </section>;
}

export default function CommunityPage() {
  const [data, setData] = useState<Page>({ items: [], total: 0, page: 1 });
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [session, setSession] = useState<ReturnType<typeof readSession>>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const update = () => setSession(readSession());
    update(); window.addEventListener('auth-change', update); window.addEventListener('storage', update);
    return () => { window.removeEventListener('auth-change', update); window.removeEventListener('storage', update); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    request<Page>(`/posts?page=${page}`, { signal: controller.signal })
      .then(setData).catch((e: Error) => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, revision]);

  return <div className="mx-auto max-w-4xl px-4 py-8 md:py-12">
    <header className="mb-8 flex items-end justify-between gap-4 border-b border-neutral-800 pb-6"><h1 className="text-3xl font-bold">커뮤니티</h1><span className="text-sm text-neutral-400">{data.total}개의 글</span></header>
    {session ? <form className="mb-8 grid gap-3 border-b border-neutral-800 pb-8" onSubmit={async event => {
      event.preventDefault(); const form = event.currentTarget; const values = new FormData(form); setFormError(''); setNotice(''); setSaving(true);
      try {
        await request('/posts', postOptions({ title: values.get('title'), content: values.get('content') }));
        form.reset(); setPage(1); setLoading(true); setError(''); setRevision(revision + 1); setNotice('게시글을 등록했습니다.');
      } catch (e) { setFormError(e instanceof Error ? e.message : '게시글 작성에 실패했습니다.'); }
      finally { setSaving(false); }
    }}>
      <label htmlFor="post-title" className="text-sm">제목</label><input id="post-title" name="title" required maxLength={200} className={inputStyle} />
      <label htmlFor="post-content" className="text-sm">내용</label><textarea id="post-content" name="content" required maxLength={10000} rows={5} className={inputStyle} />
      {formError && <p role="alert" className="text-sm text-red-300">{formError}</p>}
      <button disabled={saving} className={`${buttonStyle} justify-self-start`}>{saving ? '등록 중...' : '게시글 등록'}</button>
    </form> : <p className="mb-8 text-sm text-neutral-300"><Link href="/login" className="text-cyan-300 underline">로그인</Link>하면 글과 댓글을 작성할 수 있습니다.</p>}
    {notice && <p role="status" className="mb-4 text-sm text-emerald-300">{notice}</p>}
    {error && <div role="alert" className="mb-4 text-red-300">{error} <button onClick={() => { setError(''); setLoading(true); setRevision(revision + 1); }} className="underline">다시 시도</button></div>}
    {loading ? <p role="status" className="py-8 text-neutral-400">게시글 불러오는 중...</p> : <div className="divide-y divide-neutral-800">
      {data.items.map(post => <article key={post.id} className="py-5">
        <button type="button" aria-expanded={selected === post.id} aria-controls={`post-${post.id}`} className="w-full text-left" onClick={() => setSelected(selected === post.id ? null : post.id)}><h2 className="text-lg font-semibold">{post.title}</h2><p className="mt-2 text-xs text-neutral-400">{post.author?.username ?? '탈퇴한 사용자'} · {new Date(post.createdAt).toLocaleDateString('ko-KR')}</p></button>
        {selected === post.id && <div id={`post-${post.id}`}><p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-neutral-200">{post.content}</p><Comments postId={post.id} /></div>}
      </article>)}
      {!error && data.total === 0 && <p className="py-12 text-center text-neutral-400">아직 게시글이 없습니다.</p>}
    </div>}
    {data.total > 20 && <nav aria-label="게시글 페이지" className="mt-6 flex items-center justify-between gap-3"><button disabled={loading || page === 1} className={buttonStyle} onClick={() => { setLoading(true); setError(''); setSelected(null); setPage(page - 1); }}>이전</button><span>{page} / {Math.ceil(data.total / 20)}</span><button disabled={loading || page * 20 >= data.total} className={buttonStyle} onClick={() => { setLoading(true); setError(''); setSelected(null); setPage(page + 1); }}>다음</button></nav>}
  </div>;
}
