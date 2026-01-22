import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IPath } from '@/application/ports/node/IPath';
import type { ISystem } from '@/application/ports/node/ISystem';
import type { IPathResolver } from '@/application/ports/services/IPathResolver';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { IFileWithHash } from '@/domain/types';
import { LangRust } from '@/infrastructure/problems/judge/langs/rustStrategy';
import { LanguageStrategyContext } from '@/infrastructure/problems/judge/langs/languageStrategyContext';

describe('LangRust', () => {
  let langRust: LangRust;
  let mockContext: LanguageStrategyContext;
  let mockLogger: ILogger;
  let mockPath: IPath;
  let mockResolver: IPathResolver;
  let mockSystem: ISystem;
  let mockSettings: any;

  beforeEach(() => {
    mockSettings = {
      compilation: {
        rustCompiler: 'rustc',
        rustArgs: '-C opt-level=2',
      },
      cache: {
        directory: '/tmp/cache',
      },
      runner: {
        unlimitedStack: false,
      },
    };

    mockLogger = {
      withScope: vi.fn().mockReturnThis(),
      trace: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as any;

    mockContext = {
      logger: mockLogger,
      settings: mockSettings,
      processExecutor: {
        execute: vi.fn(),
      },
      compilation: {
        clear: vi.fn(),
        appendLine: vi.fn(),
        append: vi.fn(),
        show: vi.fn(),
      },
      telemetry: {
        sendEvent: vi.fn(),
        error: vi.fn(),
        start: vi.fn().mockReturnValue(vi.fn()),
      },
    } as any;

    mockPath = {
      join: (...args: string[]) => args.join('/'),
      basename: (p: string, ext?: string) => {
        const name = p.split('/').pop() || '';
        return ext ? name.replace(ext, '') : name;
      },
      extname: (p: string) => '.rs',
    } as any;

    mockResolver = {
      renderPath: (p: string) => p,
    } as any;

    mockSystem = {
      platform: vi.fn().mockReturnValue('linux'),
    } as any;

    langRust = new LangRust(
      mockContext,
      mockLogger,
      mockPath,
      mockResolver,
      mockSystem,
    );
  });

  it('should compile correctly', async () => {
    const src: IFileWithHash = { path: '/src/main.rs', hash: 'hash' };
    const spiedExecute = vi.spyOn(langRust as any, 'executeCompiler').mockResolvedValue(undefined);

    // Mock checkHash to return skip: false
    vi.spyOn(langRust as any, 'checkHash').mockResolvedValue({ skip: false, hash: 'newhash' });

    await langRust.compile(src, new AbortController().signal, false);

    expect(spiedExecute).toHaveBeenCalledWith(
        ['rustc', '/src/main.rs', '-C', 'opt-level=2', '-o', '/tmp/cache/main'],
        expect.anything()
    );
  });
});
