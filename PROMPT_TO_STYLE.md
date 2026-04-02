# PromptToStyle Integration Guide

This guide explains how to use the `prompt-to-style` library in the `short-app` Next.js application.

## Installation

The library is already installed as a local dependency:

```bash
npm install ../prompt-to-style
```

## Setup

### 1. Add API Key

Add your OpenAI API key to `.env`:

```bash
NEXT_PUBLIC_OPENAI_API_KEY=sk-...
```

### 2. Wrap Your App

In `app/layout.tsx`, wrap your application with the `PromptToStyleProvider`:

```tsx
import { PromptToStyleProvider } from '@/components/PromptToStyleProvider';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <PromptToStyleProvider 
          apiKey={process.env.NEXT_PUBLIC_OPENAI_API_KEY}
          enabled={false} // Start disabled, user toggles manually
        >
          {children}
        </PromptToStyleProvider>
      </body>
    </html>
  );
}
```

### 3. Add Controls (Optional)

Add the control panel to any page where you want quick access:

```tsx
import { PromptToStyleControls } from '@/components/PromptToStyleControls';

export default function Page() {
  return (
    <div>
      <PromptToStyleControls />
      
      {/* Your page content */}
      <h1>Welcome to Short App</h1>
      <p>Try modifying this text!</p>
    </div>
  );
}
```

## Usage

### Basic Workflow

1. **Enable**: Click "Enable" button or press `Ctrl+Shift+E`
2. **Select**: Hover over any element and click to select it
3. **Prompt**: Hover over the ✨ button to reveal the prompt input
4. **Modify**: Enter your desired change (e.g., "make the background blue")
5. **Apply**: Click "Apply" to see the changes instantly

### Example Prompts

- "Make the background gradient from blue to purple"
- "Add a subtle shadow"
- "Change text to bold and larger"
- "Add rounded corners"
- "Make this button look more modern"
- "Change the layout to a 2-column grid"

### Keyboard Shortcuts

- `Ctrl+Shift+E` - Toggle edit mode
- `Ctrl+Z` - Undo last change
- `Ctrl+Shift+Z` - Redo
- `Ctrl+Shift+S` - Commit changes and create MR

### Committing Changes

When you're done making changes:

1. Click "Commit & Create MR" or press `Ctrl+Shift+S`
2. The changes will be sent to `/api/prompt-to-style/commit`
3. A merge request will be created with all modifications

**Note**: The `/api/prompt-to-style/commit` endpoint needs to be implemented by the developer agent.

## API Endpoint (To Be Implemented)

Create `app/api/prompt-to-style/commit/route.ts`:

```tsx
import { NextRequest, NextResponse } from 'next/server';
import type { DOMChange } from 'prompt-to-style';

export async function POST(request: NextRequest) {
  const { changes } = await request.json() as { changes: DOMChange[] };

  // TODO: Implement MR creation logic
  // 1. Generate file changes from DOMChange[]
  // 2. Create branch
  // 3. Commit files
  // 4. Create merge request via GitHub/GitLab API
  
  // For now, just log
  console.log('Received changes:', changes.length);
  
  // Mock response
  return NextResponse.json({
    success: true,
    mrUrl: 'https://github.com/user/repo/pull/123',
    changesCount: changes.length,
  });
}
```

## Development

### Using the Hook

You can programmatically control PromptToStyle using the hook:

```tsx
'use client';

import { usePromptToStyle } from '@/components/PromptToStyleProvider';

export function MyComponent() {
  const pts = usePromptToStyle();

  const handleCustomAction = () => {
    if (pts) {
      pts.enable();
      // ... do something
      const changes = pts.getChanges();
      console.log(changes);
    }
  };

  return <button onClick={handleCustomAction}>Custom Action</button>;
}
```

### Accessing via Console

For debugging, PromptToStyle is available on `window`:

```js
// In browser console
window.promptToStyle.enable();
window.promptToStyle.getChanges();
window.promptToStyle.exportJSON();
```

## Customization

### Custom Theme

Modify the theme in `PromptToStyleProvider.tsx`:

```tsx
theme: {
  primaryColor: '#8b5cf6',      // Purple
  backgroundColor: '#1f2937',    // Dark gray
  textColor: '#f9fafb',          // Light gray
  borderColor: '#374151',        // Medium gray
  hoverOverlayColor: 'rgba(139, 92, 246, 0.2)',
  borderRadius: '12px',
}
```

### Custom AI Provider

Replace the OpenAI provider with your own:

```tsx
import Anthropic from '@anthropic-ai/sdk';

const createClaudeProvider = (apiKey: string): AIProvider => ({
  async generate(prompt, context) {
    const anthropic = new Anthropic({ apiKey });
    
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Modify element: ${prompt}\n\nContext: ${JSON.stringify(context)}\n\nReturn JSON.`
      }]
    });

    return JSON.parse(message.content[0].text);
  }
});
```

## Troubleshooting

### Changes not persisting

- Changes are stored in localStorage
- Clear browser cache to reset
- Use "Clear" button to remove all changes

### API errors

- Check that `NEXT_PUBLIC_OPENAI_API_KEY` is set
- Verify API key has credits
- Check browser console for error messages

### UI not appearing

- Make sure PromptToStyleProvider wraps your app
- Check that API key is provided
- Look for console warnings

## Next Steps

1. Implement `/api/prompt-to-style/commit` endpoint
2. Add Docker + Tunnel setup for the backend
3. Configure GitHub/GitLab API tokens
4. Set up CI/CD for automated MR creation

---

For more information, see the [prompt-to-style README](../prompt-to-style/README.md).
