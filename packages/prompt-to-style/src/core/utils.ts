import type { ElementContext } from '../types';

/**
 * Generate a unique CSS selector for an element
 */
export function generateSelector(element: HTMLElement): string {
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  const path: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      selector += `#${CSS.escape(current.id)}`;
      path.unshift(selector);
      break;
    }

    if (current.className) {
      const classes = Array.from(current.classList)
        .filter((c) => !c.startsWith('prompt-to-style'))
        .map((c) => `.${CSS.escape(c)}`)
        .join('');

      if (classes) {
        selector += classes;
      }
    }

    // Add nth-child if needed for uniqueness
    if (current.parentElement) {
      const siblings = Array.from(current.parentElement.children);
      const index = siblings.indexOf(current);

      if (siblings.length > 1) {
        selector += `:nth-child(${index + 1})`;
      }
    }

    path.unshift(selector);
    current = current.parentElement;
  }

  return path.join(' > ');
}

/**
 * Extract context information from an element
 */
export function extractElementContext(element: HTMLElement): ElementContext {
  const computedStyles = window.getComputedStyle(element);
  const computedStylesObj: Record<string, string> = {};

  // Get all computed styles
  for (let i = 0; i < computedStyles.length; i++) {
    const prop = computedStyles[i];
    computedStylesObj[prop] = computedStyles.getPropertyValue(prop);
  }

  // Get attributes
  const attributes: Record<string, string> = {};
  for (let i = 0; i < element.attributes.length; i++) {
    const attr = element.attributes[i];
    attributes[attr.name] = attr.value;
  }

  return {
    element,
    selector: generateSelector(element),
    computedStyles: computedStylesObj,
    inlineStyles: element.getAttribute('style') || '',
    innerHTML: element.innerHTML,
    outerHTML: element.outerHTML,
    classes: Array.from(element.classList),
    attributes,
  };
}

/**
 * Sanitize HTML to prevent XSS
 */
export function sanitizeHTML(html: string): string {
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
}

/**
 * Deep clone an object (for snapshots)
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
