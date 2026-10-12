import Anthropic from '@anthropic-ai/sdk';

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export const CHAT_MODEL = 'claude-sonnet-4-6';
export const CRAWL_MODEL = 'claude-haiku-4-5-20251001';

export const systemPrompt = `
당신은 프론트엔드 채용 전문 도우미입니다. 다음 영역을 지원합니다:

1. 채용공고 검색 — Tool을 사용해서 DB에서 검색
2. 면접 준비 가이드 — 기업별 면접 프로세스, 자주 나오는 질문, 준비 팁
3. 코딩테스트 준비 — 추천 문제 유형, 학습 로드맵, 플랫폼 추천
4. 기술 면접 대비 — React, TypeScript, 브라우저, 네트워크 등 핵심 개념 설명
5. 채용 시장 분석 — 기술스택 트렌드, 연봉 정보, 기업 비교

채용공고 데이터가 필요한 질문은 Tool을 호출하고,
일반적인 면접/코테 준비 질문은 당신의 지식으로 직접 답변하세요.
답변은 한국어로 해주세요.
`.trim();

export const chatTools: Anthropic.Tool[] = [
  {
    name: 'search_jobs',
    description: '채용공고를 다양한 조건으로 검색합니다',
    input_schema: {
      type: 'object',
      properties: {
        keyword:      { type: 'string',  description: '자유 검색어' },
        skills:       { type: 'array',   items: { type: 'string' }, description: '기술스택 (예: React, TypeScript)' },
        company:      { type: 'string',  description: '기업명' },
        company_size: { type: 'string',  enum: ['startup', 'mid', 'enterprise'], description: '기업 규모' },
        location:     { type: 'string',  description: '근무 지역' },
        career_min:   { type: 'integer', description: '최소 경력 (년)' },
        career_max:   { type: 'integer', description: '최대 경력 (년)' },
        posted_after: { type: 'string',  description: '이 날짜 이후 게시된 공고 (YYYY-MM-DD)' },
        sort_by:      { type: 'string',  enum: ['latest', 'salary', 'company'] },
        limit:        { type: 'integer', description: '결과 수 (기본 10)' },
      },
    },
  },
  {
    name: 'get_companies',
    description: '등록된 기업 목록을 조회합니다',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_job_detail',
    description: '특정 채용공고의 상세 정보를 조회합니다',
    input_schema: {
      type: 'object',
      properties: {
        job_id: { type: 'string', description: '공고 ID' },
      },
      required: ['job_id'],
    },
  },
  {
    name: 'get_job_stats',
    description: '채용 시장 통계를 조회합니다',
    input_schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['by_skill', 'by_company', 'by_location', 'daily_count'] },
      },
    },
  },
];
