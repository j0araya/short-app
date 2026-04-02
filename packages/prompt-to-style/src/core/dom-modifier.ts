import type { GeneratedChanges, ElementSnapshot } from '../types';

/**
 * DOMModifier applies changes to DOM elements
 */
export class DOMModifier {
  private styleElement: HTMLStyleElement | null = null;
  private injectedRules: Set<string> = new Set();

  /**
   * Create or get the style element for injected CSS
   */
  private getStyleElement(): HTMLStyleElement {
    if (!this.styleElement) {
      this.styleElement = document.createElement('style');
      this.styleElement.id = 'prompt-to-style-injected';
      document.head.appendChild(this.styleElement);
    }
    return this.styleElement;
  }

  /**
   * Capture current state of an element
   */
  public captureSnapshot(element: HTMLElement): ElementSnapshot {
    const computedStyles = window.getComputedStyle(element);
    const styleObject: Record<string, string> = {};

    // Capture all computed styles
    for (let i = 0; i < computedStyles.length; i++) {
      const prop = computedStyles[i];
      styleObject[prop] = computedStyles.getPropertyValue(prop);
    }

    return {
      outerHTML: element.outerHTML,
      computedStyles: styleObject,
      boundingRect: element.getBoundingClientRect(),
    };
  }

  /**
   * Apply changes to an element
   */
  public applyChanges(element: HTMLElement, changes: GeneratedChanges): void {
    switch (changes.type) {
      case 'style':
        this.applyStyles(element, changes);
        break;

      case 'class':
        this.applyClasses(element, changes);
        break;

      case 'html':
        this.applyHTML(element, changes);
        break;

      case 'attribute':
        this.applyAttributes(element, changes);
        break;

      case 'insert':
        this.applyInsert(element, changes);
        break;

      case 'remove':
        this.applyRemove(element);
        break;

      default:
        throw new Error(`Unknown change type: ${(changes as any).type}`);
    }

    // Apply CSS rules if any
    if (changes.cssRules && changes.cssRules.length > 0) {
      this.injectCSSRules(changes.cssRules);
    }
  }

  /**
   * Apply style changes
   */
  private applyStyles(element: HTMLElement, changes: GeneratedChanges): void {
    if (!changes.styles) return;

    for (const [property, value] of Object.entries(changes.styles)) {
      element.style.setProperty(property, value);
    }
  }

  /**
   * Apply class changes
   */
  private applyClasses(element: HTMLElement, changes: GeneratedChanges): void {
    if (changes.classesToRemove) {
      element.classList.remove(...changes.classesToRemove);
    }

    if (changes.classesToAdd) {
      element.classList.add(...changes.classesToAdd);
    }
  }

  /**
   * Apply HTML changes
   */
  private applyHTML(element: HTMLElement, changes: GeneratedChanges): void {
    if (changes.html !== undefined) {
      element.innerHTML = changes.html;
    }
  }

  /**
   * Apply attribute changes
   */
  private applyAttributes(element: HTMLElement, changes: GeneratedChanges): void {
    if (changes.attributesToRemove) {
      for (const attr of changes.attributesToRemove) {
        element.removeAttribute(attr);
      }
    }

    if (changes.attributes) {
      for (const [attr, value] of Object.entries(changes.attributes)) {
        element.setAttribute(attr, value);
      }
    }
  }

  /**
   * Apply insert changes
   */
  private applyInsert(element: HTMLElement, changes: GeneratedChanges): void {
    if (!changes.insertHTML || !changes.insertPosition) return;

    element.insertAdjacentHTML(changes.insertPosition, changes.insertHTML);
  }

  /**
   * Apply remove changes
   */
  private applyRemove(element: HTMLElement): void {
    element.remove();
  }

  /**
   * Inject CSS rules into the document
   */
  private injectCSSRules(rules: string[]): void {
    const styleEl = this.getStyleElement();

    for (const rule of rules) {
      if (!this.injectedRules.has(rule)) {
        this.injectedRules.add(rule);
        styleEl.appendChild(document.createTextNode(rule + '\n'));
      }
    }
  }

  /**
   * Restore element to a previous snapshot
   */
  public restoreSnapshot(
    element: HTMLElement,
    snapshot: ElementSnapshot
  ): void {
    // Replace the element with the snapshot's HTML
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = snapshot.outerHTML;
    const restoredElement = tempContainer.firstElementChild as HTMLElement;

    if (restoredElement && element.parentNode) {
      element.parentNode.replaceChild(restoredElement, element);
    }
  }

  /**
   * Clear all injected CSS rules
   */
  public clearInjectedRules(): void {
    if (this.styleElement) {
      this.styleElement.textContent = '';
      this.injectedRules.clear();
    }
  }

  /**
   * Destroy and cleanup
   */
  public destroy(): void {
    if (this.styleElement) {
      this.styleElement.remove();
      this.styleElement = null;
    }
    this.injectedRules.clear();
  }
}
