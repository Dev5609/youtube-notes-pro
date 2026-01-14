import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

interface TranscriptSegment {
  text: string;
  start: number;
  duration: number;
}

type TranscriptResult = {
  transcript: string;
  segments: TranscriptSegment[];
  lang?: string;
  source: "cache" | "timedtext" | "timedtext_list" | "watch" | "innertube" | "override";
  usedCache: boolean;
};

type ErrorResponse = {
  success: false;
  error: string;
  errorCode?: string;
  debug?: Record<string, unknown>;
};

type SuccessResponse = {
  success: true;
  notes: {
    title: string;
    summary: string;
    keyPoints: string[];
    sections: Array<{ title: string; timestamp: string; content: string }>;
    duration: string;
  };
  debug?: Record<string, unknown>;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

function decodeXmlEntities(input: string): string {
  let s = input
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n/g, " ");

  // Numeric entities
  s = s.replace(/&#(\d+);/g, (_, num) => {
    const code = Number(num);
    return Number.isFinite(code) ? String.fromCharCode(code) : "";
  });

  // Trim + collapse whitespace
  return s.replace(/\s+/g, " ").trim();
}

function parseAttributes(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /(\w+)="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(attrString))) {
    attrs[m[1]] = m[2];
  }
  return attrs;
}

function parseStartSecondsFromUrl(videoUrl: string): number {
  try {
    const u = new URL(videoUrl);
    const t = u.searchParams.get("t") || u.searchParams.get("start");
    if (!t) return 0;

    // supports: 1706, 1706s, 1h2m3s
    if (/^\d+$/.test(t)) return Number(t);
    if (/^\d+s$/.test(t)) return Number(t.slice(0, -1));

    const h = t.match(/(\d+)h/);
    const m = t.match(/(\d+)m/);
    const s = t.match(/(\d+)s/);

    return (h ? Number(h[1]) * 3600 : 0) + (m ? Number(m[1]) * 60 : 0) + (s ? Number(s[1]) : 0);
  } catch {
    return 0;
  }
}

function buildTimestampedTranscript(segments: TranscriptSegment[], groupSize = 12): string {
  const blocks: string[] = [];
  for (let i = 0; i < segments.length; i += groupSize) {
    const group = segments.slice(i, i + groupSize);
    if (!group.length) continue;
    const start = group[0].start;
    const text = group.map((s) => s.text).join(" ").replace(/\s+/g, " ").trim();
    if (!text) continue;
    blocks.push(`[${formatTimestamp(start)}] ${text}`);
  }
  return blocks.join("\n");
}

function splitIntoChunks(text: string, maxChars: number, maxChunks: number): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length && chunks.length < maxChunks) {
    const slice = text.slice(i, i + maxChars);
    chunks.push(slice);
    i += maxChars;
  }
  return chunks;
}

function extractJsonFromText(input: string): string | null {
  const fenced = input.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const firstBrace = input.indexOf("{");
  const lastBrace = input.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) return input.slice(firstBrace, lastBrace + 1);

  return null;
}

function parseJsonLenient<T>(input: string): T {
  const raw = extractJsonFromText(input) ?? input;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Remove trailing commas
    const cleaned = raw.replace(/,\s*([}\]])/g, "$1");
    return JSON.parse(cleaned) as T;
  }
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts?: { retries?: number; baseDelayMs?: number; retryOn?: number[] },
): Promise<Response> {
  const retries = opts?.retries ?? 3;
  const baseDelayMs = opts?.baseDelayMs ?? 600;
  const retryOn = opts?.retryOn ?? [429, 500, 502, 503, 504];

  let last: Response | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, init);
    last = res;

    if (!retryOn.includes(res.status)) return res;

    const delay = baseDelayMs * Math.pow(2, attempt);
    console.log(`Retrying ${url} after status ${res.status} (attempt ${attempt + 1}/${retries + 1}) delay=${delay}ms`);
    await sleep(delay);
  }

  return last!;
}

