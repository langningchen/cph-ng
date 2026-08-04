import { StressTestState } from '@cph-ng/core';
import { cryptoMock } from '@t/infrastructure/node/cryptoMock';
import { pathMock } from '@t/infrastructure/node/pathMock';
import { executorMock } from '@t/infrastructure/node/processExecutorMock';
import { settingsMock } from '@t/infrastructure/vscode/settingsMock';
import { translatorMock } from '@t/infrastructure/vscode/translatorMock';
import { mock } from '@t/mock';
import { container } from 'tsyringe';
import { beforeEach, describe, expect, it } from 'vitest';
import type { MockProxy } from 'vitest-mock-extended';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { ProcessOutput } from '@/application/ports/node/IProcessExecutor';
import type { ITempStorage } from '@/application/ports/node/ITempStorage';
import type { IProblemRepository } from '@/application/ports/problems/IProblemRepository';
import type { IProblemService } from '@/application/ports/problems/IProblemService';
import type { ITestcaseIoService } from '@/application/ports/problems/ITestcaseIoService';
import type {
  CompileData,
  ICompilerService,
} from '@/application/ports/problems/judge/ICompilerService';
import type { IJudgeService } from '@/application/ports/problems/judge/IJudgeService';
import type { IJudgeServiceFactory } from '@/application/ports/problems/judge/IJudgeServiceFactory';
import type { ILanguageRegistry } from '@/application/ports/problems/judge/langs/ILanguageRegistry';
import type { ILanguageStrategy } from '@/application/ports/problems/judge/langs/ILanguageStrategy';
import type { IUi } from '@/application/ports/vscode/IUi';
import { StartStressTest } from '@/application/useCases/webview/problem/stressTest/StartStressTest';
import { TOKENS } from '@/composition/tokens';
import { BackgroundProblem } from '@/domain/entities/backgroundProblem';
import { Problem } from '@/domain/entities/problem';

describe('StartStressTest', () => {
  let service: StartStressTest;
  let repoMock: MockProxy<IProblemRepository>;
  let compilerMock: MockProxy<ICompilerService>;
  let langRegistryMock: MockProxy<ILanguageRegistry>;
  let judgeFactoryMock: MockProxy<IJudgeServiceFactory>;
  let judgeServiceMock: MockProxy<IJudgeService>;
  let problemServiceMock: MockProxy<IProblemService>;
  let testcaseIoServiceMock: MockProxy<ITestcaseIoService>;
  let tempStorageMock: MockProxy<ITempStorage>;

  beforeEach(() => {
    repoMock = mock<IProblemRepository>();
    compilerMock = mock<ICompilerService>();
    langRegistryMock = mock<ILanguageRegistry>();
    judgeFactoryMock = mock<IJudgeServiceFactory>();
    judgeServiceMock = mock<IJudgeService>();
    problemServiceMock = mock<IProblemService>();
    testcaseIoServiceMock = mock<ITestcaseIoService>();
    tempStorageMock = mock<ITempStorage>();
    tempStorageMock.dispose.mockImplementation(() => {});

    container.registerInstance(TOKENS.compilerService, compilerMock);
    container.registerInstance(TOKENS.crypto, cryptoMock);
    container.registerInstance(TOKENS.fileSystem, mock<IFileSystem>());
    container.registerInstance(TOKENS.judgeServiceFactory, judgeFactoryMock);
    container.registerInstance(TOKENS.languageRegistry, langRegistryMock);
    container.registerInstance(TOKENS.path, pathMock);
    container.registerInstance(TOKENS.problemRepository, repoMock);
    container.registerInstance(TOKENS.problemService, problemServiceMock);
    container.registerInstance(TOKENS.processExecutor, executorMock);
    container.registerInstance(TOKENS.settings, settingsMock);
    container.registerInstance(TOKENS.tempStorage, tempStorageMock);
    container.registerInstance(TOKENS.testcaseIoService, testcaseIoServiceMock);
    container.registerInstance(TOKENS.translator, translatorMock);
    container.registerInstance(TOKENS.ui, mock<IUi>());

    service = container.resolve(StartStressTest);
  });

  it('runs Python generator and brute force with their interpreter commands', async () => {
    const problem = new Problem('test', '/src/main.cpp');
    problem.stressTest.generator = { path: '/generator/gen.py', hash: null };
    problem.stressTest.bruteForce = { path: '/brute/bf.py', hash: null };
    const background = new BackgroundProblem(
      '00000000-0000-0000-0000-000000000000',
      problem,
      Date.now(),
    );

    repoMock.get.mockResolvedValue(background);
    compilerMock.compileAll.mockResolvedValue({
      solution: { path: '/tmp/solution', hash: null },
      stressTest: {
        generator: { path: '/tmp/gen.pyc', hash: null },
        bruteForce: { path: '/tmp/bf.pyc', hash: null },
      },
    } satisfies CompileData);

    const genLang = mock<ILanguageStrategy>();
    genLang.getInterpretCommand.mockResolvedValue(['python', '/tmp/gen.pyc']);
    const bfLang = mock<ILanguageStrategy>();
    bfLang.getInterpretCommand.mockResolvedValue(['python', '/tmp/bf.pyc']);
    langRegistryMock.getLangByFile.mockImplementation((path) => {
      if (path === '/generator/gen.py') return genLang;
      if (path === '/brute/bf.py') return bfLang;
      return undefined;
    });

    judgeFactoryMock.create.mockReturnValue(judgeServiceMock);
    judgeServiceMock.judge.mockImplementation(async () => {
      problem.stressTest.state = StressTestState.inactive;
    });

    const genOutput = {
      codeOrSignal: 0,
      stdoutPath: '/tmp/gen-stdout',
      stderrPath: '/tmp/gen-stderr',
      timeMs: 1,
    } satisfies ProcessOutput;
    const bfOutput = {
      codeOrSignal: 0,
      stdoutPath: '/tmp/bf-stdout',
      stderrPath: '/tmp/bf-stderr',
      timeMs: 1,
    } satisfies ProcessOutput;
    executorMock.execute.mockResolvedValueOnce(genOutput).mockResolvedValueOnce(bfOutput);

    await service.exec({
      problemId: '00000000-0000-0000-0000-000000000000',
      type: 'startStressTest',
      forceCompile: null,
    });

    expect(genLang.getInterpretCommand).toHaveBeenCalledWith('/tmp/gen.pyc');
    expect(bfLang.getInterpretCommand).toHaveBeenCalledWith('/tmp/bf.pyc');
    expect(executorMock.execute).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        cmd: ['python', '/tmp/gen.pyc'],
        cwd: '/generator',
      }),
    );
    expect(executorMock.execute).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        cmd: ['python', '/tmp/bf.pyc'],
        cwd: '/brute',
        stdinPath: '/tmp/gen-stdout',
      }),
    );
  });
});
