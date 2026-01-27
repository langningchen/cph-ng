import { vol } from 'memfs';
import 'reflect-metadata';
import { container } from 'tsyringe';
import { beforeEach } from 'vitest';

beforeEach(() => {
  container.clearInstances();
});
afterEach(() => {
  vol.reset();
});