async function getVideoTitleViaOEmbed(videoId: string): Promise<string> {
  try {
    const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`;
    const res = await fetchWithRetry(url, {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "en-US,en;q=0.9",
      },
    }, { retries: 2, baseDelayMs: 500 });

    if (!res.ok) return "YouTube Video";
    const data = await res.json().catch(() => null);
    return (data?.title as string) || "YouTube Video";
  } catch {
    return "YouTube Video";
  }
}

function computeDurationFromSegments(segments: TranscriptSegment[]): string {
  if (!segments.length) return "Unknown";
  let maxEnd = 0;
  for (const s of segments) {
    const end = (s.start || 0) + (s.duration || 0);
    if (end > maxEnd) maxEnd = end;
  }
  if (!Number.isFinite(maxEnd) || maxEnd <= 0) return "Unknown";
  return formatTimestamp(maxEnd);
}

function getSupabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "X-Client-Info": "SummarIQ-generate-notes" } },
  });
}

async function getCachedTranscript(videoId: string): Promise<TranscriptResult | null> {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return null;

  const { data, error } = await supabaseAdmin
    .from("video_transcripts_cache")
    .select("transcript, segments, lang, source, updated_at")
    .eq("video_id", videoId)
    .maybeSingle();

  if (error || !data?.transcript) return null;

  const segments = Array.isArray(data.segments) ? data.segments : [];

  return {
    transcript: data.transcript,
    segments,
    lang: data.lang ?? undefined,
    source: "cache",
    usedCache: true,
  };
}

async function saveCachedTranscript(args: {
  videoId: string;
  transcript: string;
  segments: TranscriptSegment[];
  lang?: string;
  source: string;
}) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return;

  await supabaseAdmin
    .from("video_transcripts_cache")
    .upsert({
      video_id: args.videoId,
      transcript: args.transcript,
      segments: args.segments,
      lang: args.lang ?? null,
      source: args.source,
    }, { onConflict: "video_id" });
}

function parseTimedTextXml(xml: string): { transcript: string; segments: TranscriptSegment[] } {
  const segments: TranscriptSegment[] = [];
  let full = "";

  const textRe = /<text\b([^>]*)>([\s\S]*?)<\/text>/g;
  let m: RegExpExecArray | null;
  while ((m = textRe.exec(xml))) {
    const attrs = parseAttributes(m[1]);
    const start = Number(attrs.start || 0);
    const dur = Number(attrs.dur || 0);
    const text = decodeXmlEntities(m[2] || "");
    if (!text) continue;
    segments.push({ text, start, duration: dur });
    full += text + " ";
  }

  return { transcript: full.trim(), segments };
}

async function tryTimedTextDirect(videoId: string): Promise<TranscriptResult | null> {
  const bases = ["https://www.youtube.com/api/timedtext", "https://video.google.com/timedtext"];

  const attempts: Array<{ lang: string; kind?: string; fmt?: string; label: string }> = [
    { lang: "en", fmt: "srv3", label: "en_srv3" },
    { lang: "en", kind: "asr", fmt: "srv3", label: "en_asr_srv3" },
    { lang: "en", label: "en" },
    { lang: "en", kind: "asr", label: "en_asr" },
  ];

  for (const base of bases) {
    for (const a of attempts) {
      const url = new URL(base);
      url.searchParams.set("v", videoId);
      url.searchParams.set("lang", a.lang);
      if (a.kind) url.searchParams.set("kind", a.kind);
      if (a.fmt) url.searchParams.set("fmt", a.fmt);

      const res = await fetchWithRetry(url.toString(), {
        headers: {
          "User-Agent": UA,
          "Accept-Language": "en-US,en;q=0.9",
          Cookie: "CONSENT=YES+1; SOCS=CAI",
        },
      }, { retries: 2, baseDelayMs: 700 });

      const text = await res.text();
      if (!res.ok || text.length < 20) continue;

      const parsed = parseTimedTextXml(text);
      if (parsed.segments.length > 10 && parsed.transcript.length > 200) {
        console.log("Timedtext direct transcript ok:", { base, attempt: a.label, segments: parsed.segments.length });
        return {
          transcript: parsed.transcript,
          segments: parsed.segments,
          lang: a.lang,
          source: "timedtext",
          usedCache: false,
        };
      }
    }
  }

  return null;
}

async function listCaptionTracks(videoId: string): Promise<Array<{ lang: string; name?: string; kind?: string }>> {
  const listUrls = [
    `https://www.youtube.com/api/timedtext?type=list&v=${videoId}`,
    `https://video.google.com/timedtext?type=list&v=${videoId}`,
  ];

  for (const url of listUrls) {
    const res = await fetchWithRetry(url, {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "en-US,en;q=0.9",
        Cookie: "CONSENT=YES+1; SOCS=CAI",
      },
    }, { retries: 2, baseDelayMs: 700 });

    const xml = await res.text();
    if (!res.ok || xml.length < 20) continue;

    const tracks: Array<{ lang: string; name?: string; kind?: string }> = [];
    const trackRe = /<track\b([^/>]*)\/>/g;
    let m: RegExpExecArray | null;
    while ((m = trackRe.exec(xml))) {
      const attrs = parseAttributes(m[1]);
      const lang = attrs.lang_code || attrs.lang || "";
      if (!lang) continue;
      const name = attrs.name ? decodeXmlEntities(attrs.name) : undefined;
      const kind = attrs.kind || undefined;
      tracks.push({ lang, name, kind });
    }

    if (tracks.length) return tracks;
  }

  return [];
}

