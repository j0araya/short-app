import type {
  PromptToStyleConfig,
  IPromptToStyle,
  DOMChange,
} from './types';
import { HoverSystem } from './core/hover';
import { PromptUI } from './core/prompt-ui';
import { DOMModifier } from './core/dom-modifier';
import { VersionManager } from './core/version-manager';
import { extractElementContext } from './core/utils';

// Export all types
export type {
  PromptToStyleConfig,
  IPromptToStyle,
  AIProvider,
  ElementContext,
  GeneratedChanges,
  DOMChange,
  ElementSnapshot,
  ThemeConfig,
  ShortcutsConfig,
  StorageConfig,
} from './types';

/**
 * Main PromptToStyle class
 */
export class PromptToStyle implements IPromptToStyle {
  private config: Required<PromptToStyleConfig>;
  private hoverSystem: HoverSystem;
  private promptUI: PromptUI;
  private domModifier: DOMModifier;
  private versionManager: VersionManager;
  private _isEnabled = false;
  private undoStack: DOMChange[] = [];
  private redoStack: DOMChange[] = [];
  private currentElement: HTMLElement | null = null;

  constructor(config: PromptToStyleConfig) {
    this.config = this.normalizeConfig(config);

    // Initialize subsystems
    this.hoverSystem = new HoverSystem(this.config.theme);
    this.promptUI = new PromptUI(this.config.theme);
    this.domModifier = new DOMModifier();
    this.versionManager = new VersionManager(
      this.config.storage.keyPrefix,
      this.config.storage.maxVersions,
      this.config.storage.enabled
    );

    // Setup event handlers
    this.setupEventHandlers();
  }

  /**
   * Normalize config with defaults
   */
  private normalizeConfig(
    config: PromptToStyleConfig
  ): Required<PromptToStyleConfig> {
    return {
      enabled: config.enabled ?? false,
      aiProvider: config.aiProvider,
      theme: {
        primaryColor: config.theme?.primaryColor ?? '#3b82f6',
        backgroundColor: config.theme?.backgroundColor ?? '#ffffff',
        textColor: config.theme?.textColor ?? '#1f2937',
        borderColor: config.theme?.borderColor ?? '#e5e7eb',
        hoverOverlayColor:
          config.theme?.hoverOverlayColor ?? 'rgba(59, 130, 246, 0.1)',
        fontFamily:
          config.theme?.fontFamily ?? 'system-ui, -apple-system, sans-serif',
        borderRadius: config.theme?.borderRadius ?? '8px',
        zIndex: config.theme?.zIndex ?? 999999,
      },
      shortcuts: {
        toggle: config.shortcuts?.toggle ?? 'ctrl+shift+e',
        openPrompt: config.shortcuts?.openPrompt ?? 'ctrl+shift+p',
        undo: config.shortcuts?.undo ?? 'ctrl+z',
        redo: config.shortcuts?.redo ?? 'ctrl+shift+z',
        commit: config.shortcuts?.commit ?? 'ctrl+shift+s',
      },
      storage: {
        keyPrefix: config.storage?.keyPrefix ?? 'prompt-to-style',
        enabled: config.storage?.enabled ?? true,
        maxVersions: config.storage?.maxVersions ?? 50,
      },
      onChange: config.onChange ?? (() => {}),
      onCommit: config.onCommit ?? (async () => {}),
    };
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Element selection handler
    this.hoverSystem.setOnElementSelect((element) => {
      this.currentElement = element;
      this.promptUI.show(element);
    });

    // Prompt submission handler
    this.promptUI.setOnSubmit(async (prompt) => {
      if (!this.currentElement) return;

      try {
        await this.handlePromptSubmit(prompt, this.currentElement);
      } catch (error) {
        console.error('Failed to apply changes:', error);
      }
    });

    // Prompt cancel handler
    this.promptUI.setOnCancel(() => {
      this.currentElement = null;
    });

    // Keyboard shortcuts
    this.setupKeyboardShortcuts();
  }

  /**
   * Setup keyboard shortcuts
   */
  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      const { toggle, undo, redo, commit } = this.config.shortcuts;

