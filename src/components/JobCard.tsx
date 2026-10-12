import { JobPosting } from '@/types';

interface JobCardProps {
  job: JobPosting;
}

export default function JobCard({ job }: JobCardProps) {
  const careerText =
    job.career_min === 0 && job.career_max === 0
      ? '경력 무관'
      : job.career_min !== undefined && job.career_max !== undefined
      ? `${job.career_min}~${job.career_max}년`
      : job.career_min !== undefined
      ? `${job.career_min}년 이상`
      : '';

  const companySizeLabel = { startup: '스타트업', mid: '중견기업', enterprise: '대기업' };

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:shadow-sm transition-all bg-white">
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 mb-1">{job.company}</p>
          <h3 className="font-semibold text-gray-900 text-sm leading-snug">{job.title}</h3>
          {job.team && <p className="text-xs text-gray-500 mt-0.5">{job.team}</p>}
        </div>
        {job.company_size && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 whitespace-nowrap flex-shrink-0">
            {companySizeLabel[job.company_size]}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1 mt-2">
        {job.skills?.slice(0, 5).map(skill => (
          <span key={skill} className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
            {skill}
          </span>
        ))}
        {(job.skills?.length ?? 0) > 5 && (
          <span className="text-xs text-gray-400">+{job.skills!.length - 5}</span>
        )}
      </div>

      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
        {job.location && <span>📍 {job.location}</span>}
        {careerText && <span>💼 {careerText}</span>}
        {job.posted_at && <span>{job.posted_at}</span>}
      </div>

      {job.url && (
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs text-blue-500 hover:text-blue-700 hover:underline"
        >
          지원하기 →
        </a>
      )}
    </div>
  );
}
