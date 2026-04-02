# prompt-to-style

> Transform your DOM with natural language prompts

A powerful, framework-agnostic TypeScript library that enables visual DOM modification through AI-powered natural language prompts. Perfect for no-code design tools, visual editors, and interactive prototyping.

## Features

- 🎯 **Hover & Select**: Visual element selection with overlay highlighting
- ✨ **AI-Powered**: Bring your own AI provider (OpenAI, Claude, custom)
- 🔄 **Version Control**: Built-in undo/redo and change history
- 💾 **Persistence**: LocalStorage support for cross-session changes
- 🎨 **Themeable**: Fully customizable UI colors and styles
- ⌨️ **Keyboard Shortcuts**: Configurable hotkeys for all actions
- 📝 **Complete Modifications**: Support for CSS, HTML, attributes, and DOM structure
- 🔌 **Framework Agnostic**: Works with React, Vue, Svelte, vanilla JS, or any web framework

## Installation

```bash
npm install prompt-to-style
```

Or install from GitHub:

```bash
npm install github:yourusername/prompt-to-style
```

## Quick Start

```typescript
import { PromptToStyle } from 'prompt-to-style';
import type { AIProvider, ElementContext, GeneratedChanges } from 'prompt-to-style';

// Create your AI provider
const myAIProvider: AIProvider = {
  async generate(prompt: string, context: ElementContext): Promise<GeneratedChanges> {
    // Call your AI service (OpenAI, Claude, etc.)
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${YOUR_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [{
          role: 'user',
          content: `Modify this element: ${prompt}\n\nElement context: ${JSON.stringify(context)}`
        }]
      })
    });

    const data = await response.json();
    
    // Parse AI response into changes
    return {
      type: 'style',
      styles: {
        'background-color': 'blue',
        'color': 'white',
      },
      explanation: data.choices[0].message.content
    };
  }
};

// Initialize PromptToStyle
const pts = new PromptToStyle({
  aiProvider: myAIProvider,
  enabled: true,
  onChange: (change) => {
    console.log('Change applied:', change);
  },
  onCommit: async (changes) => {
    console.log('Committing changes:', changes);
    // Send to your backend to create MR/PR
  }
});

pts.init();
```

## Usage

### Basic Usage

1. **Enable the hover system**: Press `Ctrl+Shift+E` (or call `pts.enable()`)
2. **Hover over elements**: Move your mouse over any element
3. **Click to select**: Click on an element to select it
4. **Enter prompt**: A button appears - hover over it to reveal the prompt input
5. **Submit**: Type your desired change and click "Apply"

### API

#### Constructor

```typescript
new PromptToStyle(config: PromptToStyleConfig)
```

#### Methods

| Method | Description |
|--------|-------------|
| `init()` | Initialize the library |
| `enable()` | Enable hover and selection mode |
| `disable()` | Disable hover and selection mode |
| `toggle()` | Toggle enabled state |
| `isEnabled()` | Check if currently enabled |
| `getChanges()` | Get all changes made in this session |
| `undo()` | Undo the last change |
| `redo()` | Redo the last undone change |
| `clear()` | Clear all changes |
| `commit()` | Commit all changes (triggers onCommit) |
| `loadFromStorage()` | Load changes from localStorage |
| `saveToStorage()` | Save changes to localStorage |
| `exportJSON()` | Export changes as JSON |
| `importJSON(json)` | Import changes from JSON |
| `destroy()` | Destroy instance and cleanup |

### Configuration

```typescript
interface PromptToStyleConfig {
  // Required: Your AI provider
  aiProvider: AIProvider;
  
  // Optional: Enable on init
  enabled?: boolean; // default: false
  
  // Optional: Theme customization
  theme?: {
    primaryColor?: string;       // default: '#3b82f6'
    backgroundColor?: string;     // default: '#ffffff'
    textColor?: string;          // default: '#1f2937'
    borderColor?: string;        // default: '#e5e7eb'
    hoverOverlayColor?: string;  // default: 'rgba(59, 130, 246, 0.1)'
    fontFamily?: string;         // default: 'system-ui, -apple-system, sans-serif'
    borderRadius?: string;       // default: '8px'
    zIndex?: number;             // default: 999999
  };
  
  // Optional: Keyboard shortcuts
  shortcuts?: {
    toggle?: string;      // default: 'ctrl+shift+e'
    openPrompt?: string;  // default: 'ctrl+shift+p'
    undo?: string;        // default: 'ctrl+z'
    redo?: string;        // default: 'ctrl+shift+z'
    commit?: string;      // default: 'ctrl+shift+s'
  };
  
  // Optional: Storage configuration
  storage?: {
    keyPrefix?: string;     // default: 'prompt-to-style'
    enabled?: boolean;      // default: true
    maxVersions?: number;   // default: 50
  };
  
  // Optional: Callbacks
  onChange?: (change: DOMChange) => void;
  onCommit?: (changes: DOMChange[]) => Promise<void>;
}
```

