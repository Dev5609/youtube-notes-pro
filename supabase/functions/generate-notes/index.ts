import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

  s = s.replace(/&#(\d+);/g, (_, num) => {
    const code = Number(num);
    return Number.isFinite(code) ? String.fromCharCode(code) : "";
  });

  return s.replace(/\s+/g, " ").trim();
}

function parseStartSecondsFromUrl(videoUrl: string): number {
  try {
    const u = new URL(videoUrl);
    const t = u.searchParams.get("t") || u.searchParams.get("start");
    if (!t) return 0;

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

// Fetch transcript from YouTube.
// Strategy:
// 1) Fetch the watch page HTML (with consent-bypass hints) and parse ytInitialPlayerResponse.
// 2) If captions are missing, fall back to YouTube's internal "youtubei/v1/player" (Innertube) using keys embedded in the HTML.

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
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "en-US,en;q=0.9",
        // Often required to avoid getting a cookie-consent interstitial instead of the real watch page
        Cookie: "CONSENT=YES+1; SOCS=CAI",
      },
    });

    lastStatus = res.status;
    const html = await res.text();

    // A usable page should contain at least one of these.
    if (res.ok && (html.includes("ytInitialPlayerResponse") || html.includes("INNERTUBE_API_KEY"))) {
      return html;
    }

    // Sometimes the page still loads but without those fields; try next URL.
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

  const res = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${apiKey}`, {
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
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    console.error("Innertube player error:", res.status, t.slice(0, 500));
    throw new Error(`Innertube player request failed (${res.status})`);
  }

  return await res.json();
}

async function fetchTranscriptFromPage(videoId: string): Promise<{
  transcript: string;
  segments: TranscriptSegment[];
  title: string;
  duration: string;
}> {
  console.log("Fetching watch page for:", videoId);

  const html = await fetchWatchHtml(videoId);

  // Extract title
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  const title = titleMatch ? titleMatch[1].replace(" - YouTube", "").trim() : "YouTube Video";

  // Extract duration
  const durationMatch = html.match(/"lengthSeconds":"(\d+)"/);
  let duration = "Unknown";
  if (durationMatch) {
    const seconds = parseInt(durationMatch[1]);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    duration = hours > 0
      ? `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
      : `${minutes}:${secs.toString().padStart(2, "0")}`;
  }

  console.log("Video info:", { title, duration });

  let playerResponse: any | null = null;

  // Parse ytInitialPlayerResponse from HTML (brace-balanced)
  const playerJson = extractBalancedJsonObjectAfterMarker(html, "ytInitialPlayerResponse");
  if (playerJson) {
    try {
      playerResponse = JSON.parse(playerJson);
    } catch (e) {
      console.error("Failed to parse ytInitialPlayerResponse JSON:", e);
    }
  }

  // If captions are not present in the embedded player response, fall back to Innertube
  const embeddedTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks as any[] | undefined;

  if (!embeddedTracks?.length) {
    const apiKey = extractQuotedValue(html, "INNERTUBE_API_KEY");
    const clientVersion = extractQuotedValue(html, "INNERTUBE_CLIENT_VERSION") ?? "2.20240101.00.00";

    if (apiKey) {
      console.log("Captions missing in HTML player response; trying Innertube...", { clientVersion });

      let context: unknown = undefined;
      const ctxJson = extractBalancedJsonObjectAfterMarker(html, "\"INNERTUBE_CONTEXT\"");
      if (ctxJson) {
        try {
          context = JSON.parse(ctxJson);
        } catch (e) {
          console.error("Failed to parse INNERTUBE_CONTEXT:", e);
        }
      }

      playerResponse = await fetchPlayerViaInnertube({ videoId, apiKey, clientVersion, context });
    } else {
      console.log("INNERTUBE_API_KEY not found; cannot try Innertube fallback");
    }
  }

  const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks as any[] | undefined;

  if (!captionTracks?.length) {
    console.log("No caption tracks found. playabilityStatus:", playerResponse?.playabilityStatus?.status);
    throw new Error("No captions available for this video");
  }

  console.log("Found caption tracks:", captionTracks.length);

  // Prefer English, fallback to first available (include ASR auto-captions if that's all there is)
  const englishTrack = captionTracks.find((t) => t.languageCode?.toLowerCase().startsWith("en"));
  const selectedTrack = englishTrack || captionTracks[0];

  if (!selectedTrack?.baseUrl) {
    throw new Error("No valid caption track URL found");
  }

  console.log("Selected caption track:", {
    lang: selectedTrack.languageCode,
    kind: selectedTrack.kind,
    name: selectedTrack.name?.simpleText,
  });

  const transcriptResponse = await fetch(selectedTrack.baseUrl, {
    headers: {
      "User-Agent": UA,
      "Accept-Language": "en-US,en;q=0.9",
      Cookie: "CONSENT=YES+1; SOCS=CAI",
    },
  });

  if (!transcriptResponse.ok) {
    throw new Error(`Failed to fetch transcript: ${transcriptResponse.status}`);
  }

  const transcriptXml = await transcriptResponse.text();

  const segments: TranscriptSegment[] = [];
  let fullTranscript = "";

  // Common XML format
  const textRe = /<text\s+start="([^"]+)"\s+dur="([^"]+)"[^>]*>([\s\S]*?)<\/text>/g;
  let match: RegExpExecArray | null;

  while ((match = textRe.exec(transcriptXml))) {
    const start = parseFloat(match[1]);
    const dur = parseFloat(match[2]);
    const text = decodeXmlEntities(match[3] ?? "");

    if (text) {
      segments.push({ text, start, duration: dur });
      fullTranscript += text + " ";
    }
  }

  console.log("Transcript parsed:", { segments: segments.length, chars: fullTranscript.length });

  if (!segments.length) {
    throw new Error("Could not parse transcript segments");
  }

  return {
    transcript: fullTranscript.trim(),
    segments,
    title,
    duration,
  };
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
    const cleaned = raw.replace(/,\s*([}\]])/g, "$1");
    return JSON.parse(cleaned) as T;
  }
}

