import type { ThemeConfig } from '../types';

/**
 * PromptUI manages the inline prompt interface
 */
export class PromptUI {
  private container: HTMLDivElement | null = null;
  private triggerButton: HTMLButtonElement | null = null;
  private promptInput: HTMLTextAreaElement | null = null;
  private submitButton: HTMLButtonElement | null = null;
  private cancelButton: HTMLButtonElement | null = null;
  private isVisible = false;
  private isExpanded = false;
  private theme: Required<ThemeConfig>;
  private onSubmit: ((prompt: string) => void) | null = null;
  private onCancel: (() => void) | null = null;
  private currentElement: HTMLElement | null = null;

  constructor(theme: ThemeConfig) {
    this.theme = this.normalizeTheme(theme);
  }

  /**
   * Normalize theme config with defaults
   */
  private normalizeTheme(theme: ThemeConfig): Required<ThemeConfig> {
    return {
      primaryColor: theme.primaryColor ?? '#3b82f6',
      backgroundColor: theme.backgroundColor ?? '#ffffff',
      textColor: theme.textColor ?? '#1f2937',
      borderColor: theme.borderColor ?? '#e5e7eb',
      hoverOverlayColor: theme.hoverOverlayColor ?? 'rgba(59, 130, 246, 0.1)',
      fontFamily: theme.fontFamily ?? 'system-ui, -apple-system, sans-serif',
      borderRadius: theme.borderRadius ?? '8px',
      zIndex: theme.zIndex ?? 999999,
    };
  }

