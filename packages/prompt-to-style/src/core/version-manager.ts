import type { DOMChange, ElementContext, GeneratedChanges, ElementSnapshot } from '../types';

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * VersionManager handles change history and persistence
 */
export class VersionManager {
  private changes: DOMChange[] = [];
  private currentVersion = 0;
  private maxVersions: number;
  private storageKey: string;
  private storageEnabled: boolean;

  constructor(
    storageKey = 'prompt-to-style',
    maxVersions = 50,
    storageEnabled = true
  ) {
    this.storageKey = storageKey;
    this.maxVersions = maxVersions;
    this.storageEnabled = storageEnabled;

    if (this.storageEnabled) {
      this.loadFromStorage();
    }
  }

  /**
   * Record a new change
   */
  public recordChange(
    prompt: string,
    context: ElementContext,
    changes: GeneratedChanges,
    previousState: ElementSnapshot
  ): DOMChange {
    const change: DOMChange = {
      id: generateId(),
      timestamp: Date.now(),
      prompt,
      context,
      changes,
      previousState,
      version: ++this.currentVersion,
    };

    this.changes.push(change);

    // Enforce max versions limit
    if (this.changes.length > this.maxVersions) {
      this.changes.shift();
    }

    if (this.storageEnabled) {
      this.saveToStorage();
    }

    return change;
  }

  /**
   * Get all changes
   */
  public getAllChanges(): DOMChange[] {
    return [...this.changes];
  }

  /**
   * Get change by ID
   */
  public getChangeById(id: string): DOMChange | undefined {
    return this.changes.find((c) => c.id === id);
  }

  /**
   * Get the last change
   */
  public getLastChange(): DOMChange | undefined {
    return this.changes[this.changes.length - 1];
  }

  /**
   * Remove the last change (for undo)
   */
  public removeLastChange(): DOMChange | undefined {
    const change = this.changes.pop();

    if (this.storageEnabled) {
      this.saveToStorage();
    }

    return change;
  }

  /**
   * Clear all changes
   */
  public clearAll(): void {
    this.changes = [];
    this.currentVersion = 0;

    if (this.storageEnabled) {
      this.saveToStorage();
    }
  }

  /**
   * Get changes count
   */
  public getChangeCount(): number {
    return this.changes.length;
  }

  /**
   * Export changes as JSON
   */
  public exportToJSON(): string {
    return JSON.stringify(
      {
        version: this.currentVersion,
        changes: this.changes,
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    );
  }

  /**
   * Import changes from JSON
   */
  public importFromJSON(json: string): void {
    try {
      const data = JSON.parse(json);

      if (data.changes && Array.isArray(data.changes)) {
        this.changes = data.changes;
        this.currentVersion = data.version || this.changes.length;

        if (this.storageEnabled) {
          this.saveToStorage();
        }
      }
    } catch (error) {
      console.error('Failed to import changes from JSON:', error);
      throw new Error('Invalid JSON format');
    }
  }

  /**
   * Save to localStorage
   */
  public saveToStorage(): void {
    if (!this.storageEnabled) return;

    try {
      const data = {
        version: this.currentVersion,
        changes: this.changes,
        savedAt: Date.now(),
      };

      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  }

  /**
   * Load from localStorage
   */
  public loadFromStorage(): void {
    if (!this.storageEnabled) return;

    try {
      const stored = localStorage.getItem(this.storageKey);

      if (stored) {
        const data = JSON.parse(stored);
        this.changes = data.changes || [];
        this.currentVersion = data.version || 0;
      }
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
    }
  }

  /**
   * Clear storage
   */
  public clearStorage(): void {
    if (!this.storageEnabled) return;

    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
    }
  }

  /**
   * Get storage size in bytes (approximate)
   */
  public getStorageSize(): number {
    if (!this.storageEnabled) return 0;

    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? new Blob([stored]).size : 0;
    } catch (error) {
      console.error('Failed to get storage size:', error);
      return 0;
    }
  }
}
