import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TranscriptSegment {
  text: string;
  start: number;
  duration: number;
}

// Fetch YouTube transcript using the youtube-transcript library approach
async function fetchYouTubeTranscript(videoId: string): Promise<{ transcript: string; segments: TranscriptSegment[] }> {
  console.log('Fetching transcript for video:', videoId);
  
  // First, get the video page to extract caption tracks
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const response = await fetch(videoUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch video page');
  }
  
  const html = await response.text();
  
  // Extract captions data from the page
  const captionsMatch = html.match(/"captions":\s*({[^}]+playerCaptionsTracklistRenderer[^}]+})/);
  if (!captionsMatch) {
    // Try alternative pattern
    const altMatch = html.match(/playerCaptionsTracklistRenderer.*?captionTracks.*?\[(.*?)\]/s);
    if (!altMatch) {
      throw new Error('No captions available for this video');
    }
  }
  
  // Extract caption track URL
  const captionUrlMatch = html.match(/"baseUrl":\s*"(https:\/\/www\.youtube\.com\/api\/timedtext[^"]+)"/);
  if (!captionUrlMatch) {
    throw new Error('Could not find caption URL');
  }
  
  let captionUrl = captionUrlMatch[1].replace(/\\u0026/g, '&');
  
  // Fetch the captions in JSON format
  captionUrl += '&fmt=json3';
  
  console.log('Fetching captions from:', captionUrl.substring(0, 100) + '...');
  
  const captionResponse = await fetch(captionUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }
  });
  
  if (!captionResponse.ok) {
    throw new Error('Failed to fetch captions');
  }
  
  const captionData = await captionResponse.json();
  
  if (!captionData.events) {
    throw new Error('Invalid caption data format');
  }
  
  const segments: TranscriptSegment[] = [];
  let fullTranscript = '';
  
  for (const event of captionData.events) {
    if (event.segs) {
      const text = event.segs.map((seg: { utf8?: string }) => seg.utf8 || '').join('').trim();
      if (text) {
        segments.push({
          text,
          start: event.tStartMs / 1000,
          duration: (event.dDurationMs || 0) / 1000
        });
        fullTranscript += text + ' ';
      }
    }
  }
  
  console.log('Transcript fetched, length:', fullTranscript.length, 'segments:', segments.length);
  
  return { transcript: fullTranscript.trim(), segments };
}

// Fallback: Use supadata API for transcripts
async function fetchTranscriptWithSupadata(videoId: string): Promise<{ transcript: string; segments: TranscriptSegment[] }> {
  console.log('Trying supadata API for video:', videoId);
  
  const response = await fetch(`https://api.supadata.ai/v1/youtube/transcript?video_id=${videoId}&text=true`, {
    headers: {
      'Accept': 'application/json',
    }
  });
  
  if (!response.ok) {
    throw new Error('Supadata API failed');
  }
  
  const data = await response.json();
  
  if (data.transcript) {
    return { 
      transcript: data.transcript, 
      segments: data.segments || [] 
    };
  }
  
  throw new Error('No transcript in response');
}