async function callAiJson<T>(args: {
  lovableApiKey: string;
  model: string;
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
  maxCompletionTokens: number;
}): Promise<T> {
  const { lovableApiKey, model, system, user, schemaName, schema, maxCompletionTokens } = args;

  const body = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    max_completion_tokens: maxCompletionTokens,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: schemaName,
        schema,
        strict: true,
      },
    },
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

    if (res.status === 429) throw new Error("Rate limit exceeded. Please try again in a moment.");
    if (res.status === 402) throw new Error("Usage limit reached. Please add credits to continue.");

    throw new Error("Failed to generate notes. Please try again.");
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;

  if (typeof content !== "string" || !content.trim()) {
    console.error("Empty AI response:", JSON.stringify(data).slice(0, 800));
    throw new Error("AI returned an empty response.");
  }

  return parseJsonLenient<T>(content);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoUrl, videoType = "General" } = await req.json();

    if (!videoUrl) {
      return new Response(JSON.stringify({ error: "Video URL is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract video ID from URL
    const videoIdMatch = videoUrl.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    );
    const videoId = videoIdMatch ? videoIdMatch[1] : null;

    if (!videoId) {
      return new Response(JSON.stringify({ error: "Invalid YouTube URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const startSeconds = parseStartSecondsFromUrl(videoUrl);
    console.log("Processing video:", { videoId, videoType, startSeconds });

    // Fetch transcript and video info in one go
    let transcript = "";
    let segments: TranscriptSegment[] = [];
    let videoTitle = "YouTube Video";
    let videoDuration = "Unknown";

    try {
      const result = await fetchTranscriptFromPage(videoId);
      transcript = result.transcript;
      segments = result.segments;
      videoTitle = result.title;
      videoDuration = result.duration;
    } catch (e) {
      console.error("Transcript fetch failed:", e);
      return new Response(
        JSON.stringify({
          error: "Could not fetch captions/transcript for this video. Please try a video with captions enabled.",
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Apply timestamp offset if URL includes t=...
    if (startSeconds > 0 && segments.length) {
      const filtered = segments.filter((s) => s.start >= startSeconds);
      if (filtered.length) {
        segments = filtered;
        transcript = filtered.map((s) => s.text).join(" ");
      }
    }

    const hasTranscript = transcript.trim().length > 200 && segments.length > 10;
    if (!hasTranscript) {
      return new Response(
        JSON.stringify({
          error: "Could not fetch captions/transcript for this video. Please try a video with captions enabled.",
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

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

    const systemPrompt = `${typePrompts[videoType] || typePrompts.General}\n\nOUTPUT REQUIREMENTS:\n- Only use information present in the provided transcript.\n- If unsure, say so briefly in the section content.\n- Use clear headings and tight, information-dense language.\n- Include timestamps in each section based on the transcript (mm:ss or h:mm:ss).`;

    const timestampedTranscript = buildTimestampedTranscript(segments, 12);

    const DIRECT_MAX_CHARS = 22000;
    const CHUNK_CHARS = 18000;
    const MAX_CHUNKS = 6;

    const finalSchema = {
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

    const chunkSchema = {
      type: "object",
      additionalProperties: false,
      required: ["chunkSummary", "chunkKeyPoints"],
      properties: {
        chunkSummary: { type: "string" },
        chunkKeyPoints: { type: "array", items: { type: "string" } },
      },
    } as const;

    console.log("Transcript stats:", {
      chars: timestampedTranscript.length,
      segments: segments.length,
    });

    let synthesisInput = "";

    if (timestampedTranscript.length <= DIRECT_MAX_CHARS) {
      synthesisInput = `VIDEO: ${videoTitle}\nTYPE: ${videoType}\nDURATION: ${videoDuration}\nSTART_OFFSET: ${startSeconds ? formatTimestamp(startSeconds) : "0:00"}\n\nTRANSCRIPT (timestamped):\n${timestampedTranscript}`;
    } else {
      const chunks = splitIntoChunks(timestampedTranscript, CHUNK_CHARS, MAX_CHUNKS);
      console.log("Transcript is long; summarizing chunks:", { chunks: chunks.length });

      const chunkSummaries: Array<{ chunkSummary: string; chunkKeyPoints: string[] }> = [];
      for (let i = 0; i < chunks.length; i++) {
        console.log(`Summarizing chunk ${i + 1}/${chunks.length}...`);
        const chunkNotes = await callAiJson<{ chunkSummary: string; chunkKeyPoints: string[] }>({
          lovableApiKey: LOVABLE_API_KEY,
          model: "openai/gpt-5-nano",
          system:
            "Summarize this transcript chunk faithfully. Only use what is present. Keep it dense and factual.",
          user: `CHUNK ${i + 1}/${chunks.length} (timestamped transcript):\n${chunks[i]}`,
          schemaName: "chunk_notes",
          schema: chunkSchema as unknown as Record<string, unknown>,
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

      synthesisInput = `VIDEO: ${videoTitle}\nTYPE: ${videoType}\nDURATION: ${videoDuration}\nSTART_OFFSET: ${startSeconds ? formatTimestamp(startSeconds) : "0:00"}\n\nYou will generate final notes from these chunk summaries (derived from the transcript).\n\nCHUNK SUMMARIES:\n${combined}`;
    }

    console.log("Sending synthesis request to AI...");
    const notes = await callAiJson<{
      title: string;
      summary: string;
      keyPoints: string[];
      sections: Array<{ title: string; timestamp: string; content: string }>;
    }>({
      lovableApiKey: LOVABLE_API_KEY,
      model: "openai/gpt-5-mini",
      system: systemPrompt,
      user: `${synthesisInput}\n\nCreate comprehensive notes. Ensure JSON matches the schema exactly.`,
      schemaName: "video_notes",
      schema: finalSchema as unknown as Record<string, unknown>,
      maxCompletionTokens: 4000,
    });

    // Basic validation
    if (
      !notes.title ||
      !notes.summary ||
      !Array.isArray(notes.keyPoints) ||
      !Array.isArray(notes.sections)
    ) {
      console.error("Invalid notes structure:", JSON.stringify(notes).slice(0, 500));
      throw new Error("Generated notes have invalid structure");
    }

    console.log("Notes generated successfully:", {
      title: notes.title.slice(0, 50),
      keyPoints: notes.keyPoints.length,
      sections: notes.sections.length,
    });

    return new Response(
      JSON.stringify({
        ...notes,
        videoTitle: videoTitle,
        videoUrl,
        duration: videoDuration,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
