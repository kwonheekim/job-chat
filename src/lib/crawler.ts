import * as cheerio from 'cheerio';
import { anthropic, CRAWL_MODEL } from './anthropic';
import { supabaseAdmin } from './supabase';
import { JobPosting } from '@/types';

export async function crawlWithAI(url: string, company: string): Promise<Partial<JobPosting>[]> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JobCrawler/1.0)' },
  });
  const html = await res.text();
  const $ = cheerio.load(html);
  const text = $('body').text().replace(/\s+/g, ' ').trim();

  const response = await anthropic.messages.create({
    model: CRAWL_MODEL,
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `다음은 ${company} 채용페이지입니다.
프론트엔드 관련 채용공고만 추출해서 JSON 배열로만 반환해주세요. 설명 없이 JSON만.

형식:
[{
  "title": "포지션명",
  "team": "팀명",
  "career_min": 최소경력(숫자 또는 null),
  "career_max": 최대경력(숫자 또는 null),
  "skills": ["기술스택"],
  "location": "근무지",
  "url": "지원링크"
}]

페이지 내용:
${text.slice(0, 8000)}`,
    }],
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text : '[]';
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];
  return JSON.parse(jsonMatch[0]);
}

export async function runCrawlPipeline() {
  const { data: targets, error } = await supabaseAdmin
    .from('crawl_targets')
    .select('*')
    .eq('is_active', true);

  if (error || !targets) return { success: false, error };

  const results = { inserted: 0, updated: 0, deactivated: 0, errors: [] as string[] };

  for (const target of targets) {
    try {
      const jobs = await crawlWithAI(target.url, target.company);

      for (const job of jobs) {
        const payload = {
          company: target.company,
          title: job.title ?? '',
          team: job.team,
          url: job.url,
          skills: job.skills ?? [],
          career_min: job.career_min,
          career_max: job.career_max,
          location: job.location,
          source: 'company_direct',
          source_id: `${target.company}-${job.title}`,
          crawled_at: new Date().toISOString(),
          is_active: true,
        };

        const { error: upsertError } = await supabaseAdmin
          .from('job_postings')
          .upsert(payload, { onConflict: 'source,source_id' });

        if (upsertError) results.errors.push(upsertError.message);
        else results.inserted++;
      }
    } catch (e) {
      results.errors.push(`${target.company}: ${String(e)}`);
    }
  }

  return { success: true, results };
}
