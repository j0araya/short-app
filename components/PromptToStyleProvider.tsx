'use client';

import { useEffect, useRef } from 'react';
import { PromptToStyle } from 'prompt-to-style';
import type { AIProvider, ElementContext, GeneratedChanges } from 'prompt-to-style';

interface PromptToStyleProviderProps {
  enabled?: boolean;
  children: React.ReactNode;
}

/**
 * Secure AI Provider that calls our backend instead of OpenAI directly
 * This keeps API keys server-side and prevents client exposure
 */
const createSecureAIProvider = (): AIProvider => ({
  async generate(prompt: string, context: ElementContext): Promise<GeneratedChanges> {
    try {
      const response = await fetch('/api/prompt-to-style/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          context: {
            selector: context.selector,
            classes: context.classes,
            inlineStyles: context.inlineStyles,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.statusText}`);
      }

      const changes = await response.json();
      return changes;
    } catch (error) {
      console.error('AI Provider error:', error);
      
      // Fallback: return a simple error response
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
 * This provider enables live UI editing via natural language prompts.
 * API key is kept server-side for security.
 * 
 * Usage:
 * ```tsx
 * import { PromptToStyleProvider } from '@/components/PromptToStyleProvider';
 * 
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <PromptToStyleProvider enabled={true}>
 *           {children}
 *         </PromptToStyleProvider>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 * 
 * How to use:
 * 1. Press Ctrl+Shift+E (or Cmd+Shift+E on Mac) to activate
 * 2. Hover over any element to see the overlay
 * 3. Click to select, then enter your prompt (e.g., "make it red", "add padding")
 * 4. Review changes and commit when done
 */
export function PromptToStyleProvider({
  enabled = false,
  children,
}: PromptToStyleProviderProps) {
  const ptsRef = useRef<PromptToStyle | null>(null);

  useEffect(() => {
    // Only initialize on client side
    if (typeof window === 'undefined') return;

    // Initialize PromptToStyle with secure backend provider
    const pts = new PromptToStyle({
      aiProvider: createSecureAIProvider(),
      enabled,
      theme: {
        primaryColor: '#3b82f6',
        backgroundColor: '#ffffff',
        textColor: '#1f2937',
        borderColor: '#e5e7eb',
        hoverOverlayColor: 'rgba(59, 130, 246, 0.15)',
        borderRadius: '8px',
      },
      onChange: (change) => {
        console.log('[PromptToStyle] Change applied:', {
          prompt: change.prompt,
          selector: change.context.selector,
          type: change.changes.type,
        });
      },
      onCommit: async (changes) => {
        console.log('[PromptToStyle] Committing changes:', changes.length);

        try {
          const response = await fetch('/api/prompt-to-style/commit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ changes }),
          });

          if (response.ok) {
            const { mrUrl } = await response.json();
            console.log('[PromptToStyle] MR created:', mrUrl);
            alert(`Changes committed! MR: ${mrUrl}`);
          } else {
            throw new Error('Failed to create MR');
          }
        } catch (error) {
          console.error('[PromptToStyle] Commit error:', error);
          alert('Failed to commit changes. Check console for details.');
        }
      },
    });

    pts.init();
    ptsRef.current = pts;

    // Expose to window for debugging
    if (typeof window !== 'undefined') {
      (window as any).promptToStyle = pts;
    }

    console.log('[PromptToStyle] Initialized. Press Ctrl+Shift+E (Cmd+Shift+E on Mac) to activate.');

    // Cleanup on unmount
    return () => {
      pts.destroy();
      ptsRef.current = null;
    };
  }, [enabled]);

  return <>{children}</>;
}

/**
 * Hook to access PromptToStyle instance
 */
export function usePromptToStyle() {
  return typeof window !== 'undefined' ? (window as any).promptToStyle as PromptToStyle | undefined : undefined;
}
