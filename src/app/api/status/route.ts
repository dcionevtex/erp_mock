// Server-side proxy for the VTEX status RSS feed.
// Avoids CORS issues and caches the response for 5 minutes on Vercel.

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function extractCdata(xml: string, tag: string): string {
  const match = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${tag}>`, 'i').exec(xml);
  if (!match) return '';
  return (match[1] ?? match[2] ?? '').trim();
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

function statusFromTitle(title: string): 'resolved' | 'monitoring' | 'investigating' | 'identified' | 'maintenance' | 'update' | 'unknown' {
  const t = title.toLowerCase();
  if (t.includes('resolved') || t.includes('postmortem')) return 'resolved';
  if (t.includes('monitoring')) return 'monitoring';
  if (t.includes('investigating')) return 'investigating';
  if (t.includes('identified')) return 'identified';
  if (t.includes('maintenance') || t.includes('scheduled')) return 'maintenance';
  if (t.includes('update')) return 'update';
  return 'unknown';
}

export type StatusItem = {
  title: string;
  link: string;
  pubDate: string;
  summary: string;
  status: ReturnType<typeof statusFromTitle>;
};

export async function GET() {
  try {
    const res = await fetch('https://status.vtex.com/feed.rss', {
      headers: { 'User-Agent': 'VTEX-Demo-Platform/1.0' },
      next: { revalidate: 300 },
    });

    if (!res.ok) return NextResponse.json({ items: [], error: 'feed_unavailable' });

    const xml = await res.text();
    const items: StatusItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
      const chunk = match[1];
      const title = extractCdata(chunk, 'title');
      const guid  = extractCdata(chunk, 'guid');
      const link  = extractCdata(chunk, 'link') || guid;
      const pubDate = extractCdata(chunk, 'pubDate');
      const description = stripHtml(extractCdata(chunk, 'description')).slice(0, 220);

      if (title) {
        items.push({ title, link, pubDate, summary: description, status: statusFromTitle(title) });
      }
      if (items.length >= 8) break;
    }

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [], error: 'fetch_failed' });
  }
}