// Extract video info (title) from YouTube
async function getVideoInfo(videoId: string): Promise<{ title: string; duration: string }> {
  try {
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });
    
    const html = await response.text();
    
    // Extract title
    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    let title = titleMatch ? titleMatch[1].replace(' - YouTube', '').trim() : 'YouTube Video';
    
    // Extract duration from player response
    const durationMatch = html.match(/"lengthSeconds":"(\d+)"/);
    let duration = 'Unknown';
    if (durationMatch) {
      const seconds = parseInt(durationMatch[1]);
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      if (hours > 0) {
        duration = `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      } else {
        duration = `${minutes}:${secs.toString().padStart(2, '0')}`;
      }
    }
    
    return { title, duration };
  } catch (error) {
    console.error('Error getting video info:', error);
    return { title: 'YouTube Video', duration: 'Unknown' };
  }
}

function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoUrl, videoType = 'General' } = await req.json();

    if (!videoUrl) {
      return new Response(
        JSON.stringify({ error: 'Video URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract video ID from URL
    const videoIdMatch = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;

    if (!videoId) {
      return new Response(
        JSON.stringify({ error: 'Invalid YouTube URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing video:', videoId, 'Type:', videoType);

    // Get video info
    const videoInfo = await getVideoInfo(videoId);
    console.log('Video info:', videoInfo);

    // Try to fetch transcript
    let transcript = '';
    let segments: TranscriptSegment[] = [];
    
    try {
      const result = await fetchYouTubeTranscript(videoId);
      transcript = result.transcript;
      segments = result.segments;
    } catch (error) {
      console.log('Primary transcript fetch failed, trying fallback...', error);
      try {
        const result = await fetchTranscriptWithSupadata(videoId);
        transcript = result.transcript;
        segments = result.segments;
      } catch (fallbackError) {
        console.log('All transcript methods failed:', fallbackError);
      }
    }

    if (!transcript || transcript.length < 50) {
      console.log('No transcript available, generating based on video info only');
    }

    // Build context-aware prompt based on video type
    const typePrompts: Record<string, string> = {
      'Academic Lecture': `You are an expert academic note-taker. Create comprehensive lecture notes suitable for university students. Include:
- Key concepts and definitions
- Theories and frameworks discussed
- Examples and case studies
- Important dates, names, and citations
- Potential exam topics
- Questions for further study`,
      'Tutorial': `You are an expert technical writer. Create step-by-step tutorial notes. Include:
- Prerequisites and requirements
- Step-by-step instructions
- Code snippets or commands if applicable
- Common pitfalls and troubleshooting tips
- Best practices
- Resources for further learning`,
      'Motivational': `You are an inspirational content summarizer. Create uplifting and actionable notes. Include:
- Core message and theme
- Key quotes and memorable moments
- Action items and takeaways
- Personal reflection prompts
- Related resources or books mentioned`,
      'Review Session': `You are an exam prep specialist. Create revision-focused notes. Include:
- Main topics covered
- Key formulas, definitions, or concepts
- Practice questions or problems
- Memory aids and mnemonics
- Areas that need more review
- Exam tips mentioned`,
      'Q&A Format': `You are a Q&A summarizer. Create organized Q&A notes. Include:
- List of questions asked
- Detailed answers provided
- Follow-up points discussed
- Unanswered questions for research
- Key insights from the discussion`,
      'General': `You are a comprehensive note-taker. Create well-organized notes covering all important aspects of the video.`
    };

    const typeInstruction = typePrompts[videoType] || typePrompts['General'];

    const systemPrompt = `${typeInstruction}

Your task is to create COMPREHENSIVE, DETAILED notes from YouTube video content. The notes should be:
1. Thorough and educational
2. Well-organized with clear sections
3. Include specific details, examples, and explanations from the video
4. Have timestamps where possible
5. Be suitable for studying and revision

You MUST respond with a valid JSON object in this exact format:
{
  "title": "A clear, descriptive title based on the actual video content",
  "duration": "${videoInfo.duration}",
  "summary": "A comprehensive 3-4 paragraph summary covering the main topics, key arguments, and conclusions of the video. Be specific and detailed.",
  "keyPoints": [
    "First major takeaway with specific details",
    "Second major takeaway with specific details",
    "Third major takeaway with specific details",
    "Fourth major takeaway with specific details",
    "Fifth major takeaway with specific details",
    "Sixth major takeaway with specific details",
    "Seventh major takeaway with specific details"
  ],
  "sections": [
    {
      "title": "Introduction",
      "timestamp": "0:00",
      "content": "Detailed content covering what is discussed in this section..."
    },
    {
      "title": "Section Title Based on Content",
      "timestamp": "X:XX",
      "content": "Detailed content for this section with examples and explanations..."
    }
  ]
}

Create at least 8-10 detailed sections with meaningful timestamps. Each section should have substantial content (at least 100 words). Make the notes educational, practical, and comprehensive.`;

    let userPrompt = '';
    
    if (transcript && transcript.length > 50) {
      // Truncate transcript if too long (keep most relevant parts)
      const maxTranscriptLength = 30000;
      let processedTranscript = transcript;
      
      if (transcript.length > maxTranscriptLength) {
        // Keep beginning and important parts
        processedTranscript = transcript.substring(0, maxTranscriptLength) + '\n\n[Transcript truncated for processing...]';
      }
      
      userPrompt = `Video Title: "${videoInfo.title}"
Video Type: ${videoType}
Video Duration: ${videoInfo.duration}
Video URL: ${videoUrl}

FULL TRANSCRIPT:
${processedTranscript}

Based on this ACTUAL transcript, create comprehensive notes that accurately reflect the video content. Extract specific quotes, examples, and details from the transcript. Do not make up information - only include what is actually discussed in the transcript.`;
    } else {
      userPrompt = `Video Title: "${videoInfo.title}"
Video Type: ${videoType}
Video Duration: ${videoInfo.duration}
Video URL: ${videoUrl}

Note: The transcript could not be automatically extracted. Based on the video title and type, generate comprehensive notes that would be appropriate for this type of content. Make it clear that these are generated notes and encourage the user to verify with the actual video.`;
    }

    console.log('Sending request to AI with transcript length:', transcript.length);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Usage limit reached. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to generate notes. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error('No content in AI response:', data);
      return new Response(
        JSON.stringify({ error: 'Failed to generate notes content' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the JSON from the response
    let notes;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        notes = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError, content);
      return new Response(
        JSON.stringify({ error: 'Failed to parse notes. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Add video URL and enhance notes
    notes.videoUrl = videoUrl;
    notes.videoType = videoType;
    notes.hasTranscript = transcript.length > 50;

    console.log('Notes generated successfully with', notes.sections?.length, 'sections');
    
    return new Response(
      JSON.stringify({ success: true, notes }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating notes:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to generate notes' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