  /**
   * Create the prompt UI elements
   */
  private createUI(): void {
    if (this.container) return;

    // Main container
    this.container = document.createElement('div');
    this.container.id = 'prompt-to-style-prompt-ui';
    this.container.style.cssText = `
      position: absolute;
      z-index: ${this.theme.zIndex + 1};
      font-family: ${this.theme.fontFamily};
    `;

    // Trigger button (always visible when UI is shown)
    this.triggerButton = document.createElement('button');
    this.triggerButton.innerHTML = '✨';
    this.triggerButton.title = 'Modify with AI';
    this.triggerButton.style.cssText = `
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: ${this.theme.primaryColor};
      color: white;
      border: 2px solid white;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      cursor: pointer;
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      padding: 0;
    `;

    // Hover effect on trigger button
    this.triggerButton.addEventListener('mouseenter', () => {
      if (!this.isExpanded) {
        this.expand();
      }
    });

    this.triggerButton.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this.isExpanded) {
        this.expand();
      }
    });

    // Prompt input (hidden initially)
    this.promptInput = document.createElement('textarea');
    this.promptInput.placeholder = 'Describe the change you want...';
    this.promptInput.style.cssText = `
      width: 300px;
      min-height: 80px;
      padding: 12px;
      border: 2px solid ${this.theme.borderColor};
      border-radius: ${this.theme.borderRadius};
      background: ${this.theme.backgroundColor};
      color: ${this.theme.textColor};
      font-family: ${this.theme.fontFamily};
      font-size: 14px;
      resize: vertical;
      margin-left: 12px;
      display: none;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      outline: none;
    `;

    this.promptInput.addEventListener('focus', () => {
      if (this.promptInput) {
        this.promptInput.style.borderColor = this.theme.primaryColor;
      }
    });

    this.promptInput.addEventListener('blur', () => {
      if (this.promptInput) {
        this.promptInput.style.borderColor = this.theme.borderColor;
      }
    });

    // Submit button
    this.submitButton = document.createElement('button');
    this.submitButton.textContent = 'Apply';
    this.submitButton.style.cssText = `
      padding: 8px 16px;
      background: ${this.theme.primaryColor};
      color: white;
      border: none;
      border-radius: ${this.theme.borderRadius};
      cursor: pointer;
      font-family: ${this.theme.fontFamily};
      font-size: 14px;
      font-weight: 500;
      margin-left: 8px;
      display: none;
      transition: opacity 0.2s ease;
    `;

    this.submitButton.addEventListener('mouseenter', () => {
      if (this.submitButton) {
        this.submitButton.style.opacity = '0.9';
      }
    });

    this.submitButton.addEventListener('mouseleave', () => {
      if (this.submitButton) {
        this.submitButton.style.opacity = '1';
      }
    });

    this.submitButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleSubmit();
    });

    // Cancel button
    this.cancelButton = document.createElement('button');
    this.cancelButton.textContent = 'Cancel';
    this.cancelButton.style.cssText = `
      padding: 8px 16px;
      background: transparent;
      color: ${this.theme.textColor};
      border: 1px solid ${this.theme.borderColor};
      border-radius: ${this.theme.borderRadius};
      cursor: pointer;
      font-family: ${this.theme.fontFamily};
      font-size: 14px;
      margin-left: 8px;
      display: none;
      transition: background 0.2s ease;
    `;

    this.cancelButton.addEventListener('mouseenter', () => {
      if (this.cancelButton) {
        this.cancelButton.style.background = this.theme.hoverOverlayColor;
      }
    });

    this.cancelButton.addEventListener('mouseleave', () => {
      if (this.cancelButton) {
        this.cancelButton.style.background = 'transparent';
      }
    });

    this.cancelButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleCancel();
    });

    // Assemble UI
    this.container.appendChild(this.triggerButton);
    this.container.appendChild(this.promptInput);
    this.container.appendChild(this.submitButton);
    this.container.appendChild(this.cancelButton);

    document.body.appendChild(this.container);

    // Handle clicks outside to collapse
    document.addEventListener('click', this.handleOutsideClick);
  }

  /**
   * Handle outside clicks
   */
  private handleOutsideClick = (e: MouseEvent): void => {
    if (this.container && !this.container.contains(e.target as Node)) {
      this.collapse();
    }
  };

  /**
   * Expand to show full prompt interface
   */
  private expand(): void {
    if (this.isExpanded) return;

    this.isExpanded = true;

    if (this.promptInput) {
      this.promptInput.style.display = 'block';
      this.promptInput.focus();
    }

    if (this.submitButton) {
      this.submitButton.style.display = 'inline-block';
    }

    if (this.cancelButton) {
      this.cancelButton.style.display = 'inline-block';
    }

    // Change container layout to flex
    if (this.container) {
      this.container.style.display = 'flex';
      this.container.style.alignItems = 'flex-start';
      this.container.style.gap = '0';
    }
  }

  /**
   * Collapse to show only trigger button
   */
  private collapse(): void {
    if (!this.isExpanded) return;

    this.isExpanded = false;

    if (this.promptInput) {
      this.promptInput.style.display = 'none';
      this.promptInput.value = '';
    }

    if (this.submitButton) {
      this.submitButton.style.display = 'none';
    }

    if (this.cancelButton) {
      this.cancelButton.style.display = 'none';
    }
  }

  /**
   * Handle submit
   */
  private handleSubmit(): void {
    const prompt = this.promptInput?.value.trim();

    if (prompt && this.onSubmit) {
      this.onSubmit(prompt);
      this.hide();
    }
  }

  /**
   * Handle cancel
   */
  private handleCancel(): void {
    if (this.onCancel) {
      this.onCancel();
    }
    this.hide();
  }

  /**
   * Show prompt UI near an element
   */
  public show(element: HTMLElement): void {
    this.currentElement = element;
    this.createUI();

    if (!this.container) return;

    const rect = element.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    // Position below and to the right of the element
    const top = rect.bottom + scrollY + 8;
    const left = rect.left + scrollX;

    this.container.style.top = `${top}px`;
    this.container.style.left = `${left}px`;
    this.container.style.display = 'block';

    this.isVisible = true;
  }

  /**
   * Hide prompt UI
   */
  public hide(): void {
    if (!this.isVisible) return;

    this.collapse();

    if (this.container) {
      this.container.style.display = 'none';
    }

    this.isVisible = false;
    this.currentElement = null;
  }

  /**
   * Set submit callback
   */
  public setOnSubmit(callback: (prompt: string) => void): void {
    this.onSubmit = callback;
  }

  /**
   * Set cancel callback
   */
  public setOnCancel(callback: () => void): void {
    this.onCancel = callback;
  }

  /**
   * Check if visible
   */
  public isUIVisible(): boolean {
    return this.isVisible;
  }

  /**
   * Destroy and cleanup
   */
  public destroy(): void {
    document.removeEventListener('click', this.handleOutsideClick);

    if (this.container) {
      this.container.remove();
      this.container = null;
    }

    this.triggerButton = null;
    this.promptInput = null;
    this.submitButton = null;
    this.cancelButton = null;
    this.onSubmit = null;
    this.onCancel = null;
    this.currentElement = null;
    this.isVisible = false;
    this.isExpanded = false;
  }
}
