// AbortSignal manager to prevent MaxListenersExceededWarning
import { EventEmitter } from 'events';

// Increase the default max listeners for EventEmitter globally
EventEmitter.defaultMaxListeners = 20;

export class AbortSignalManager {
  constructor() {
    this.controllers = new Map();
    this.listeners = new WeakMap();
  }

  createController(key) {
    // Clean up existing controller if present
    this.cleanup(key);
    
    const controller = new AbortController();
    this.controllers.set(key, controller);
    
    // Track listeners added to this signal
    this.listeners.set(controller.signal, []);
    
    return controller;
  }

  addListener(signal, event, handler) {
    if (!this.listeners.has(signal)) {
      this.listeners.set(signal, []);
    }
    
    const listeners = this.listeners.get(signal);
    listeners.push({ event, handler });
    
    signal.addEventListener(event, handler);
  }

  cleanup(key) {
    const controller = this.controllers.get(key);
    if (!controller) return;
    
    // Remove all listeners
    const listeners = this.listeners.get(controller.signal) || [];
    for (const { event, handler } of listeners) {
      controller.signal.removeEventListener(event, handler);
    }
    
    // Clean up references
    this.listeners.delete(controller.signal);
    this.controllers.delete(key);
  }

  cleanupAll() {
    for (const key of this.controllers.keys()) {
      this.cleanup(key);
    }
  }
}

// Global instance
export const abortManager = new AbortSignalManager();