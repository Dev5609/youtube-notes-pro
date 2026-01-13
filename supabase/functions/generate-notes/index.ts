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

async function listCaptionTracks(videoId: string): Promise<Array<{ lang: string; name?: string }>> {
  const listUrls = [
    `https://www.youtube.com/api/timedtext?type=list&v=${videoId}`,
    `https://video.google.com/timedtext?type=list&v=${videoId}`,
  ];

  for (const url of listUrls) {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
    });

    const xml = await res.text();

    // When no tracks exist, YouTube returns an empty body or very small XML.
    if (!res.ok || xml.length < 20) continue;

    const tracks: Array<{ lang: string; name?: string }> = [];
    const trackRe = /<track\b([^/>]*)\/>/g;
    let m: RegExpExecArray | null;
    while ((m = trackRe.exec(xml))) {
      const attrs = parseAttributes(m[1]);
      const lang = attrs.lang_code || attrs.lang || "";
      if (!lang) continue;
      const name = attrs.name ? decodeXmlEntities(attrs.name) : undefined;
      tracks.push({ lang, name });
    }

    if (tracks.length > 0) return tracks;
  }

  return [];
}

async function fetchTranscriptViaTimedText(
  videoId: string,
): Promise<{ transcript: string; segments: TranscriptSegment[]; lang?: string }> {
  console.log("Fetching caption track list for:", videoId);
  const tracks = await listCaptionTracks(videoId);

  if (!tracks.length) {
    throw new Error("No captions available for this video");
  }

  const preferred = tracks.find((t) => t.lang.toLowerCase().startsWith("en")) || tracks[0];

  const baseUrls = [
    "https://www.youtube.com/api/timedtext",
    "https://video.google.com/timedtext",
  ];

  let lastErr: unknown;
  for (const base of baseUrls) {
    const url = new URL(base);
    url.searchParams.set("v", videoId);
    url.searchParams.set("lang", preferred.lang);
    // srv3 returns richer data in many cases, but XML still works fine; keep it simple
    // url.searchParams.set("fmt", "srv3");
    if (preferred.name) url.searchParams.set("name", preferred.name);

    console.log("Fetching transcript from:", url.toString());
    try {
      const res = await fetch(url.toString(), {
        headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
      });
      const xml = await res.text();

      if (!res.ok || xml.length < 20) {
        lastErr = new Error(`Timedtext fetch failed (${res.status})`);
        continue;
      }

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

      if (!segments.length) {
        lastErr = new Error("No transcript segments parsed");
        continue;
      }

      console.log("Transcript fetched:", { lang: preferred.lang, segments: segments.length, length: full.length });
      return { transcript: full.trim(), segments, lang: preferred.lang };
    } catch (e) {
      lastErr = e;
    }
  }

  throw (lastErr instanceof Error ? lastErr : new Error("Failed to fetch transcript"));
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
    // OpenAI-compatible structured output. If the gateway/model ignores it, we still parse leniently.
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

// Extract video info (title + duration) from YouTube HTML.
async function getVideoInfo(videoId: string): Promise<{ title: string; duration: string }> {
  try {
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { "User-Agent": UA },
    });

    const html = await response.text();

    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    const title = titleMatch ? titleMatch[1].replace(" - YouTube", "").trim() : "YouTube Video";

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

    return { title, duration };
  } catch (error) {
    console.error("Error getting video info:", error);
    return { title: "YouTube Video", duration: "Unknown" };
  }
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

    const videoInfo = await getVideoInfo(videoId);
    console.log("Video info:", videoInfo);

    // Transcript
    let transcript = "";
    let segments: TranscriptSegment[] = [];
    let transcriptLang: string | undefined;

    try {
      const t = await fetchTranscriptViaTimedText(videoId);
      transcript = t.transcript;
      segments = t.segments;
      transcriptLang = t.lang;
    } catch (e) {
      console.error("Transcript fetch failed:", e);
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
          error:
            "Could not fetch captions/transcript for this video. Please try a video with captions enabled.",
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

    // If transcript is long, compress it first with chunk summaries, then synthesize final notes.
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
      lang: transcriptLang,
      chars: timestampedTranscript.length,
      segments: segments.length,
    });

    let synthesisInput = "";

    if (timestampedTranscript.length <= DIRECT_MAX_CHARS) {
      synthesisInput = `VIDEO: ${videoInfo.title}\nTYPE: ${videoType}\nDURATION: ${videoInfo.duration}\nSTART_OFFSET: ${startSeconds ? formatTimestamp(startSeconds) : "0:00"}\n\nTRANSCRIPT (timestamped):\n${timestampedTranscript}`;
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

      synthesisInput = `VIDEO: ${videoInfo.title}\nTYPE: ${videoType}\nDURATION: ${videoInfo.duration}\nSTART_OFFSET: ${startSeconds ? formatTimestamp(startSeconds) : "0:00"}\n\nYou will generate final notes from these chunk summaries (derived from the transcript).\n\nCHUNK SUMMARIES:\n${combined}`;
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
      maxCompletionTokens: 2400,
    });

    // Basic validation
    if (!notes?.title || !notes?.summary || !Array.isArray(notes.keyPoints) || !Array.isArray(notes.sections)) {
      console.error("AI notes failed validation:", JSON.stringify(notes).slice(0, 800));
      return new Response(JSON.stringify({ error: "Failed to generate structured notes." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const responseNotes = {
      ...notes,
      videoUrl,
      videoType,
      duration: videoInfo.duration,
      hasTranscript: true,
      transcriptLang: transcriptLang || "unknown",
      startOffsetSeconds: startSeconds,
    };

    console.log("Notes generated successfully:", {
      title: notes.title,
      sections: notes.sections?.length ?? 0,
      keyPoints: notes.keyPoints?.length ?? 0,
    });

    return new Response(JSON.stringify({ success: true, notes: responseNotes }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating notes:", error);
    const message = error instanceof Error ? error.message : "Failed to generate notes";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
