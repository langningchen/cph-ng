import 'reflect-metadata';
import { container } from 'tsyringe';
import { beforeEach } from 'vitest';

beforeEach(() => {
  container.clearInstances();
});
