export interface JobPosting {
  id: string;
  company: string;
  title: string;
  team?: string;
  url?: string;
  skills?: string[];
  career_min?: number;
  career_max?: number;
  location?: string;
  salary_min?: number;
  salary_max?: number;
  company_size?: 'startup' | 'mid' | 'enterprise';
  posted_at?: string;
  expires_at?: string;
  crawled_at: string;
  is_active: boolean;
  source: string;
  source_id?: string;
}

export interface CrawlTarget {
  id: string;
  company: string;
  url: string;
  is_active: boolean;
  created_at: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  jobs?: JobPosting[];
  createdAt: Date;
}

export interface SearchJobsParams {
  keyword?: string;
  skills?: string[];
  company?: string;
  company_size?: 'startup' | 'mid' | 'enterprise';
  location?: string;
  career_min?: number;
  career_max?: number;
  posted_after?: string;
  sort_by?: 'latest' | 'salary' | 'company';
  limit?: number;
}
