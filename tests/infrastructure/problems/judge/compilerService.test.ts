import { loggerMock } from '@t/infrastructure/vscode/loggerMock';
import { translatorMock } from '@t/infrastructure/vscode/translatorMock';
import { mock } from '@t/mock';
import { container } from 'tsyringe';
import { beforeEach, describe, expect, it } from 'vitest';
import type { MockProxy } from 'vitest-mock-extended';
import type { CompileData } from '@/application/ports/problems/judge/ICompilerService';
import type { ILanguageRegistry } from '@/application/ports/problems/judge/langs/ILanguageRegistry';
import type { ILanguageStrategy } from '@/application/ports/problems/judge/langs/ILanguageStrategy';
import { TOKENS } from '@/composition/tokens';
import { Problem } from '@/domain/entities/problem';
import { CompilerService } from '@/infrastructure/problems/judge/compilerService';

describe('CompilerService', () => {
  let service: CompilerService;
  let langRegistryMock: MockProxy<ILanguageRegistry>;
  const signal = new AbortController().signal;

  beforeEach(() => {
    langRegistryMock = mock<ILanguageRegistry>();
    container.registerInstance(TOKENS.languageRegistry, langRegistryMock);
    container.registerInstance(TOKENS.logger, loggerMock);
    container.registerInstance(TOKENS.translator, translatorMock);

    service = container.resolve(CompilerService);
  });

  const makeProblem = () => {
    const p = new Problem('test', '/src/main.cpp');
    return p;
  };

  const makeLang = (path = '/tmp/compiled') => {
    const lang = mock<ILanguageStrategy>();
    lang.compile.mockResolvedValue({ path, hash: 'abc123' });
    return lang;
  };

  it('should return error when source language is not found', async () => {
    langRegistryMock.getLang.mockReturnValue(undefined);

    const result = await service.compileAll(makeProblem(), null, signal);

    expect(result).toBeInstanceOf(Error);
  });

  it('should compile solution only when no checker/interactor/stressTest', async () => {
    const lang = makeLang();
    langRegistryMock.getLang.mockReturnValue(lang);

    const problem = makeProblem();
    const result = await service.compileAll(problem, null, signal);

    expect(result).not.toBeInstanceOf(Error);
    expect(result).toEqual(
      expect.objectContaining({
        solution: { path: '/tmp/compiled', hash: 'abc123' },
      }),
    );
    expect(problem.src.hash).toBe('abc123');
  });

  it('should compile solution and checker', async () => {
    const solLang = makeLang('/tmp/sol-bin');
    const checkerLang = makeLang('/tmp/checker-bin');
    langRegistryMock.getLang.mockImplementation((path: string) => {
      if (path === '/src/main.cpp') return solLang;
      if (path === '/checker.cpp') return checkerLang;
      return undefined;
    });

    const problem = makeProblem();
    problem.checker = { path: '/checker.cpp' };
    const result = await service.compileAll(problem, null, signal);

    expect(result).not.toBeInstanceOf(Error);
    const data = result as CompileData;
    expect(data.solution).toEqual({ path: '/tmp/sol-bin', hash: 'abc123' });
    expect(data.checker).toEqual({ path: '/tmp/checker-bin', hash: 'abc123' });
  });

  it('should compile solution and interactor', async () => {
    const solLang = makeLang('/tmp/sol-bin');
    const intLang = makeLang('/tmp/int-bin');
    langRegistryMock.getLang.mockImplementation((path: string) => {
      if (path === '/src/main.cpp') return solLang;
      if (path === '/interactor.cpp') return intLang;
      return undefined;
    });

    const problem = makeProblem();
    problem.interactor = { path: '/interactor.cpp' };
    const result = await service.compileAll(problem, null, signal);

    expect(result).not.toBeInstanceOf(Error);
    const data = result as CompileData;
    expect(data.interactor).toEqual({ path: '/tmp/int-bin', hash: 'abc123' });
  });

  it('should compile stress test generator and brute force', async () => {
    const solLang = makeLang('/tmp/sol-bin');
    const genLang = makeLang('/tmp/gen-bin');
    const bfLang = makeLang('/tmp/bf-bin');
    langRegistryMock.getLang.mockImplementation((path: string) => {
      if (path === '/src/main.cpp') return solLang;
      if (path === '/gen.cpp') return genLang;
      if (path === '/bf.cpp') return bfLang;
      return undefined;
    });

    const problem = makeProblem();
    problem.stressTest.generator = { path: '/gen.cpp' };
    problem.stressTest.bruteForce = { path: '/bf.cpp' };
    const result = await service.compileAll(problem, null, signal);

    expect(result).not.toBeInstanceOf(Error);
    const data = result as CompileData;
    expect(data.stressTest).toEqual({
      generator: { path: '/tmp/gen-bin', hash: 'abc123' },
      bruteForce: { path: '/tmp/bf-bin', hash: 'abc123' },
    });
  });

  it('should return error when source compilation fails', async () => {
    const lang = mock<ILanguageStrategy>();
    lang.compile.mockResolvedValue(new Error('compile failed'));
    langRegistryMock.getLang.mockReturnValue(lang);

    const result = await service.compileAll(makeProblem(), null, signal);

    expect(result).toBeInstanceOf(Error);
  });

  it('should return error when checker compilation fails', async () => {
    const solLang = makeLang();
    const checkerLang = mock<ILanguageStrategy>();
    checkerLang.compile.mockResolvedValue(new Error('checker compile failed'));
    langRegistryMock.getLang.mockImplementation((path: string) => {
      if (path === '/src/main.cpp') return solLang;
      if (path === '/checker.cpp') return checkerLang;
      return undefined;
    });

    const problem = makeProblem();
    problem.checker = { path: '/checker.cpp' };
    const result = await service.compileAll(problem, null, signal);

    expect(result).toBeInstanceOf(Error);
  });

  it('should use file path when lang not found for checker (optionalCompile)', async () => {
    const solLang = makeLang();
    langRegistryMock.getLang.mockImplementation((path: string) => {
      if (path === '/src/main.cpp') return solLang;
      return undefined; // checker lang not found -> uses raw path
    });

    const problem = makeProblem();
    problem.checker = { path: '/checker.py' };
    const result = await service.compileAll(problem, null, signal);

    expect(result).not.toBeInstanceOf(Error);
    const data = result as CompileData;
    expect(data.checker).toEqual({ path: '/checker.py' });
  });
});
