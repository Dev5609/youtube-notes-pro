import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoUrl } = await req.json();

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
    const videoIdMatch = videoUrl.match(/(?:youtube\\.com\\/(?:watch\\?v=|embed\\/|v\\/)|youtu\\.be\\/)([a-zA-Z0-9_-]{11})/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;

    console.log('Generating notes for video:', videoUrl, 'ID:', videoId);

    const systemPrompt = `You are an expert YouTube video analyst and note-taker. Your task is to generate comprehensive, well-structured notes from YouTube video content.
    You will be given a YouTube video URL. Use your knowledge of the video's content to generate detailed notes.
    If you do not have specific knowledge of this video, you should clearly state that you are generating a speculative summary based on the video's title and likely topic.
    However, strive to provide accurate and detailed notes whenever possible.

You MUST respond with a valid JSON object in this exact format:
{
  "title": "A clear, descriptive title for the notes",
  "duration": "Estimated video duration (e.g., '15:30')",
  "summary": "A comprehensive 2-3 paragraph summary of the main content",
  "keyPoints": [
    "First key takeaway or learning point",
    "Second key takeaway or learning point",
    "Third key takeaway or learning point",
    "Fourth key takeaway or learning point",
    "Fifth key takeaway or learning point"
  ],
  "sections": [
    {
      "title": "Section Title",
      "timestamp": "0:00",
      "content": "Detailed content for this section..."
    }
  ]
}

Create at least 5-6 detailed sections with timestamps. Make the content educational, actionable, and comprehensive. Include practical examples and explanations.`;

    const userPrompt = `Generate comprehensive educational notes for this YouTube video: ${videoUrl}. Use your internal knowledge to provide a detailed and accurate summary of the video's content.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
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

    // Add video URL to notes
    notes.videoUrl = videoUrl;

    console.log('Notes generated successfully');
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
