/**
 * X API wrapper — adapted from x-research-skill by rohunvora.
 * Bearer token is passed per-call instead of read from env,
 * enabling multi-tenant usage.
 */

const BASE = "https://api.x.com/2";
const RATE_DELAY_MS = 350;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export interface Tweet {
  id: string;
  text: string;
  author_id: string;
  username: string;
  name: string;
  created_at: string;
  conversation_id: string;
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
    quotes: number;
    impressions: number;
    bookmarks: number;
  };
  urls: string[];
  mentions: string[];
  hashtags: string[];
  tweet_url: string;
}

interface RawResponse {
  data?: any[];
  includes?: { users?: any[] };
  meta?: { next_token?: string; result_count?: number };
  errors?: any[];
  title?: string;
  detail?: string;
  status?: number;
}

const FIELDS =
  "tweet.fields=created_at,public_metrics,author_id,conversation_id,entities&expansions=author_id&user.fields=username,name,public_metrics";

function parseTweets(raw: RawResponse): Tweet[] {
  if (!raw.data) return [];
  const users: Record<string, any> = {};
  for (const u of raw.includes?.users || []) {
    users[u.id] = u;
  }
  return raw.data.map((t: any) => {
    const u = users[t.author_id] || {};
    const m = t.public_metrics || {};
    return {
      id: t.id,
      text: t.text,
      author_id: t.author_id,
      username: u.username || "?",
      name: u.name || "?",
      created_at: t.created_at,
      conversation_id: t.conversation_id,
      metrics: {
        likes: m.like_count || 0,
        retweets: m.retweet_count || 0,
        replies: m.reply_count || 0,
        quotes: m.quote_count || 0,
        impressions: m.impression_count || 0,
        bookmarks: m.bookmark_count || 0,
      },
      urls: (t.entities?.urls || []).map((u: any) => u.expanded_url).filter(Boolean),
      mentions: (t.entities?.mentions || []).map((m: any) => m.username).filter(Boolean),
      hashtags: (t.entities?.hashtags || []).map((h: any) => h.tag).filter(Boolean),
      tweet_url: `https://x.com/${u.username || "?"}/status/${t.id}`,
    };
  });
}

function parseSince(since: string): string | null {
  const match = since.match(/^(\d+)(m|h|d)$/);
  if (match) {
    const num = parseInt(match[1]);
    const unit = match[2];
    const ms =
      unit === "m" ? num * 60_000 :
      unit === "h" ? num * 3_600_000 :
      num * 86_400_000;
    return new Date(Date.now() - ms).toISOString();
  }
  if (since.includes("T") || since.includes("-")) {
    try { return new Date(since).toISOString(); } catch { return null; }
  }
  return null;
}

async function apiGet(bearerToken: string, url: string): Promise<RawResponse> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${bearerToken}` },
  });
  if (res.status === 429) {
    const reset = res.headers.get("x-rate-limit-reset");
    const waitSec = reset ? Math.max(parseInt(reset) - Math.floor(Date.now() / 1000), 1) : 60;
    throw new Error(`Rate limited. Resets in ${waitSec}s`);
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`X API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<RawResponse>;
}

export async function search(
  bearerToken: string,
  query: string,
  opts: {
    maxResults?: number;
    pages?: number;
    sortOrder?: "relevancy" | "recency";
    since?: string;
  } = {}
): Promise<Tweet[]> {
  const maxResults = Math.max(Math.min(opts.maxResults || 100, 100), 10);
  const pages = opts.pages || 1;
  const sort = opts.sortOrder || "relevancy";
  const encoded = encodeURIComponent(query);

  let timeFilter = "";
  if (opts.since) {
    const startTime = parseSince(opts.since);
    if (startTime) timeFilter = `&start_time=${startTime}`;
  }

  let allTweets: Tweet[] = [];
  let nextToken: string | undefined;

  for (let page = 0; page < pages; page++) {
    const pagination = nextToken ? `&pagination_token=${nextToken}` : "";
    const url = `${BASE}/tweets/search/recent?query=${encoded}&max_results=${maxResults}&${FIELDS}&sort_order=${sort}${timeFilter}${pagination}`;
    const raw = await apiGet(bearerToken, url);
    allTweets.push(...parseTweets(raw));
    nextToken = raw.meta?.next_token;
    if (!nextToken) break;
    if (page < pages - 1) await sleep(RATE_DELAY_MS);
  }

  return allTweets;
}

export async function thread(
  bearerToken: string,
  conversationId: string,
  opts: { pages?: number } = {}
): Promise<Tweet[]> {
  const tweets = await search(bearerToken, `conversation_id:${conversationId}`, {
    pages: opts.pages || 2,
    sortOrder: "recency",
  });
  try {
    const rootUrl = `${BASE}/tweets/${conversationId}?${FIELDS}`;
    const raw = await apiGet(bearerToken, rootUrl);
    if (raw.data && !Array.isArray(raw.data)) {
      const rootTweets = parseTweets({ ...raw, data: [raw.data] });
      if (rootTweets.length > 0) tweets.unshift(...rootTweets);
    }
  } catch { /* root tweet may be deleted */ }
  return tweets;
}

export async function profile(
  bearerToken: string,
  username: string,
  opts: { count?: number; includeReplies?: boolean } = {}
): Promise<{ user: any; tweets: Tweet[] }> {
  const userUrl = `${BASE}/users/by/username/${username}?user.fields=public_metrics,description,created_at`;
  const userData = await apiGet(bearerToken, userUrl);
  if (!(userData as any).data) throw new Error(`User @${username} not found`);
  const user = (userData as any).data;
  await sleep(RATE_DELAY_MS);
  const replyFilter = opts.includeReplies ? "" : " -is:reply";
  const query = `from:${username} -is:retweet${replyFilter}`;
  const tweets = await search(bearerToken, query, {
    maxResults: Math.min(opts.count || 20, 100),
    sortOrder: "recency",
  });
  return { user, tweets };
}

export async function getTweet(bearerToken: string, tweetId: string): Promise<Tweet | null> {
  const url = `${BASE}/tweets/${tweetId}?${FIELDS}`;
  const raw = await apiGet(bearerToken, url);
  if (raw.data && !Array.isArray(raw.data)) {
    const parsed = parseTweets({ ...raw, data: [raw.data] });
    return parsed[0] || null;
  }
  return null;
}

export function sortBy(
  tweets: Tweet[],
  metric: "likes" | "impressions" | "retweets" | "replies" = "likes"
): Tweet[] {
  return [...tweets].sort((a, b) => b.metrics[metric] - a.metrics[metric]);
}

export function filterEngagement(
  tweets: Tweet[],
  opts: { minLikes?: number; minImpressions?: number }
): Tweet[] {
  return tweets.filter((t) => {
    if (opts.minLikes && t.metrics.likes < opts.minLikes) return false;
    if (opts.minImpressions && t.metrics.impressions < opts.minImpressions) return false;
    return true;
  });
}

export function dedupe(tweets: Tweet[]): Tweet[] {
  const seen = new Set<string>();
  return tweets.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}
