import { NextResponse } from 'next/server';
import { runCrawlPipeline } from '@/lib/crawler';

export async function GET() {
  const result = await runCrawlPipeline();
  return NextResponse.json(result);
}

export async function POST() {
  const result = await runCrawlPipeline();
  return NextResponse.json(result);
}
