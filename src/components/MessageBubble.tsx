import { Message } from '@/types';
import JobCard from './JobCard';

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[80%] ${isUser ? 'order-2' : 'order-1'}`}>
        {/* 아바타 */}
        <div className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
              isUser ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
            }`}
          >
            {isUser ? '나' : 'AI'}
          </div>

          {/* 말풍선 */}
          <div
            className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
              isUser
                ? 'bg-blue-500 text-white rounded-br-sm'
                : 'bg-gray-100 text-gray-800 rounded-bl-sm'
            }`}
          >
            {message.content}
          </div>
        </div>

        {/* 채용공고 카드 목록 */}
        {message.jobs && message.jobs.length > 0 && (
          <div className="mt-2 ml-9 space-y-2">
            {message.jobs.map(job => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
