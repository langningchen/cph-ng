import { settingsMock } from '@t/infrastructure/vscode/settingsMock';
import { vol } from 'memfs';
import 'reflect-metadata';
import { container } from 'tsyringe';
import { beforeEach } from 'vitest';

beforeEach(() => {
  container.clearInstances();
  vi.clearAllMocks();
});
afterEach(() => {
  vol.reset();
  settingsMock.reset();
});
