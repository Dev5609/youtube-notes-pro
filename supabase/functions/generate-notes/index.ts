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

Create comprehensive notes from YouTube video content. Be thorough but concise.`;

    let userPrompt = '';
    
    if (transcript && transcript.length > 50) {
      // Truncate transcript if too long
      const maxTranscriptLength = 15000;
      let processedTranscript = transcript;
      
      if (transcript.length > maxTranscriptLength) {
        processedTranscript = transcript.substring(0, maxTranscriptLength) + '\n[Transcript truncated...]';
      }
      
      userPrompt = `Video: "${videoInfo.title}"
Type: ${videoType}
Duration: ${videoInfo.duration}

TRANSCRIPT:
${processedTranscript}

Create comprehensive notes based on this transcript. Only include information actually in the transcript.`;
    } else {
      userPrompt = `Video: "${videoInfo.title}"
Type: ${videoType}
Duration: ${videoInfo.duration}

No transcript available. Create helpful notes based on the video title and type. Note that these are estimated notes.`;
    }

    console.log('Sending request to AI with transcript length:', transcript.length);

    // Use tool calling for structured output to avoid JSON parsing issues
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
        tools: [
          {
            type: 'function',
            function: {
              name: 'create_notes',
              description: 'Create structured notes from video content',
              parameters: {
                type: 'object',
                properties: {
                  title: { 
                    type: 'string', 
                    description: 'Clear, descriptive title based on video content' 
                  },
                  summary: { 
                    type: 'string', 
                    description: 'Comprehensive 2-3 paragraph summary of the video content' 
                  },
                  keyPoints: { 
                    type: 'array', 
                    items: { type: 'string' },
                    description: 'Array of 5-7 major takeaways with specific details'
                  },
                  sections: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: { type: 'string', description: 'Section title' },
                        timestamp: { type: 'string', description: 'Timestamp like 0:00 or 1:30' },
                        content: { type: 'string', description: 'Detailed content for this section (50-100 words)' }
                      },
                      required: ['title', 'timestamp', 'content']
                    },
                    description: 'Array of 5-8 sections covering the video content'
                  }
                },
                required: ['title', 'summary', 'keyPoints', 'sections'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'create_notes' } }
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
    
    // Extract notes from tool call response
    let notes;
    try {
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall && toolCall.function?.arguments) {
        notes = JSON.parse(toolCall.function.arguments);
      } else {
        // Fallback to content parsing if no tool call
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            notes = JSON.parse(jsonMatch[0]);
          }
        }
      }
      
      if (!notes) {
        throw new Error('No notes data in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError, JSON.stringify(data).substring(0, 500));
      return new Response(
        JSON.stringify({ error: 'Failed to parse notes. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Add metadata
    notes.videoUrl = videoUrl;
    notes.videoType = videoType;
    notes.duration = videoInfo.duration;
    notes.hasTranscript = transcript.length > 50;

    console.log('Notes generated successfully with', notes.sections?.length || 0, 'sections');
    
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
