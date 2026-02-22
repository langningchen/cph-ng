import { describe, expect, it } from 'vitest';
import { TestcaseIo } from '@/domain/entities/testcaseIo';

describe('TestcaseIo', () => {
  describe('constructor', () => {
    it('should create with path and set data to undefined', () => {
      const io = new TestcaseIo({ path: '/tmp/file.txt' });
      expect(io.path).toBe('/tmp/file.txt');
      expect(io.data).toBeUndefined();
    });

    it('should create with data and set path to undefined', () => {
      const io = new TestcaseIo({ data: 'hello world' });
      expect(io.data).toBe('hello world');
      expect(io.path).toBeUndefined();
    });

    it('should handle empty data string', () => {
      const io = new TestcaseIo({ data: '' });
      expect(io.data).toBe('');
      expect(io.path).toBeUndefined();
    });
  });

  describe('match', () => {
    it('should call onPath when path is set', () => {
      const io = new TestcaseIo({ path: '/tmp/file.txt' });
      const result = io.match(
        (path) => `path:${path}`,
        (data) => `data:${data}`,
      );
      expect(result).toBe('path:/tmp/file.txt');
    });

    it('should call onData when data is set', () => {
      const io = new TestcaseIo({ data: 'content' });
      const result = io.match(
        (path) => `path:${path}`,
        (data) => `data:${data}`,
      );
      expect(result).toBe('data:content');
    });

    it('should call onData for empty data string', () => {
      const io = new TestcaseIo({ data: '' });
      const result = io.match(
        () => 'path',
        () => 'data',
      );
      expect(result).toBe('data');
    });
  });

  describe('getDisposables', () => {
    it('should return path in array when path is set', () => {
      const io = new TestcaseIo({ path: '/tmp/file.txt' });
      expect(io.getDisposables()).toEqual(['/tmp/file.txt']);
    });

    it('should return empty array when data is set', () => {
      const io = new TestcaseIo({ data: 'content' });
      expect(io.getDisposables()).toEqual([]);
    });
  });
});