async function tryTimedTextFromList(videoId: string): Promise<TranscriptResult | null> {
  const tracks = await listCaptionTracks(videoId);
  if (!tracks.length) return null;

  // Prefer English, otherwise first
  const preferred = tracks.find((t) => t.lang.toLowerCase().startsWith("en")) || tracks[0];

  const bases = ["https://www.youtube.com/api/timedtext", "https://video.google.com/timedtext"];

  for (const base of bases) {
    const url = new URL(base);
    url.searchParams.set("v", videoId);
    url.searchParams.set("lang", preferred.lang);
    if (preferred.name) url.searchParams.set("name", preferred.name);

    const res = await fetchWithRetry(url.toString(), {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "en-US,en;q=0.9",
        Cookie: "CONSENT=YES+1; SOCS=CAI",
      },
    }, { retries: 2, baseDelayMs: 700 });

    const xml = await res.text();
    if (!res.ok || xml.length < 20) continue;

    const parsed = parseTimedTextXml(xml);
    if (parsed.segments.length > 10 && parsed.transcript.length > 200) {
      console.log("Timedtext list transcript ok:", { base, lang: preferred.lang, segments: parsed.segments.length });
      return {
        transcript: parsed.transcript,
        segments: parsed.segments,
        lang: preferred.lang,
        source: "timedtext_list",
        usedCache: false,
      };
    }
  }

  return null;
}

// Legacy fallback: watch page parsing + Innertube
function extractBalancedJsonObjectAfterMarker(html: string, marker: string): string | null {
  const idx = html.indexOf(marker);
  if (idx < 0) return null;

  const startBrace = html.indexOf("{", idx);
  if (startBrace < 0) return null;

  let depth = 0;
  let inStr = false;
  let esc = false;

  for (let i = startBrace; i < html.length; i++) {
    const ch = html[i];

    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (ch === "\\") {
        esc = true;
        continue;
      }
      if (ch === '"') {
        inStr = false;
      }
      continue;
    }

    if (ch === '"') {
      inStr = true;
      continue;
    }

    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        return html.slice(startBrace, i + 1);
      }
    }
  }

  return null;
}

function extractQuotedValue(html: string, key: string): string | null {
  const re = new RegExp(`"${key}":"([^"]+)"`);
  const m = html.match(re);
  return m?.[1] ?? null;
}

async function fetchWatchHtml(videoId: string): Promise<string> {
  const urls = [
    `https://www.youtube.com/watch?v=${videoId}&hl=en&gl=US&bpctr=9999999999&has_verified=1`,
    `https://www.youtube.com/watch?v=${videoId}&hl=en&gl=US`,
    `https://www.youtube.com/watch?v=${videoId}`,
  ];

  let lastStatus = 0;
  for (const url of urls) {
    const res = await fetchWithRetry(url, {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "en-US,en;q=0.9",
        Cookie: "CONSENT=YES+1; SOCS=CAI",
      },
    }, { retries: 2, baseDelayMs: 900, retryOn: [429, 503] });

    lastStatus = res.status;
    const html = await res.text();

    if (res.ok && (html.includes("ytInitialPlayerResponse") || html.includes("INNERTUBE_API_KEY"))) {
      return html;
    }
  }

  throw new Error(`Failed to fetch usable watch page (last status ${lastStatus})`);
}

