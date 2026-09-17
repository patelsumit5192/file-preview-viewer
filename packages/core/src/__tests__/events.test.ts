import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from '../events';

describe('EventEmitter', () => {
  it('should register and trigger event listeners', () => {
    const emitter = new EventEmitter();
    const handler = vi.fn();

    emitter.on('test-event', handler);
    emitter.emit('test-event', { message: 'hello' });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ message: 'hello' });
  });

  it('should unsubscribe using returned function', () => {
    const emitter = new EventEmitter();
    const handler = vi.fn();

    const unsub = emitter.on('test-event', handler);
    unsub();

    emitter.emit('test-event', 123);
    expect(handler).not.toHaveBeenCalled();
  });

  it('should report correct listener count', () => {
    const emitter = new EventEmitter();
    expect(emitter.listenerCount('sample')).toBe(0);

    const unsub1 = emitter.on('sample', () => {});
    const unsub2 = emitter.on('sample', () => {});
    expect(emitter.listenerCount('sample')).toBe(2);

    unsub1();
    expect(emitter.listenerCount('sample')).toBe(1);

    unsub2();
    expect(emitter.listenerCount('sample')).toBe(0);
  });

  it('should remove all listeners', () => {
    const emitter = new EventEmitter();
    emitter.on('ev1', () => {});
    emitter.on('ev2', () => {});

    emitter.removeAll();
    expect(emitter.listenerCount('ev1')).toBe(0);
    expect(emitter.listenerCount('ev2')).toBe(0);
  });
});
