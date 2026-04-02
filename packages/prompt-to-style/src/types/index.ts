/**
 * Configuration options for PromptToStyle
 */
export interface PromptToStyleConfig {
  /**
   * Enable or disable the hover system
   * @default false
   */
  enabled?: boolean;

  /**
   * AI provider function that generates changes based on prompt
   */
  aiProvider: AIProvider;

  /**
   * Theme configuration for UI elements
   */
  theme?: ThemeConfig;

  /**
   * Keyboard shortcuts configuration
   */
  shortcuts?: ShortcutsConfig;

  /**
   * Storage configuration
   */
  storage?: StorageConfig;

  /**
   * Callback fired when a change is made
   */
  onChange?: (change: DOMChange) => void;

  /**
   * Callback fired when changes are ready to be committed
   */
  onCommit?: (changes: DOMChange[]) => Promise<void>;
}

/**
 * AI Provider interface - implement this to connect your AI service
 */
export interface AIProvider {
  /**
   * Generate DOM modifications based on a prompt
   * @param prompt - The user's natural language prompt
   * @param context - Context about the target element
   * @returns Promise resolving to the changes to apply
   */
  generate(prompt: string, context: ElementContext): Promise<GeneratedChanges>;
}

/**
 * Context information about the selected element
 */
export interface ElementContext {
  /**
   * The target DOM element
   */
  element: HTMLElement;

  /**
   * CSS selector path to the element
   */
  selector: string;

  /**
   * Current computed styles
   */
  computedStyles: Record<string, string>;

  /**
   * Current inline styles
   */
  inlineStyles: string;

  /**
   * Element's HTML content
   */
  innerHTML: string;

  /**
   * Element's outer HTML
   */
  outerHTML: string;

  /**
   * Element's classes
   */
  classes: string[];

  /**
   * Element's attributes
   */
  attributes: Record<string, string>;
}

/**
 * Generated changes from the AI provider
 */
export interface GeneratedChanges {
  /**
   * Type of modification
   */
  type: 'style' | 'class' | 'html' | 'attribute' | 'insert' | 'remove';

  /**
   * CSS changes to apply
   */
  styles?: Record<string, string>;

  /**
   * Classes to add
   */
  classesToAdd?: string[];

  /**
   * Classes to remove
   */
  classesToRemove?: string[];

  /**
   * New HTML content
   */
  html?: string;

  /**
   * Attributes to set
   */
  attributes?: Record<string, string>;

  /**
   * Attributes to remove
   */
  attributesToRemove?: string[];

  /**
   * HTML to insert (for insert type)
   */
  insertHTML?: string;

  /**
   * Position for insertion
   */
  insertPosition?: 'beforebegin' | 'afterbegin' | 'beforeend' | 'afterend';

  /**
   * Additional CSS rules to inject into a style tag
   */
  cssRules?: string[];

  /**
   * Explanation of what was changed (for metadata)
   */
  explanation?: string;
}

/**
 * A recorded DOM change with metadata
 */
export interface DOMChange {
  /**
   * Unique ID for this change
   */
  id: string;

  /**
   * Timestamp when the change was made
   */
  timestamp: number;

  /**
   * The user's prompt
   */
  prompt: string;

  /**
   * Element context at the time of change
   */
  context: ElementContext;

  /**
   * The generated changes
   */
  changes: GeneratedChanges;

  /**
   * Previous state (for undo)
   */
  previousState: ElementSnapshot;

  /**
   * Version number
   */
  version: number;
}

/**
 * Snapshot of an element's state
 */
export interface ElementSnapshot {
  outerHTML: string;
  computedStyles: Record<string, string>;
  boundingRect: DOMRect;
}

/**
 * Theme configuration
 */
export interface ThemeConfig {
  /**
   * Primary color for UI elements
   * @default '#3b82f6'
   */
  primaryColor?: string;

  /**
   * Background color for prompts/modals
   * @default '#ffffff'
   */
  backgroundColor?: string;

  /**
   * Text color
   * @default '#1f2937'
   */
  textColor?: string;

  /**
   * Border color
   * @default '#e5e7eb'
   */
  borderColor?: string;

  /**
   * Hover overlay color
   * @default 'rgba(59, 130, 246, 0.1)'
   */
  hoverOverlayColor?: string;

  /**
   * Font family
   * @default 'system-ui, -apple-system, sans-serif'
   */
  fontFamily?: string;

  /**
   * Border radius
   * @default '8px'
   */
  borderRadius?: string;

  /**
   * Z-index for overlay elements
   * @default 999999
   */
  zIndex?: number;
}

/**
 * Keyboard shortcuts configuration
 */
export interface ShortcutsConfig {
  /**
   * Toggle enabled/disabled
   * @default 'ctrl+shift+e'
   */
  toggle?: string;

  /**
   * Open prompt for selected element
   * @default 'ctrl+shift+p'
   */
  openPrompt?: string;

  /**
   * Undo last change
   * @default 'ctrl+z'
   */
  undo?: string;

  /**
   * Redo last undone change
   * @default 'ctrl+shift+z'
   */
  redo?: string;

  /**
   * Commit all changes
   * @default 'ctrl+shift+s'
   */
  commit?: string;
}

/**
 * Storage configuration
 */
export interface StorageConfig {
  /**
   * Storage key prefix
   * @default 'prompt-to-style'
   */
  keyPrefix?: string;

  /**
   * Enable localStorage persistence
   * @default true
   */
  enabled?: boolean;

  /**
   * Maximum number of versions to keep in history
   * @default 50
   */
  maxVersions?: number;
}

/**
 * Main PromptToStyle class interface
 */
export interface IPromptToStyle {
  /**
   * Initialize the library
   */
  init(): void;

  /**
   * Enable hover and selection mode
   */
  enable(): void;

  /**
   * Disable hover and selection mode
   */
  disable(): void;

  /**
   * Toggle enabled state
   */
  toggle(): void;

  /**
   * Check if currently enabled
   */
  isEnabled(): boolean;

  /**
   * Get all changes made in this session
   */
  getChanges(): DOMChange[];

  /**
   * Undo the last change
   */
  undo(): void;

  /**
   * Redo the last undone change
   */
  redo(): void;

  /**
   * Clear all changes
   */
  clear(): void;

  /**
   * Commit all changes (triggers onCommit callback)
   */
  commit(): Promise<void>;

  /**
   * Load changes from storage
   */
  loadFromStorage(): void;

  /**
   * Save changes to storage
   */
  saveToStorage(): void;

  /**
   * Destroy the instance and clean up
   */
  destroy(): void;
}
