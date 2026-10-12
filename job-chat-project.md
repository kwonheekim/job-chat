# 프론트엔드 채용공고 AI 챗봇 프로젝트

## 프로젝트 개요

프론트엔드 채용공고를 자연어로 검색할 수 있는 AI 챗봇.
사람인, 원티드 등 채용 플랫폼 + 특정 기업 채용페이지를 크롤링하여 통합 DB에 저장하고, AI가 사용자 질문을 이해해서 적절한 공고를 찾아준다.

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | Next.js 15 (App Router), TypeScript, Tailwind CSS |
| 백엔드 | Next.js API Routes (서버리스) |
| AI | Claude API (Tool Use) — Haiku 또는 Sonnet 모델 |
| DB | Supabase (PostgreSQL) |
| 크롤링 | Cheerio (정적) / Puppeteer (SPA) + AI 파싱 |
| 배포 | Vercel |
| 스케줄러 | Vercel Cron (매일 1회 크롤링) |

---

## 예상 비용 (월)

| 항목 | 비용 |
|------|------|
| Vercel | $0 (무료 티어) |
| Supabase | $0 (무료 티어) |
| Claude API | $5~10 (종량제) |
| 도메인 (선택) | 연 $10~15 |
| **총** | **월 $5~10** |

---

## 프로젝트 구조

```
job-chat/
├── app/
│   ├── page.tsx                 # 메인 (챗봇 UI)
│   ├── admin/page.tsx           # 관리자 (크롤링 대상 관리)
│   ├── api/
│   │   ├── chat/route.ts        # 챗봇 API
│   │   ├── crawl/route.ts       # 크롤링 실행 API
│   │   └── jobs/route.ts        # 채용공고 조회 API
│   └── layout.tsx
├── lib/
│   ├── supabase.ts              # DB 클라이언트
│   ├── anthropic.ts             # Claude 클라이언트
│   └── crawler.ts               # 크롤링 로직
├── components/
│   ├── ChatWindow.tsx           # 채팅 영역
│   ├── MessageBubble.tsx        # 메시지 말풍선
│   ├── ChatInput.tsx            # 입력창
│   └── JobCard.tsx              # 채용공고 카드
└── types/
    └── index.ts                 # 타입 정의
```

---

## DB 설계 (Supabase)

### crawl_targets — 크롤링 대상 기업

```sql
CREATE TABLE crawl_targets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company     TEXT NOT NULL,
  url         TEXT NOT NULL,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

### job_postings — 채용공고

```sql
CREATE TABLE job_postings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 기본 정보
  company     TEXT NOT NULL,
  title       TEXT NOT NULL,
  team        TEXT,
  url         TEXT,

  -- 검색 필터용
  skills      TEXT[],
  career_min  INTEGER,
  career_max  INTEGER,
  location    TEXT,
  salary_min  INTEGER,
  salary_max  INTEGER,
  company_size TEXT,           -- 'startup', 'mid', 'enterprise'

  -- 신선도 관리
  posted_at   DATE,
  expires_at  DATE,
  crawled_at  TIMESTAMPTZ DEFAULT now(),
  is_active   BOOLEAN DEFAULT true,

  -- 중복 방지
  source      TEXT NOT NULL,   -- 'saramin', 'wanted', 'company_direct'
  source_id   TEXT,
  UNIQUE(source, source_id)
);

CREATE INDEX idx_skills ON job_postings USING GIN (skills);
CREATE INDEX idx_company ON job_postings (company);
CREATE INDEX idx_posted_at ON job_postings (posted_at);
CREATE INDEX idx_location ON job_postings (location);
```

---

## 핵심 기능

### 1. AI 챗봇 (Tool Use 패턴)

사용자의 자연어 질문을 AI가 이해하고, 적절한 Tool을 호출해서 DB를 검색한다.

**AI Tools:**

```typescript
const tools = [
  {
    name: 'search_jobs',
    description: '채용공고를 다양한 조건으로 검색합니다',
    input_schema: {
      type: 'object',
      properties: {
        keyword:      { type: 'string',   description: '자유 검색어' },
        skills:       { type: 'array',    items: { type: 'string' },
                        description: '기술스택 (예: React, TypeScript)' },
        company:      { type: 'string',   description: '기업명' },
        company_size: { type: 'string',   enum: ['startup', 'mid', 'enterprise'],
                        description: '기업 규모' },
        location:     { type: 'string',   description: '근무 지역' },
        career_min:   { type: 'integer',  description: '최소 경력 (년)' },
        career_max:   { type: 'integer',  description: '최대 경력 (년)' },
        posted_after: { type: 'string',   description: '이 날짜 이후 게시된 공고 (YYYY-MM-DD)' },
        sort_by:      { type: 'string',   enum: ['latest', 'salary', 'company'] },
        limit:        { type: 'integer',  description: '결과 수 (기본 10)' },
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
        type: { type: 'string',
                enum: ['by_skill', 'by_company', 'by_location', 'daily_count'] },
      },
    },
  },
];
```

**대화 예시:**

```
👤 오늘 새로 올라온 프론트엔드 공고 알려줘
🤖 → search_jobs({ posted_after: '2026-10-12', category: 'frontend' })

