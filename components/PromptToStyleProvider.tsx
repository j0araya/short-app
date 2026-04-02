'use client';

import { useEffect, useRef } from 'react';
// import { PromptToStyle } from 'prompt-to-style';
// import type { AIProvider, ElementContext, GeneratedChanges } from 'prompt-to-style';
type AIProvider = any;
type ElementContext = any;
type GeneratedChanges = any;

interface PromptToStyleProviderProps {
  enabled?: boolean;
  apiKey?: string;
  children: React.ReactNode;
}

/**
 * OpenAI-powered AI Provider for PromptToStyle
 */
const createOpenAIProvider = (apiKey: string): AIProvider => ({
  async generate(prompt: string, context: ElementContext): Promise<GeneratedChanges> {
    try {
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
Current classes: ${context.classes.join(', ')}
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
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      const changes = JSON.parse(data.choices[0].message.content);

      return changes;
    } catch (error) {
      console.error('AI Provider error:', error);
      
      // Fallback: return a simple style change
      return {
        type: 'style',
        styles: {},
        explanation: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});

/**
 * PromptToStyle Provider Component for Next.js
 * 
 * Usage:
 * ```tsx
 * import { PromptToStyleProvider } from '@/components/PromptToStyleProvider';
 * 
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <PromptToStyleProvider apiKey={process.env.NEXT_PUBLIC_OPENAI_API_KEY}>
 *           {children}
 *         </PromptToStyleProvider>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 */
export function PromptToStyleProvider({
  enabled = false,
  apiKey,
  children,
}: PromptToStyleProviderProps) {
  const ptsRef = useRef<any | null>(null);

  useEffect(() => {
    // TODO: Re-enable when prompt-to-style package is available
    // Only initialize on client side
    if (typeof window === 'undefined') return;

    // Require API key
    if (!apiKey) {
      console.warn('PromptToStyle: No API key provided. Set NEXT_PUBLIC_OPENAI_API_KEY env variable.');
      return;
    }

    // Initialize PromptToStyle
    // const pts = new PromptToStyle({
    //   aiProvider: createOpenAIProvider(apiKey),
    //   enabled,
    //   theme: {
    //     primaryColor: '#3b82f6',
    //     backgroundColor: '#ffffff',
    //     textColor: '#1f2937',
    //     borderColor: '#e5e7eb',
    //     hoverOverlayColor: 'rgba(59, 130, 246, 0.15)',
    //     borderRadius: '8px',
    //   },
    //   onChange: (change) => {
    //     console.log('[PromptToStyle] Change applied:', {
    //       prompt: change.prompt,
    //       selector: change.context.selector,
    //       type: change.changes.type,
    //     });
    //   },
    //   onCommit: async (changes) => {
    //     console.log('[PromptToStyle] Committing changes:', changes.length);

    //     // TODO: Send to your backend to create MR
    //     // This would be implemented by the /developer agent
    //     try {
    //       const response = await fetch('/api/prompt-to-style/commit', {
    //         method: 'POST',
    //         headers: { 'Content-Type': 'application/json' },
    //         body: JSON.stringify({ changes }),
    //       });

    //       if (response.ok) {
    //         const { mrUrl } = await response.json();
    //         console.log('[PromptToStyle] MR created:', mrUrl);
    //         alert(`Changes committed! MR: ${mrUrl}`);
    //       } else {
    //         throw new Error('Failed to create MR');
    //       }
    //     } catch (error) {
    //       console.error('[PromptToStyle] Commit error:', error);
    //       alert('Failed to commit changes. Check console for details.');
    //     }
    //   },
    // });

    // pts.init();
    // ptsRef.current = pts;

    // // Expose to window for debugging
    // if (typeof window !== 'undefined') {
    //   (window as any).promptToStyle = pts;
    // }

    // // Cleanup on unmount
    // return () => {
    //   pts.destroy();
    //   ptsRef.current = null;
    // };
  }, [apiKey, enabled]);

  return <>{children}</>;
}

/**
 * Hook to access PromptToStyle instance
 */
export function usePromptToStyle() {
  return typeof window !== 'undefined' ? (window as any).promptToStyle as PromptToStyle | undefined : undefined;
}
