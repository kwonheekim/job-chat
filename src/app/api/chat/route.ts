import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { anthropic, CHAT_MODEL, systemPrompt, chatTools } from '@/lib/anthropic';
import { supabase } from '@/lib/supabase';
import { SearchJobsParams } from '@/types';

async function handleToolCall(name: string, input: Record<string, unknown>) {
  if (name === 'search_jobs') {
    const params = input as SearchJobsParams;
    let query = supabase
      .from('job_postings')
      .select('*')
      .eq('is_active', true)
      .limit(params.limit ?? 10);

    if (params.skills?.length) {
      query = query.overlaps('skills', params.skills);
    }
    if (params.company) {
      query = query.ilike('company', `%${params.company}%`);
    }
    if (params.company_size) {
      query = query.eq('company_size', params.company_size);
    }
    if (params.location) {
      query = query.ilike('location', `%${params.location}%`);
    }
    if (params.career_min !== undefined) {
      query = query.gte('career_max', params.career_min);
    }
    if (params.career_max !== undefined) {
      query = query.lte('career_min', params.career_max);
    }
    if (params.posted_after) {
      query = query.gte('posted_at', params.posted_after);
    }
    if (params.keyword) {
      query = query.or(`title.ilike.%${params.keyword}%,team.ilike.%${params.keyword}%`);
    }
    if (params.sort_by === 'latest') query = query.order('posted_at', { ascending: false });
    else if (params.sort_by === 'salary') query = query.order('salary_max', { ascending: false });
    else if (params.sort_by === 'company') query = query.order('company');
    else query = query.order('crawled_at', { ascending: false });

    const { data, error } = await query;
    if (error) return { error: error.message };
    return { jobs: data ?? [], count: data?.length ?? 0 };
  }

  if (name === 'get_companies') {
    const { data, error } = await supabase
      .from('crawl_targets')
      .select('company, url, is_active')
      .eq('is_active', true)
      .order('company');
    if (error) return { error: error.message };
    return { companies: data ?? [] };
  }

  if (name === 'get_job_detail') {
    const { job_id } = input as { job_id: string };
    const { data, error } = await supabase
      .from('job_postings')
      .select('*')
      .eq('id', job_id)
      .single();
    if (error) return { error: error.message };
    return { job: data };
  }

  if (name === 'get_job_stats') {
    const { type } = input as { type: string };

    if (type === 'by_skill') {
      const { data } = await supabase.from('job_postings').select('skills').eq('is_active', true);
      const skillCount: Record<string, number> = {};
      data?.forEach(row => row.skills?.forEach((s: string) => {
        skillCount[s] = (skillCount[s] ?? 0) + 1;
      }));
      const sorted = Object.entries(skillCount).sort((a, b) => b[1] - a[1]).slice(0, 20);
      return { stats: sorted.map(([skill, count]) => ({ skill, count })) };
    }

    if (type === 'by_company') {
      const { data } = await supabase
        .from('job_postings')
        .select('company')
        .eq('is_active', true);
      const companyCount: Record<string, number> = {};
      data?.forEach(row => { companyCount[row.company] = (companyCount[row.company] ?? 0) + 1; });
      const sorted = Object.entries(companyCount).sort((a, b) => b[1] - a[1]).slice(0, 20);
      return { stats: sorted.map(([company, count]) => ({ company, count })) };
    }

    if (type === 'by_location') {
      const { data } = await supabase
        .from('job_postings')
        .select('location')
        .eq('is_active', true);
      const locationCount: Record<string, number> = {};
      data?.forEach(row => {
        if (row.location) locationCount[row.location] = (locationCount[row.location] ?? 0) + 1;
      });
      const sorted = Object.entries(locationCount).sort((a, b) => b[1] - a[1]);
      return { stats: sorted.map(([location, count]) => ({ location, count })) };
    }

    if (type === 'daily_count') {
      const { data } = await supabase
        .from('job_postings')
        .select('posted_at')
        .eq('is_active', true)
        .order('posted_at', { ascending: false })
        .limit(30);
      const dayCount: Record<string, number> = {};
      data?.forEach(row => {
        if (row.posted_at) dayCount[row.posted_at] = (dayCount[row.posted_at] ?? 0) + 1;
      });
      return { stats: Object.entries(dayCount).map(([date, count]) => ({ date, count })) };
    }

    return { error: 'Unknown stats type' };
  }

  if (name === 'search_web') {
    const { query } = input as { query: string };
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        search_depth: 'basic',
        include_answer: true,
        max_results: 5,
      }),
    });
    const data = await res.json();
    return {
      answer: data.answer ?? '',
      results: (data.results ?? []).map((r: { title: string; url: string; content: string }) => ({
        title: r.title,
        url: r.url,
        content: r.content,
      })),
    };
  }

  return { error: 'Unknown tool' };
}

export async function POST(req: NextRequest) {
  const { messages } = await req.json();

  const anthropicMessages: Anthropic.MessageParam[] = messages.map(
    (m: { role: string; content: string }) => ({ role: m.role as 'user' | 'assistant', content: m.content })
  );

  let response = await anthropic.messages.create({
    model: CHAT_MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    tools: chatTools,
    messages: anthropicMessages,
  });

  // Tool Use 루프
  while (response.stop_reason === 'tool_use') {
    const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of toolUseBlocks) {
      if (block.type !== 'tool_use') continue;
      const result = await handleToolCall(block.name, block.input as Record<string, unknown>);
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(result),
      });
    }

    anthropicMessages.push({ role: 'assistant', content: response.content });
    anthropicMessages.push({ role: 'user', content: toolResults });

    response = await anthropic.messages.create({
      model: CHAT_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      tools: chatTools,
      messages: anthropicMessages,
    });
  }

  const textBlock = response.content.find(b => b.type === 'text');
  const text = textBlock?.type === 'text' ? textBlock.text : '죄송합니다, 답변을 생성하지 못했습니다.';

  return NextResponse.json({ message: text });
}
