import type { ThemeConfig } from '../types';

/**
 * HoverSystem manages element highlighting and selection
 */
export class HoverSystem {
  private overlay: HTMLDivElement | null = null;
  private currentElement: HTMLElement | null = null;
  private isActive = false;
  private theme: Required<ThemeConfig>;
  private onElementSelect: ((element: HTMLElement) => void) | null = null;

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
   * Create the overlay element
   */
  private createOverlay(): void {
    if (this.overlay) return;

    this.overlay = document.createElement('div');
    this.overlay.id = 'prompt-to-style-overlay';
    this.overlay.style.cssText = `
      position: absolute;
      pointer-events: none;
      border: 2px solid ${this.theme.primaryColor};
      background: ${this.theme.hoverOverlayColor};
      z-index: ${this.theme.zIndex};
      transition: all 0.15s ease;
      box-sizing: border-box;
    `;

    document.body.appendChild(this.overlay);
  }

  /**
   * Update overlay position to match element
   */
  private updateOverlayPosition(element: HTMLElement): void {
    if (!this.overlay) return;

    const rect = element.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    this.overlay.style.top = `${rect.top + scrollY}px`;
    this.overlay.style.left = `${rect.left + scrollX}px`;
    this.overlay.style.width = `${rect.width}px`;
    this.overlay.style.height = `${rect.height}px`;
  }

  /**
   * Handle mouse move event
   */
  private handleMouseMove = (event: MouseEvent): void => {
    if (!this.isActive) return;

    const target = event.target as HTMLElement;

    // Ignore our own overlay and prompt UI
    if (
      target.id === 'prompt-to-style-overlay' ||
      target.closest('#prompt-to-style-prompt-ui')
    ) {
      return;
    }

    if (target !== this.currentElement) {
      this.currentElement = target;
      this.updateOverlayPosition(target);
    }
  };

  /**
   * Handle click event
   */
  private handleClick = (event: MouseEvent): void => {
    if (!this.isActive) return;

    event.preventDefault();
    event.stopPropagation();

    const target = event.target as HTMLElement;

    // Ignore our own overlay and prompt UI
    if (
      target.id === 'prompt-to-style-overlay' ||
      target.closest('#prompt-to-style-prompt-ui')
    ) {
      return;
    }

    if (this.onElementSelect) {
      this.onElementSelect(target);
    }
  };

  /**
   * Set the element select callback
   */
  public setOnElementSelect(callback: (element: HTMLElement) => void): void {
    this.onElementSelect = callback;
  }

  /**
   * Enable hover system
   */
  public enable(): void {
    if (this.isActive) return;

    this.isActive = true;
    this.createOverlay();

    document.addEventListener('mousemove', this.handleMouseMove, true);
    document.addEventListener('click', this.handleClick, true);

    // Add cursor style
    document.body.style.cursor = 'crosshair';
  }

  /**
   * Disable hover system
   */
  public disable(): void {
    if (!this.isActive) return;

    this.isActive = false;

    document.removeEventListener('mousemove', this.handleMouseMove, true);
    document.removeEventListener('click', this.handleClick, true);

    // Remove overlay
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }

    // Reset cursor
    document.body.style.cursor = '';

    this.currentElement = null;
  }

  /**
   * Toggle hover system
   */
  public toggle(): void {
    if (this.isActive) {
      this.disable();
    } else {
      this.enable();
    }
  }

  /**
   * Check if active
   */
  public isSystemActive(): boolean {
    return this.isActive;
  }

  /**
   * Destroy and cleanup
   */
  public destroy(): void {
    this.disable();
    this.onElementSelect = null;
  }
}