async function fetchPlayerViaInnertube(args: {
  videoId: string;
  apiKey: string;
  clientVersion: string;
  context?: unknown;
}): Promise<any> {
  const { videoId, apiKey, clientVersion, context } = args;

  const body: any = {
    videoId,
    context: context ?? {
      client: {
        clientName: "WEB",
        clientVersion,
        hl: "en",
        gl: "US",
      },
    },
  };

  const res = await fetchWithRetry(`https://www.youtube.com/youtubei/v1/player?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": UA,
      "Accept-Language": "en-US,en;q=0.9",
      Origin: "https://www.youtube.com",
      Referer: "https://www.youtube.com/",
      "X-Youtube-Client-Name": "1",
      "X-Youtube-Client-Version": clientVersion,
      Cookie: "CONSENT=YES+1; SOCS=CAI",
    },
    body: JSON.stringify(body),
  }, { retries: 2, baseDelayMs: 900, retryOn: [429, 503] });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    console.error("Innertube player error:", res.status, t.slice(0, 500));
    throw new Error(`Innertube player request failed (${res.status})`);
  }

  return await res.json();
}

async function tryTranscriptFromWatchOrInnertube(videoId: string): Promise<TranscriptResult | null> {
  const html = await fetchWatchHtml(videoId);

  let playerResponse: any | null = null;

  const playerJson = extractBalancedJsonObjectAfterMarker(html, "ytInitialPlayerResponse");
  if (playerJson) {
    try {
      playerResponse = JSON.parse(playerJson);
    } catch (e) {
      console.error("Failed to parse ytInitialPlayerResponse JSON:", e);
    }
  }

  const embeddedTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks as any[] | undefined;

  if (!embeddedTracks?.length) {
    const apiKey = extractQuotedValue(html, "INNERTUBE_API_KEY");
    const clientVersion = extractQuotedValue(html, "INNERTUBE_CLIENT_VERSION") ?? "2.20240101.00.00";

    if (apiKey) {
      let context: unknown = undefined;
      const ctxJson = extractBalancedJsonObjectAfterMarker(html, "\"INNERTUBE_CONTEXT\"");
      if (ctxJson) {
        try {
          context = JSON.parse(ctxJson);
        } catch (e) {
          console.error("Failed to parse INNERTUBE_CONTEXT:", e);
        }
      }

      console.log("Watch page missing tracks; trying Innertube...", { clientVersion });
      playerResponse = await fetchPlayerViaInnertube({ videoId, apiKey, clientVersion, context });
    }
  }

  const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks as any[] | undefined;
  if (!captionTracks?.length) return null;

  const englishTrack = captionTracks.find((t) => t.languageCode?.toLowerCase().startsWith("en"));
  const selectedTrack = englishTrack || captionTracks[0];
  if (!selectedTrack?.baseUrl) return null;

  const transcriptResponse = await fetchWithRetry(selectedTrack.baseUrl, {
    headers: {
      "User-Agent": UA,
      "Accept-Language": "en-US,en;q=0.9",
      Cookie: "CONSENT=YES+1; SOCS=CAI",
    },
  }, { retries: 2, baseDelayMs: 900, retryOn: [429, 503] });

  if (!transcriptResponse.ok) return null;
  const xml = await transcriptResponse.text();
  if (xml.length < 20) return null;

  const parsed = parseTimedTextXml(xml);
  if (parsed.segments.length > 10 && parsed.transcript.length > 200) {
    return {
      transcript: parsed.transcript,
      segments: parsed.segments,
      lang: selectedTrack.languageCode,
      source: captionTracks === embeddedTracks ? "watch" : "innertube",
      usedCache: false,
    };
  }

  return null;
}

async function fetchTranscriptBestEffort(args: {
  videoId: string;
  transcriptOverride?: string;
}): Promise<{ result: TranscriptResult | null; debug: Record<string, unknown> }> {
  const { videoId, transcriptOverride } = args;

  const debug: Record<string, unknown> = { videoId };

  if (transcriptOverride && transcriptOverride.trim().length >= 200) {
    const cleaned = transcriptOverride.replace(/\s+/g, " ").trim();
    return {
      result: {
        transcript: cleaned,
        segments: [],
        source: "override",
        usedCache: false,
      },
      debug: { ...debug, mode: "override", transcriptChars: cleaned.length },
    };
  }

  const cached = await getCachedTranscript(videoId);
  if (cached) {
    return {
      result: cached,
      debug: {
        ...debug,
        mode: "cache",
        transcriptChars: cached.transcript.length,
        segments: cached.segments.length,
      },
    };
  }

  const timedtextDirect = await tryTimedTextDirect(videoId);
  if (timedtextDirect) {
    await saveCachedTranscript({
      videoId,
      transcript: timedtextDirect.transcript,
      segments: timedtextDirect.segments,
      lang: timedtextDirect.lang,
      source: timedtextDirect.source,
    });

    return {
      result: timedtextDirect,
      debug: {
        ...debug,
        mode: timedtextDirect.source,
        transcriptChars: timedtextDirect.transcript.length,
        segments: timedtextDirect.segments.length,
      },
    };
  }

  const timedtextList = await tryTimedTextFromList(videoId);
  if (timedtextList) {
    await saveCachedTranscript({
      videoId,
      transcript: timedtextList.transcript,
      segments: timedtextList.segments,
      lang: timedtextList.lang,
      source: timedtextList.source,
    });

    return {
      result: timedtextList,
      debug: {
        ...debug,
        mode: timedtextList.source,
        transcriptChars: timedtextList.transcript.length,
        segments: timedtextList.segments.length,
      },
    };
  }

  // Last resort fallback (can be rate-limited by YouTube)
  try {
    const legacy = await tryTranscriptFromWatchOrInnertube(videoId);
    if (legacy) {
      await saveCachedTranscript({
        videoId,
        transcript: legacy.transcript,
        segments: legacy.segments,
        lang: legacy.lang,
        source: legacy.source,
      });

      return {
        result: legacy,
        debug: {
          ...debug,
          mode: legacy.source,
          transcriptChars: legacy.transcript.length,
          segments: legacy.segments.length,
        },
      };
    }
  } catch (e) {
    debug.watchFallbackError = e instanceof Error ? e.message : String(e);
  }

  return { result: null, debug: { ...debug, mode: "none" } };
}

async function callAiNotes(args: {
  lovableApiKey: string;
  system: string;
  user: string;
  maxCompletionTokens: number;
}): Promise<{
  title: string;
  summary: string;
  keyPoints: string[];
  sections: Array<{ title: string; timestamp: string; content: string }>;
}> {
  const { lovableApiKey, system, user, maxCompletionTokens } = args;

  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["title", "summary", "keyPoints", "sections"],
    properties: {
      title: { type: "string" },
      summary: { type: "string" },
      keyPoints: { type: "array", items: { type: "string" } },
      sections: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "timestamp", "content"],
          properties: {
            title: { type: "string" },
            timestamp: { type: "string" },
            content: { type: "string" },
          },
        },
      },
    },
  } as const;

  const body: any = {
    model: "google/gemini-3-flash-preview",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    max_completion_tokens: maxCompletionTokens,
    tools: [
      {
        type: "function",
        function: {
          name: "create_notes",
          description: "Create structured notes from a transcript.",
          parameters: schema,
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "create_notes" } },
  };

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    console.error("AI gateway error:", res.status, errorText);

    if (res.status === 429) throw Object.assign(new Error("Rate limit exceeded. Please try again in a moment."), { code: "RATE_LIMIT" });
    if (res.status === 402) throw Object.assign(new Error("Usage limit reached. Please add credits to continue."), { code: "PAYMENT_REQUIRED" });

    throw new Error("Failed to generate notes. Please try again.");
  }

  const data = await res.json();
  const msg = data?.choices?.[0]?.message;

  // Tool-call path
  const toolArgs = msg?.tool_calls?.[0]?.function?.arguments;
  if (typeof toolArgs === "string" && toolArgs.trim()) {
    return parseJsonLenient(toolArgs);
  }

  // Fallback: parse content if tool calls were not returned
  const content = msg?.content;
  if (typeof content === "string" && content.trim()) {
    return parseJsonLenient(content);
  }

  console.error("Empty AI response:", JSON.stringify(data).slice(0, 800));
  throw new Error("AI returned an empty response.");
}

async function callAiChunkSummary(args: {
  lovableApiKey: string;
  chunk: string;
  maxCompletionTokens: number;
}): Promise<{ chunkSummary: string; chunkKeyPoints: string[] }> {
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["chunkSummary", "chunkKeyPoints"],
    properties: {
      chunkSummary: { type: "string" },
      chunkKeyPoints: { type: "array", items: { type: "string" } },
    },
  } as const;

  const body: any = {
    model: "google/gemini-2.5-flash-lite",
    messages: [
      {
        role: "system",
        content:
          "Summarize this transcript chunk faithfully. Only use what is present. Keep it dense and factual. Do not add anything not in the chunk.",
      },
      { role: "user", content: args.chunk },
    ],
    max_completion_tokens: args.maxCompletionTokens,
    tools: [
      {
        type: "function",
        function: {
          name: "chunk_notes",
          description: "Return a dense summary and key points for a transcript chunk.",
          parameters: schema,
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "chunk_notes" } },
  };

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.lovableApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    console.error("AI gateway error (chunk):", res.status, errorText);

    if (res.status === 429) throw Object.assign(new Error("Rate limit exceeded. Please try again in a moment."), { code: "RATE_LIMIT" });
    if (res.status === 402) throw Object.assign(new Error("Usage limit reached. Please add credits to continue."), { code: "PAYMENT_REQUIRED" });

    throw new Error("Failed to summarize transcript. Please try again.");
  }

  const data = await res.json();
  const msg = data?.choices?.[0]?.message;
  const toolArgs = msg?.tool_calls?.[0]?.function?.arguments;
  if (typeof toolArgs === "string" && toolArgs.trim()) return parseJsonLenient(toolArgs);

  const content = msg?.content;
  if (typeof content === "string" && content.trim()) return parseJsonLenient(content);

  throw new Error("AI returned an empty response.");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const videoUrl = body?.videoUrl as string | undefined;
    const videoType = (body?.videoType as string | undefined) || "General";
    const transcriptOverride = body?.transcriptOverride as string | undefined;

    if (!videoUrl) {
      const payload: ErrorResponse = { success: false, error: "Video URL is required", errorCode: "BAD_REQUEST" };
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      const payload: ErrorResponse = { success: false, error: "AI service not configured", errorCode: "AI_NOT_CONFIGURED" };
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const videoIdMatch = videoUrl.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    );
    const videoId = videoIdMatch ? videoIdMatch[1] : null;

    if (!videoId) {
      const payload: ErrorResponse = { success: false, error: "Invalid YouTube URL", errorCode: "INVALID_URL" };
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const startSeconds = parseStartSecondsFromUrl(videoUrl);
    console.log("Processing video:", { videoId, videoType, startSeconds, hasOverride: !!transcriptOverride });

    const videoTitle = await getVideoTitleViaOEmbed(videoId);

    const { result: transcriptResult, debug: transcriptDebug } = await fetchTranscriptBestEffort({
      videoId,
      transcriptOverride,
    });

    if (!transcriptResult) {
      const payload: ErrorResponse = {
        success: false,
        error:
          "Could not fetch captions/transcript for this video (YouTube may be rate-limiting or captions are disabled). Paste a transcript to continue.",
        errorCode: "NO_TRANSCRIPT",
        debug: transcriptDebug,
      };
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let segments = transcriptResult.segments;
    let transcript = transcriptResult.transcript;

    // Apply timestamp offset if URL includes t=... (only if we have real timestamps)
    if (startSeconds > 0 && segments.length) {
      const filtered = segments.filter((s) => s.start >= startSeconds);
      if (filtered.length) {
        segments = filtered;
        transcript = filtered.map((s) => s.text).join(" ");
      }
    }

    const hasTimestamps = segments.length > 10;
    const duration = hasTimestamps ? computeDurationFromSegments(segments) : "Unknown";

    const timestampedTranscript = hasTimestamps
      ? buildTimestampedTranscript(segments, 12)
      : transcript;

    const typePrompts: Record<string, string> = {
      "Academic Lecture":
        "You are an expert academic note-taker. Produce university-grade notes with precise definitions, clear structure, and high fidelity to the transcript.",
      Tutorial:
        "You are an expert technical writer. Produce step-by-step tutorial notes with prerequisites, steps, pitfalls, and best practices strictly from the transcript.",
      Motivational:
        "You are an inspirational content summarizer. Produce actionable notes, key themes, and meaningful quotes strictly from the transcript.",
      "Review Session":
        "You are an exam prep specialist. Produce revision-focused notes, formulas/definitions, practice prompts, and common mistakes strictly from the transcript.",
      "Q&A Format":
        "You are a Q&A summarizer. Extract questions and answers, key insights, and unresolved questions strictly from the transcript.",
      General:
        "You are a comprehensive note-taker. Produce well-organized notes strictly from the transcript.",
    };

    const systemPrompt = `${typePrompts[videoType] || typePrompts.General}\n\nOUTPUT REQUIREMENTS:\n- Only use information present in the provided transcript.\n- Do NOT invent details. If something is not in the transcript, omit it.\n- If timestamps are not available in the input, set section.timestamp to an empty string ("").\n- Use clear headings and tight, information-dense language.`;

    const DIRECT_MAX_CHARS = 24000;
    const CHUNK_CHARS = 18000;
    const MAX_CHUNKS = 6;

    let synthesisInput = "";

    if (timestampedTranscript.length <= DIRECT_MAX_CHARS) {
      synthesisInput = `VIDEO: ${videoTitle}\nTYPE: ${videoType}\nDURATION: ${duration}\nSTART_OFFSET: ${startSeconds ? formatTimestamp(startSeconds) : "0:00"}\n\nTRANSCRIPT${hasTimestamps ? " (timestamped)" : ""}:\n${timestampedTranscript}`;
    } else {
      const chunks = splitIntoChunks(timestampedTranscript, CHUNK_CHARS, MAX_CHUNKS);
      console.log("Transcript long; summarizing chunks:", { chunks: chunks.length });

      const chunkSummaries: Array<{ chunkSummary: string; chunkKeyPoints: string[] }> = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunkNotes = await callAiChunkSummary({
          lovableApiKey: LOVABLE_API_KEY,
          chunk: `CHUNK ${i + 1}/${chunks.length}:\n${chunks[i]}`,
          maxCompletionTokens: 900,
        });
        chunkSummaries.push(chunkNotes);
      }

      const combined = chunkSummaries
        .map(
          (c, i) =>
            `CHUNK ${i + 1}:\nSUMMARY: ${c.chunkSummary}\nKEY POINTS:\n- ${c.chunkKeyPoints.join("\n- ")}`,
        )
        .join("\n\n---\n\n");

      synthesisInput = `VIDEO: ${videoTitle}\nTYPE: ${videoType}\nDURATION: ${duration}\nSTART_OFFSET: ${startSeconds ? formatTimestamp(startSeconds) : "0:00"}\n\nYou will generate final notes ONLY from these chunk summaries (derived from the transcript).\n\nCHUNK SUMMARIES:\n${combined}`;
    }

    console.log("Sending synthesis request to AI...", {
      transcriptSource: transcriptResult.source,
      usedCache: transcriptResult.usedCache,
      hasTimestamps,
      transcriptChars: transcript.length,
      segments: segments.length,
    });

    const notes = await callAiNotes({
      lovableApiKey: LOVABLE_API_KEY,
      system: systemPrompt,
      user: `${synthesisInput}\n\nCreate comprehensive notes.`,
      maxCompletionTokens: 4000,
    });

    // Basic validation
    if (!notes?.title || !notes?.summary || !Array.isArray(notes?.keyPoints) || !Array.isArray(notes?.sections)) {
      console.error("Invalid notes structure:", JSON.stringify(notes).slice(0, 800));
      const payload: ErrorResponse = { success: false, error: "Failed to parse notes. Please try again.", errorCode: "PARSE_ERROR" };
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: SuccessResponse = {
      success: true,
      notes: {
        title: notes.title,
        summary: notes.summary,
        keyPoints: notes.keyPoints,
        sections: notes.sections,
        duration,
      },
      debug: {
        ...transcriptDebug,
        transcriptSource: transcriptResult.source,
        usedCache: transcriptResult.usedCache,
        transcriptChars: transcript.length,
        segments: segments.length,
        hasTimestamps,
      },
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Unhandled error:", error);
    const code = (error as any)?.code as string | undefined;

    const payload: ErrorResponse = {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      errorCode: code,
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
