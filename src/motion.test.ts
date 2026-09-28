// PH2-02 (R-24/R-08/R-06a): createMotionGate takes a MotionQuery instead of
// calling matchMedia itself precisely so these tests can hand it a plain
// object — vitest runs in the "node" environment (vitest.config.ts), no DOM,
// so a real MediaQueryList is not available here.
import { describe, expect, it, vi } from 'vitest';
import { createMotionGate } from './motion';
import type { MotionQuery } from './motion';

/** A MotionQuery whose 'change' listener the test can fire directly,
 * standing in for the browser dispatching a real media-query change. */
function fakeQuery(initial: boolean): MotionQuery & { fire(matches: boolean): void } {
  let onChange: ((event: { matches: boolean }) => void) | null = null;
  return {
    matches: initial,
    addEventListener: (_type, listener) => {
      onChange = listener;
    },
    removeEventListener: (_type, listener) => {
      if (onChange === listener) onChange = null;
    },
    fire(matches) {
      onChange?.({ matches });
    },
  };
}

describe('createMotionGate', () => {
  it('reflects the query\'s initial matches value', () => {
    expect(createMotionGate(fakeQuery(true)).isReduced()).toBe(true);
    expect(createMotionGate(fakeQuery(false)).isReduced()).toBe(false);
  });

  it('updates isReduced() when the query fires a change event', () => {
    const query = fakeQuery(false);
    const gate = createMotionGate(query);
    query.fire(true);
    expect(gate.isReduced()).toBe(true);
    query.fire(false);
    expect(gate.isReduced()).toBe(false);
  });

  it('notifies every subscriber with the new value on change', () => {
    const query = fakeQuery(false);
    const gate = createMotionGate(query);
    const a = vi.fn();
    const b = vi.fn();
    gate.subscribe(a);
    gate.subscribe(b);
    query.fire(true);
    expect(a).toHaveBeenCalledWith(true);
    expect(b).toHaveBeenCalledWith(true);
  });

  it('stops notifying a subscriber once it unsubscribes', () => {
    const query = fakeQuery(false);
    const gate = createMotionGate(query);
    const listener = vi.fn();
    const unsubscribe = gate.subscribe(listener);
    query.fire(true);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    query.fire(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('leaves other subscribers in place when one unsubscribes', () => {
    const query = fakeQuery(false);
    const gate = createMotionGate(query);
    const stays = vi.fn();
    const leaves = vi.fn();
    gate.subscribe(stays);
    const unsubscribe = gate.subscribe(leaves);
    unsubscribe();
    query.fire(true);
    expect(stays).toHaveBeenCalledWith(true);
    expect(leaves).not.toHaveBeenCalled();
  });
});