👤 대기업 기준으로 알려줘
🤖 → search_jobs({ company_size: 'enterprise' })

👤 React, TypeScript, Next.js 있는 곳으로 채용공고 알려줘
🤖 → search_jobs({ skills: ['React', 'TypeScript', 'Next.js'] })

👤 판교에 3년차 가능한 곳
🤖 → search_jobs({ location: '판교', career_min: 0, career_max: 3 })

👤 요즘 가장 많이 요구하는 기술스택이 뭐야?
🤖 → get_job_stats({ type: 'by_skill' })
```

### 2. AI 크롤러

기업별로 파서를 따로 만들지 않고, AI가 HTML 내용을 보고 알아서 채용공고를 추출한다.

```typescript
async function crawlWithAI(url: string, company: string) {
  const html = await fetch(url).then(r => r.text());
  const $ = cheerio.load(html);
  const text = $('body').text().replace(/\s+/g, ' ').trim();

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `다음은 ${company} 채용페이지입니다.
프론트엔드 관련 채용공고만 추출해서 JSON으로 반환해주세요.

형식:
[{
  "title": "포지션명",
  "team": "팀명",
  "career_min": 최소경력(숫자),
  "career_max": 최대경력(숫자),
  "skills": ["기술스택"],
  "location": "근무지",
  "url": "지원링크"
}]

페이지 내용:
${text.slice(0, 8000)}`,
    }],
  });

  return JSON.parse(response.content[0].text);
}
```

### 3. 관리자 페이지 (/admin)

- 크롤링 대상 기업 추가/삭제/활성화 관리
- 수동 크롤링 실행 버튼
- 크롤링 상태 및 공고 수 대시보드

---

## 데이터 수집 소스

| 소스 | 방법 | 비고 |
|------|------|------|
| 사람인 | 공식 API (`oapi.saramin.co.kr`) | API 키 발급 필요 |
| 원티드 | 크롤링 + AI 파싱 | |
| 점핏 | 크롤링 + AI 파싱 | |
| 프로그래머스 | 크롤링 + AI 파싱 | |
| 특정 기업 채용페이지 | 크롤링 + AI 파싱 | 관리자 페이지에서 URL 등록 |

**기업 채용페이지 예시:**

| 기업 | URL |
|------|-----|
| 토스 | toss.im/career/jobs |
| 카카오 | careers.kakao.com |
| 네이버 | recruit.navercorp.com |
| 라인 | careers.linecorp.com |
| 쿠팡 | www.coupang.jobs |
| 배민 | career.woowahan.com |
| 당근 | about.daangn.com/jobs |

---

## 크롤링 파이프라인

```
Vercel Cron (매일 오전 9시)
  ↓
GET /api/crawl
  ↓
crawl_targets 테이블에서 is_active=true 조회
  ↓
각 URL fetch → HTML 텍스트 추출
  ↓
Claude API로 파싱 (AI 크롤러)
  ↓
기존 공고와 비교
  ├── 새 공고 → INSERT
  ├── 사라진 공고 → is_active = false
  └── 변경된 공고 → UPDATE
  ↓
크롤링 로그 기록
```

---

## 개발 일정

| 단계 | 내용 | 예상 소요 |
|------|------|-----------|
| Phase 1 | 프로젝트 셋업 (Next.js, Supabase 연동) | 반나절 |
| Phase 2 | DB 테이블 생성 | 반나절 |
| Phase 3-1 | 채팅 UI (ChatWindow, MessageBubble, ChatInput, JobCard) | 1-2일 |
| Phase 3-2 | 챗봇 API (Claude Tool Use 연동) | 1-2일 |
| Phase 3-3 | 크롤러 구현 (AI 파싱 + Cron) | 2-3일 |
| Phase 3-4 | 관리자 페이지 | 1일 |
| Phase 4 | Vercel 배포 + 환경변수 설정 | 반나절 |
| **합계** | | **약 1~2주** |

---

## 배포 설정

### 환경변수 (Vercel)

```
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Cron 설정 (vercel.json)

```json
{
  "crons": [{
    "path": "/api/crawl",
    "schedule": "0 0 * * *"
  }]
}
```

### 배포 흐름

```
GitHub push → Vercel 자동 빌드/배포 → 완료
```

---

## 채용 준비 도우미 기능 (면접/코딩테스트)

채용공고 검색뿐 아니라, 면접 준비/코딩테스트 가이드도 같은 챗봇에서 제공한다.
별도 챗봇을 만들 필요 없이, 시스템 프롬프트와 Tool 확장으로 처리.

### 동작 방식

AI가 질문 유형을 스스로 판단해서 Tool 호출 또는 직접 답변을 결정한다.