### AI Provider Interface

Your AI provider must implement this interface:

```typescript
interface AIProvider {
  generate(prompt: string, context: ElementContext): Promise<GeneratedChanges>;
}

interface GeneratedChanges {
  type: 'style' | 'class' | 'html' | 'attribute' | 'insert' | 'remove';
  styles?: Record<string, string>;
  classesToAdd?: string[];
  classesToRemove?: string[];
  html?: string;
  attributes?: Record<string, string>;
  attributesToRemove?: string[];
  insertHTML?: string;
  insertPosition?: 'beforebegin' | 'afterbegin' | 'beforeend' | 'afterend';
  cssRules?: string[];
  explanation?: string;
}
```

### Example: OpenAI Provider

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const openAIProvider: AIProvider = {
  async generate(prompt, context) {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{
        role: 'system',
        content: 'You are a UI modification assistant. Return changes as JSON.'
      }, {
        role: 'user',
        content: `
          Modify this element: "${prompt}"
          
          Element: ${context.selector}
          Current styles: ${JSON.stringify(context.computedStyles)}
          
          Return a JSON object with this structure:
          {
            "type": "style" | "class" | "html" | "attribute",
            "styles": { "property": "value" },
            "explanation": "What you changed and why"
          }
        `
      }],
      response_format: { type: 'json_object' }
    });

    return JSON.parse(completion.choices[0].message.content);
  }
};
```

### Example: Anthropic (Claude) Provider

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const claudeProvider: AIProvider = {
  async generate(prompt, context) {
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `
          Modify this element: "${prompt}"
          Element: ${context.selector}
          
          Return JSON with: type, styles, explanation
        `
      }]
    });

    return JSON.parse(message.content[0].text);
  }
};
```

## Advanced Usage

### Theming

```typescript
const pts = new PromptToStyle({
  aiProvider: myProvider,
  theme: {
    primaryColor: '#8b5cf6',
    backgroundColor: '#1f2937',
    textColor: '#f9fafb',
    borderColor: '#374151',
    hoverOverlayColor: 'rgba(139, 92, 246, 0.2)',
    borderRadius: '12px',
  }
});
```

### Custom Shortcuts

```typescript
const pts = new PromptToStyle({
  aiProvider: myProvider,
  shortcuts: {
    toggle: 'ctrl+alt+e',
    undo: 'cmd+z',
    redo: 'cmd+shift+z',
  }
});
```

### Commit Handler (Create MRs/PRs)

```typescript
const pts = new PromptToStyle({
  aiProvider: myProvider,
  onCommit: async (changes) => {
    // Send to your backend
    const response = await fetch('/api/create-mr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        changes: changes.map(c => ({
          prompt: c.prompt,
          selector: c.context.selector,
          modifications: c.changes,
          timestamp: c.timestamp,
        }))
      })
    });

    const { mrUrl } = await response.json();
    console.log('MR created:', mrUrl);
  }
});
```

## TypeScript Support

This library is written in TypeScript and includes full type definitions. All types are exported:

```typescript
import type {
  PromptToStyleConfig,
  AIProvider,
  ElementContext,
  GeneratedChanges,
  DOMChange,
  ElementSnapshot,
  ThemeConfig,
  ShortcutsConfig,
  StorageConfig,
} from 'prompt-to-style';
```

## Browser Support

- Chrome/Edge: ✅ Latest 2 versions
- Firefox: ✅ Latest 2 versions
- Safari: ✅ 14+
- Mobile: ⚠️ Limited (hover interactions require adaptation)

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.

## Roadmap

- [ ] Mobile touch support
- [ ] React/Vue/Svelte hooks
- [ ] Visual diff preview before applying
- [ ] Collaborative editing
- [ ] Plugin system for custom behaviors
- [ ] Built-in AI providers (OpenAI, Anthropic)
- [ ] Chrome extension wrapper

## Credits

Created for [short-team](https://github.com/yourusername/short-team)
