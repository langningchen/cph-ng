import { StressTestState } from '@cph-ng/core';
import { isRunningState, StressTest } from '@v/domain/entities/stressTest';
import { describe, expect, it, vi } from 'vitest';

describe('StressTest', () => {
  describe('constructor defaults', () => {
    it('should initialize with default values', () => {
      const st = new StressTest();
      expect(st.generator).toBeNull();
      expect(st.bruteForce).toBeNull();
      expect(st.cnt).toBe(0);
      expect(st.state).toBe(StressTestState.inactive);
    });

    it('should initialize with provided values', () => {
      const gen = { path: '/gen.cpp', hash: null };
      const bf = { path: '/bf.cpp', hash: null };
      const st = new StressTest(gen, bf, 5, StressTestState.generating);
      expect(st.generator).toBe(gen);
      expect(st.bruteForce).toBe(bf);
      expect(st.cnt).toBe(5);
      expect(st.state).toBe(StressTestState.generating);
    });
  });

  describe('generator setter', () => {
    it('should emit change event when generator changes', () => {
      const st = new StressTest();
      const handler = vi.fn();
      st.signals.on('change', handler);

      const gen = { path: '/gen.cpp', hash: null };
      st.generator = gen;

      expect(st.generator).toBe(gen);
      expect(handler).toHaveBeenCalledWith({ generator: gen });
    });
  });

  describe('bruteForce setter', () => {
    it('should emit change event when bruteForce changes', () => {
      const st = new StressTest();
      const handler = vi.fn();
      st.signals.on('change', handler);

      const bf = { path: '/bf.cpp', hash: null };
      st.bruteForce = bf;

      expect(st.bruteForce).toBe(bf);
      expect(handler).toHaveBeenCalledWith({ bruteForce: bf });
    });
  });

  describe('state setter', () => {
    it('should emit change with cnt and state', () => {
      const st = new StressTest(null, null, 3, StressTestState.inactive);
      const handler = vi.fn();
      st.signals.on('change', handler);

      st.state = StressTestState.compiling;

      expect(st.state).toBe(StressTestState.compiling);
      expect(handler).toHaveBeenCalledWith({ cnt: 3, state: StressTestState.compiling });
    });
  });

  describe('isRunning', () => {
    it.each([
      [StressTestState.compiling, true],
      [StressTestState.generating, true],
      [StressTestState.runningBruteForce, true],
      [StressTestState.runningSolution, true],
      [StressTestState.inactive, false],
      [StressTestState.compilationError, false],
      [StressTestState.foundDifference, false],
      [StressTestState.internalError, false],
    ])('state %s should return isRunning=%s', (state, expected) => {
      const st = new StressTest(null, null, 0, state);
      expect(st.isRunning).toBe(expected);
    });
  });

  describe('clearCnt', () => {
    it('should reset cnt to 0 and emit change', () => {
      const st = new StressTest(null, null, 10, StressTestState.generating);
      const handler = vi.fn();
      st.signals.on('change', handler);

      st.clearCnt();

      expect(st.cnt).toBe(0);
      expect(handler).toHaveBeenCalledWith({ cnt: 0, state: StressTestState.generating });
    });
  });

  describe('count', () => {
    it('should increment cnt and emit change', () => {
      const st = new StressTest(null, null, 0, StressTestState.generating);
      const handler = vi.fn();
      st.signals.on('change', handler);

      st.count();
      expect(st.cnt).toBe(1);

      st.count();
      expect(st.cnt).toBe(2);

      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe('isRunningState helper', () => {
    it('should return true for running states', () => {
      expect(isRunningState(StressTestState.compiling)).toBe(true);
      expect(isRunningState(StressTestState.generating)).toBe(true);
    });

    it('should return false for non-running states', () => {
      expect(isRunningState(StressTestState.inactive)).toBe(false);
      expect(isRunningState(StressTestState.foundDifference)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isRunningState(undefined)).toBe(false);
    });
  });
});