| 질문 유형 | AI 처리 방식 |
|-----------|-------------|
| "카카오 프론트엔드 공고 보여줘" | Tool 호출 → DB 검색 |
| "카카오 면접 준비할 사항이 뭐야?" | AI 직접 답변 (자체 지식) |
| "코딩테스트 어떻게 준비해?" | AI 직접 답변 |
| "React 면접 질문 자주 나오는 거 알려줘" | AI 직접 답변 |
| "카카오 채용 프로세스가 어떻게 돼?" | Tool 호출 (DB에 데이터 있으면) 또는 AI 직접 답변 |

### 시스템 프롬프트

```typescript
const systemPrompt = `
당신은 프론트엔드 채용 전문 도우미입니다. 다음 영역을 지원합니다:

1. 채용공고 검색 — Tool을 사용해서 DB에서 검색
2. 면접 준비 가이드 — 기업별 면접 프로세스, 자주 나오는 질문, 준비 팁
3. 코딩테스트 준비 — 추천 문제 유형, 학습 로드맵, 플랫폼 추천
4. 기술 면접 대비 — React, TypeScript, 브라우저, 네트워크 등 핵심 개념 설명
5. 채용 시장 분석 — 기술스택 트렌드, 연봉 정보, 기업 비교

채용공고 데이터가 필요한 질문은 Tool을 호출하고,
일반적인 면접/코테 준비 질문은 당신의 지식으로 직접 답변하세요.
`;
```

### 대화 예시

```
👤 카카오 프론트엔드 채용 관련해서 준비할 사항들이 뭐야?
🤖 카카오 프론트엔드 채용 준비 가이드입니다:

   📋 채용 프로세스
   1. 서류 전형 (포트폴리오 + 이력서)
   2. 코딩테스트 (프로그래머스, 2-3시간)
   3. 1차 기술면접 (알고리즘 + 프론트 지식)
   4. 2차 컬처핏 면접

   🛠 준비 사항
   - JavaScript/TypeScript 핵심 개념
   - React 심화 (Virtual DOM, hooks, 렌더링 최적화)
   - 웹 성능 최적화 경험
   - CS 기초 (네트워크, 브라우저 렌더링)
   ...

👤 코딩테스트는 어떻게 준비해야 해?
🤖 프론트엔드 코딩테스트 준비 로드맵:

   📌 필수 알고리즘
   - 해시/맵, 스택/큐, DFS/BFS, 정렬, 이분탐색

   📌 추천 플랫폼
   - 프로그래머스 (카카오 기출)
   - 백준 (알고리즘 기초)
   - LeetCode (해외 기업)

   📌 학습 순서
   1주차: 자료구조 기초 ...
   ...
```

### 향후 확장: 면접 정보 DB (Phase 2)

AI 자체 지식으로 시작하되, 나중에 면접 후기 데이터를 크롤링/수집하면 더 정확한 답변 가능.

```sql
CREATE TABLE interview_info (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company     TEXT NOT NULL,          -- '카카오'
  position    TEXT,                   -- '프론트엔드'
  process     TEXT[],                 -- '{서류,코테,1차면접,2차면접}'
  questions   TEXT[],                 -- 자주 나오는 질문
  tips        TEXT,                   -- 준비 팁
  difficulty  TEXT,                   -- '상', '중', '하'
  source      TEXT,                   -- 출처 (블로그, 후기 등)
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_interview_company ON interview_info (company);
```

**추가 Tool:**

```typescript
{
  name: 'get_interview_info',
  description: '기업별 면접/채용 프로세스 정보를 조회합니다',
  input_schema: {
    type: 'object',
    properties: {
      company:  { type: 'string', description: '기업명' },
      position: { type: 'string', description: '포지션 (예: 프론트엔드)' },
    },
  },
}
```

---

## 향후 확장 기능

| 기능 | 설명 | 우선순위 |
|------|------|----------|
| 스트리밍 응답 | 타이핑 효과 (SSE) | 높음 |
| 반응형 UI | 모바일 대응 | 높음 |
| 면접 준비 가이드 | AI 자체 지식 기반 답변 (별도 Tool 불필요) | 높음 |
| 대화 기록 저장 | DB에 세션별 저장 | 중간 |
| 새 공고 알림 | 조건 등록 → 이메일/슬랙 알림 | 중간 |
| 북마크 | 관심 공고 저장 | 중간 |
| 트렌드 분석 | 기술스택 트렌드, 공고 수 추이 | 중간 |
| 면접 후기 DB | 크롤링으로 면접 정보 수집 → 더 정확한 답변 | 중간 |
| 이력서 매칭 | 내 스택 등록 → 매칭률 계산 | 낮음 |
| 공고 비교 | "토스 vs 카카오 비교해줘" | 낮음 |
| 모의 면접 | AI가 면접관 역할로 질문 → 답변 피드백 | 낮음 |

---

## 참고

- Claude API 콘솔: https://console.anthropic.com
- Supabase: https://supabase.com
- Vercel: https://vercel.com
- Claude API는 Pro 구독($20/월)과 별개. API 키만 발급받으면 됨 (종량제)
