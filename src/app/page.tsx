'use client';

import { useState } from 'react';
import { Message } from '@/types';
import ChatWindow from '@/components/ChatWindow';
import ChatInput from '@/components/ChatInput';

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async (content: string) => {
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      createdAt: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });

      const data = await res.json();

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.message,
        createdAt: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '오류가 발생했습니다. 다시 시도해주세요.',
        createdAt: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">💼</span>
          <div>
            <h1 className="font-semibold text-gray-900 text-sm">프론트엔드 채용 AI</h1>
            <p className="text-xs text-gray-500">채용공고 검색 · 면접 준비 · 코딩테스트 가이드</p>
          </div>
        </div>
        <a
          href="/admin"
          className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
        >
          관리자
        </a>
      </header>

      {/* 채팅 영역 */}
      <ChatWindow messages={messages} isLoading={isLoading} />

      {/* 입력창 */}
      <ChatInput onSend={sendMessage} disabled={isLoading} />
    </div>
  );
}