      if (toggle && this.matchShortcut(e, toggle)) {
        e.preventDefault();
        this.toggle();
      } else if (undo && this.matchShortcut(e, undo)) {
        e.preventDefault();
        this.undo();
      } else if (redo && this.matchShortcut(e, redo)) {
        e.preventDefault();
        this.redo();
      } else if (commit && this.matchShortcut(e, commit)) {
        e.preventDefault();
        this.commit();
      }
    });
  }

  /**
   * Check if keyboard event matches a shortcut
   */
  private matchShortcut(event: KeyboardEvent, shortcut: string): boolean {
    const parts = shortcut.toLowerCase().split('+');
    const key = parts[parts.length - 1];
    const modifiers = parts.slice(0, -1);

    const eventKey = event.key.toLowerCase();

    if (eventKey !== key) return false;

    const hasCtrl = modifiers.includes('ctrl') ? event.ctrlKey : !event.ctrlKey;
    const hasShift = modifiers.includes('shift')
      ? event.shiftKey
      : !event.shiftKey;
    const hasAlt = modifiers.includes('alt') ? event.altKey : !event.altKey;
    const hasMeta = modifiers.includes('meta') ? event.metaKey : !event.metaKey;

    return hasCtrl && hasShift && hasAlt && hasMeta;
  }

  /**
   * Handle prompt submission
   */
  private async handlePromptSubmit(
    prompt: string,
    element: HTMLElement
  ): Promise<void> {
    // Extract element context
    const context = extractElementContext(element);

    // Capture snapshot before changes
    const previousState = this.domModifier.captureSnapshot(element);

    // Generate changes using AI provider
    const generatedChanges = await this.config.aiProvider.generate(
      prompt,
      context
    );

    // Apply changes to DOM
    this.domModifier.applyChanges(element, generatedChanges);

    // Record change
    const change = this.versionManager.recordChange(
      prompt,
      context,
      generatedChanges,
      previousState
    );

    // Add to undo stack
    this.undoStack.push(change);
    this.redoStack = []; // Clear redo stack

    // Trigger onChange callback
    this.config.onChange(change);
  }

  /**
   * Initialize the library
   */
  public init(): void {
    if (this.config.enabled) {
      this.enable();
    }
  }

  /**
   * Enable hover and selection mode
   */
  public enable(): void {
    if (this._isEnabled) return;

    this._isEnabled = true;
    this.hoverSystem.enable();
  }

  /**
   * Disable hover and selection mode
   */
  public disable(): void {
    if (!this._isEnabled) return;

    this._isEnabled = false;
    this.hoverSystem.disable();
    this.promptUI.hide();
  }

  /**
   * Toggle enabled state
   */
  public toggle(): void {
    if (this._isEnabled) {
      this.disable();
    } else {
      this.enable();
    }
  }

  /**
   * Check if currently enabled
   */
  public isEnabled(): boolean {
    return this._isEnabled;
  }

  /**
   * Get all changes made in this session
   */
  public getChanges(): DOMChange[] {
    return this.versionManager.getAllChanges();
  }

  /**
   * Undo the last change
   */
  public undo(): void {
    const change = this.undoStack.pop();
    if (!change) return;

    // Find the element by selector
    const element = document.querySelector(
      change.context.selector
    ) as HTMLElement;

    if (element) {
      // Restore previous state
      this.domModifier.restoreSnapshot(element, change.previousState);

      // Move to redo stack
      this.redoStack.push(change);
    }
  }

  /**
   * Redo the last undone change
   */
  public redo(): void {
    const change = this.redoStack.pop();
    if (!change) return;

    // Find the element by selector
    const element = document.querySelector(
      change.context.selector
    ) as HTMLElement;

    if (element) {
      // Reapply changes
      this.domModifier.applyChanges(element, change.changes);

      // Move back to undo stack
      this.undoStack.push(change);
    }
  }

  /**
   * Clear all changes
   */
  public clear(): void {
    this.versionManager.clearAll();
    this.undoStack = [];
    this.redoStack = [];
    this.domModifier.clearInjectedRules();
  }

  /**
   * Commit all changes (triggers onCommit callback)
   */
  public async commit(): Promise<void> {
    const changes = this.versionManager.getAllChanges();

    if (changes.length === 0) {
      console.warn('No changes to commit');
      return;
    }

    await this.config.onCommit(changes);
  }

  /**
   * Load changes from storage
   */
  public loadFromStorage(): void {
    this.versionManager.loadFromStorage();
  }

  /**
   * Save changes to storage
   */
  public saveToStorage(): void {
    this.versionManager.saveToStorage();
  }

  /**
   * Export changes as JSON
   */
  public exportJSON(): string {
    return this.versionManager.exportToJSON();
  }

  /**
   * Import changes from JSON
   */
  public importJSON(json: string): void {
    this.versionManager.importFromJSON(json);
  }

  /**
   * Destroy the instance and clean up
   */
  public destroy(): void {
    this.disable();
    this.hoverSystem.destroy();
    this.promptUI.destroy();
    this.domModifier.destroy();
    this.clear();
  }
}
