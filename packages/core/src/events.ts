import type { EventHandler, Unsubscribe } from './types';

/**
 * Lightweight typed event emitter for the file preview system.
 * Supports on/off/emit with automatic cleanup.
 */
export class EventEmitter {
  private listeners = new Map<string, Set<EventHandler>>();

  /**
   * Subscribe to an event.
   * @returns An unsubscribe function.
   */
  on(event: string, handler: EventHandler): Unsubscribe {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);

    return () => this.off(event, handler);
  }

  /**
   * Unsubscribe from an event.
   */
  off(event: string, handler: EventHandler): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Emit an event with optional payload.
   */
  emit(event: string, data?: unknown): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (error) {
          console.error(`[FilePreview] Error in '${event}' handler:`, error);
        }
      }
    }
  }

  /**
   * Remove all listeners, optionally for a specific event.
   */
  removeAll(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get the count of listeners for a specific event.
   */
  listenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}
