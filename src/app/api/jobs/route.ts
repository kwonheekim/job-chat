import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const company = searchParams.get('company');
  const limit = parseInt(searchParams.get('limit') ?? '20');

  let query = supabase
    .from('job_postings')
    .select('*')
    .eq('is_active', true)
    .order('crawled_at', { ascending: false })
    .limit(limit);

  if (company) query = query.eq('company', company);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobs: data ?? [] });
}
