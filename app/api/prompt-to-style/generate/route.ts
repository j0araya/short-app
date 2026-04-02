import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * POST /api/prompt-to-style/generate
 * 
 * Secure backend endpoint for generating UI changes using OpenAI.
 * This keeps the API key server-side and prevents client exposure.
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const { prompt, context } = await request.json();

    if (!prompt || !context) {
      return NextResponse.json(
        { error: 'Missing prompt or context' },
        { status: 400 }
      );
    }

    // Get OpenAI API key from environment
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('[prompt-to-style] OPENAI_API_KEY not configured');
      return NextResponse.json(
        { error: 'OpenAI API not configured' },
        { status: 500 }
      );
    }

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are a UI modification assistant. Given a user prompt and element context, return JSON with changes to apply.

Response format:
{
  "type": "style" | "class" | "html" | "attribute" | "insert" | "remove",
  "styles": { "property": "value" },
  "classesToAdd": ["class1"],
  "classesToRemove": ["class2"],
  "html": "new content",
  "attributes": { "attr": "value" },
  "cssRules": [".custom { color: red; }"],
  "explanation": "What you changed and why"
}

Only return valid JSON. Be concise but precise.`,
          },
          {
            role: 'user',
            content: `Modify this element: "${prompt}"

Element: ${context.selector}
Current classes: ${context.classes?.join(', ') || 'none'}
Current inline styles: ${context.inlineStyles || 'none'}

Return JSON with the changes to apply.`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[prompt-to-style] OpenAI API error:', response.status, errorText);
      return NextResponse.json(
        { error: `OpenAI API error: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const changes = JSON.parse(data.choices[0].message.content);

    console.log('[prompt-to-style] Generated changes:', {
      prompt,
      selector: context.selector,
      type: changes.type,
    });

    return NextResponse.json(changes);

  } catch (error) {
    console.error('[prompt-to-style] Generation error:', error);
    
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        type: 'style',
        styles: {},
        explanation: 'Failed to generate changes due to an error',
      },
      { status: 500 }
    );
  }
}
