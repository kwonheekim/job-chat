'use client';

import { useState, useEffect } from 'react';
import { CrawlTarget } from '@/types';
import { supabase } from '@/lib/supabase';

export default function AdminPage() {
  const [targets, setTargets] = useState<CrawlTarget[]>([]);
  const [newCompany, setNewCompany] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [isCrawling, setIsCrawling] = useState(false);
  const [crawlLog, setCrawlLog] = useState('');
  const [jobCount, setJobCount] = useState(0);

  useEffect(() => {
    fetchTargets();
    fetchJobCount();
  }, []);

  const fetchTargets = async () => {
    const { data } = await supabase.from('crawl_targets').select('*').order('company');
    setTargets(data ?? []);
  };

  const fetchJobCount = async () => {
    const { count } = await supabase
      .from('job_postings')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);
    setJobCount(count ?? 0);
  };

  const addTarget = async () => {
    if (!newCompany.trim() || !newUrl.trim()) return;
    await supabase.from('crawl_targets').insert({ company: newCompany.trim(), url: newUrl.trim() });
    setNewCompany('');
    setNewUrl('');
    fetchTargets();
  };

  const toggleTarget = async (id: string, current: boolean) => {
    await supabase.from('crawl_targets').update({ is_active: !current }).eq('id', id);
    fetchTargets();
  };

  const deleteTarget = async (id: string) => {
    await supabase.from('crawl_targets').delete().eq('id', id);
    fetchTargets();
  };

  const runCrawl = async () => {
    setIsCrawling(true);
    setCrawlLog('크롤링 시작...');
    try {
      const res = await fetch('/api/crawl', { method: 'POST' });
      const data = await res.json();
      setCrawlLog(JSON.stringify(data, null, 2));
      fetchJobCount();
    } catch (e) {
      setCrawlLog(`오류: ${String(e)}`);
    } finally {
      setIsCrawling(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900">관리자 페이지</h1>
          <a href="/" className="text-sm text-blue-500 hover:underline">← 챗봇으로</a>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <p className="text-xs text-gray-500">등록 기업</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{targets.length}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <p className="text-xs text-gray-500">활성 공고</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{jobCount}</p>
          </div>
        </div>

        {/* 크롤링 실행 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800">크롤링 실행</h2>
            <button
              onClick={runCrawl}
              disabled={isCrawling}
              className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isCrawling ? '크롤링 중...' : '지금 실행'}
            </button>
          </div>
          {crawlLog && (
            <div className="relative">
              <pre className="bg-gray-50 rounded-lg p-3 text-xs text-gray-700 overflow-x-auto max-h-32">
                {crawlLog}
              </pre>
              <button
                onClick={() => navigator.clipboard.writeText(crawlLog)}
                className="absolute top-2 right-2 text-xs px-2 py-1 bg-white border border-gray-200 rounded hover:bg-gray-100 text-gray-500 transition-colors"
              >
                복사
              </button>
            </div>
          )}
        </div>

        {/* 기업 추가 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <h2 className="font-semibold text-gray-800 mb-3">크롤링 대상 추가</h2>
          <div className="flex gap-2">
            <input
              value={newCompany}
              onChange={e => setNewCompany(e.target.value)}
              placeholder="기업명"
              className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-400 bg-white"
            />
            <input
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              placeholder="채용페이지 URL"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-400 bg-white"
            />
            <button
              onClick={addTarget}
              className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
            >
              추가
            </button>
          </div>
        </div>

        {/* 기업 목록 */}
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          <div className="px-4 py-3">
            <h2 className="font-semibold text-gray-800">등록 기업 목록</h2>
          </div>
          {targets.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-400">등록된 기업이 없습니다.</div>
          )}
          {targets.map(t => (
            <div key={t.id} className="px-4 py-3 flex items-center gap-3">
              <button
                onClick={() => toggleTarget(t.id, t.is_active)}
                className={`w-10 h-5 rounded-full transition-colors ${t.is_active ? 'bg-blue-500' : 'bg-gray-200'}`}
              >
                <span className={`block w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5 ${t.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{t.company}</p>
                <a
                  href={t.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-600 hover:underline truncate"
                >
                  {t.url}
                </a>
              </div>
              <button
                onClick={() => deleteTarget(t.id)}
                className="text-xs text-red-400 hover:text-red-600 transition-colors"
              >
                삭제
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
