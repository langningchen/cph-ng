// Copyright (C) 2026 Langning Chen
//
// This file is part of cph-ng.
//
// cph-ng is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// cph-ng is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with cph-ng.  If not, see <https://www.gnu.org/licenses/>.

import type { TestcaseId } from '@cph-ng/core';
import { StressTestState, VerdictName, Verdicts, VerdictType } from '@cph-ng/core';
import { pathMock } from '@t/infrastructure/node/pathMock';
import { settingsMock } from '@t/infrastructure/vscode/settingsMock';
import { translatorMock } from '@t/infrastructure/vscode/translatorMock';
import { mock } from '@t/mock';
import { container } from 'tsyringe';
import { beforeEach, describe, expect, it } from 'vitest';
import type { MockProxy } from 'vitest-mock-extended';
import type { ILanguageRegistry } from '@/application/ports/problems/judge/langs/ILanguageRegistry';
import type { ILanguageStrategy } from '@/application/ports/problems/judge/langs/ILanguageStrategy';
import { TOKENS } from '@/composition/tokens';
import { Problem } from '@/domain/entities/problem';
import { StressTest } from '@/domain/entities/stressTest';
import { Testcase } from '@/domain/entities/testcase';
import { TestcaseIo } from '@/domain/entities/testcaseIo';
import { WebviewProblemMapper } from '@/infrastructure/vscode/webviewProblemMapper';

describe('WebviewProblemMapper', () => {
  let mapper: WebviewProblemMapper;
  let langRegistryMock: MockProxy<ILanguageRegistry>;

  const makeLang = (): MockProxy<ILanguageStrategy> => {
    return mock<ILanguageStrategy>({
      defaultValues: {
        compiler: 'g++',
        compilerArgs: '-O2 -std=c++14',
        interpreter: undefined,
        interpreterArgs: undefined,
      },
    });
  };

  beforeEach(() => {
    settingsMock.reset();
    translatorMock.t.mockImplementation((message, args) => {
      let result = message;
      if (args)
        for (const [key, value] of Object.entries(args))
          result = result.replaceAll(`#{${key}}`, String(value));
      return result;
    });
    langRegistryMock = mock<ILanguageRegistry>();
    langRegistryMock.getLangByFile.mockReturnValue(undefined);

    container.registerInstance(TOKENS.path, pathMock);
    container.registerInstance(TOKENS.settings, settingsMock);
    container.registerInstance(TOKENS.translator, translatorMock);
    container.registerInstance(TOKENS.languageRegistry, langRegistryMock);

    mapper = container.resolve(WebviewProblemMapper);
  });

  describe('toDto', () => {
    it('should serialize a minimal problem', () => {
      const problem = new Problem('test-problem', '/src/main.cpp');
      const dto = mapper.toDto(problem);

      expect(dto).toMatchObject({
        name: 'test-problem',
        url: null,
        revision: 0,
        testcases: {},
        testcaseOrder: [],
        src: { path: '/src/main.cpp', base: 'main.cpp' },
        checker: null,
        interactor: null,
        timeElapsedMs: 0,
      });
      expect(dto.stressTest.isRunning).toBe(false);
      expect(dto.stressTest.msg).toBe('Stress Test is Idle');
    });

    it('should use the current revision of the problem', () => {
      const problem = new Problem('rev', '/src/main.cpp');
      problem.addTestcase('tc-1' as TestcaseId, new Testcase());

      const dto = mapper.toDto(problem);
      expect(dto.revision).toBe(problem.revision);
      expect(dto.revision).toBeGreaterThan(0);
    });

    it('should serialize src hash-less path with its basename', () => {
      const problem = new Problem('src', '/src/sub/dir/main.cpp');
      expect(mapper.toDto(problem).src).toEqual({
        path: '/src/sub/dir/main.cpp',
        base: 'main.cpp',
      });
    });

    it('should serialize checker and interactor when set', () => {
      const problem = new Problem('meta', '/src/main.cpp');
      problem.checker = { path: '/checker.cpp', hash: 'abc' };
      problem.interactor = { path: '/interactor.cpp', hash: 'def' };

      const dto = mapper.toDto(problem);
      expect(dto.checker).toEqual({ path: '/checker.cpp', base: 'checker.cpp' });
      expect(dto.interactor).toEqual({ path: '/interactor.cpp', base: 'interactor.cpp' });
    });

    it('should serialize url and timeElapsedMs', () => {
      const problem = new Problem('url', '/src/main.cpp');
      problem.url = 'https://codeforces.com/problem/1/A';
      problem.addTimeElapsed(1234);

      const dto = mapper.toDto(problem);
      expect(dto.url).toBe('https://codeforces.com/problem/1/A');
      expect(dto.timeElapsedMs).toBe(1234);
    });

    it('should serialize testcases in order', () => {
      const problem = new Problem('order', '/src/main.cpp');
      problem.addTestcase('tc-1' as TestcaseId, new Testcase(new TestcaseIo({ data: 'in1' })));
      problem.addTestcase('tc-2' as TestcaseId, new Testcase(new TestcaseIo({ data: 'in2' })));

      const dto = mapper.toDto(problem);
      expect(dto.testcaseOrder).toEqual(['tc-1', 'tc-2']);
      expect(dto.testcases['tc-1' as TestcaseId].stdin).toEqual({ type: 'string', data: 'in1' });
      expect(dto.testcases['tc-2' as TestcaseId].stdin).toEqual({ type: 'string', data: 'in2' });
    });

    it('should serialize file-backed testcase io with basename', () => {
      const problem = new Problem('file-io', '/src/main.cpp');
      problem.addTestcase(
        'tc-1' as TestcaseId,
        new Testcase(
          new TestcaseIo({ path: '/tests/1.in' }),
          new TestcaseIo({ path: '/tests/1.ans' }),
        ),
      );

      const dto = mapper.toDto(problem);
      const tc = dto.testcases['tc-1' as TestcaseId];
      expect(tc.stdin).toEqual({ type: 'file', path: '/tests/1.in', base: '1.in' });
      expect(tc.answer).toEqual({ type: 'file', path: '/tests/1.ans', base: '1.ans' });
    });

    it('should pass through expand and disabled flags', () => {
      const problem = new Problem('flags', '/src/main.cpp');
      problem.addTestcase('tc-1' as TestcaseId, new Testcase(undefined, undefined, true, true));

      const tc = mapper.toDto(problem).testcases['tc-1' as TestcaseId];
      expect(tc.isExpand).toBe(true);
      expect(tc.isDisabled).toBe(true);
    });
  });

  describe('testcaseToDto', () => {
    it('should serialize a testcase without result', () => {
      const tc = new Testcase(new TestcaseIo({ data: 'in' }), new TestcaseIo({ data: 'ans' }));
      const dto = mapper.testcaseToDto(tc);

      expect(dto).toEqual({
        stdin: { type: 'string', data: 'in' },
        answer: { type: 'string', data: 'ans' },
        isExpand: false,
        isDisabled: false,
        result: null,
      });
    });

    it('should serialize a testcase result with a full verdict', () => {
      const tc = new Testcase();
      tc.updateResult({
        verdict: VerdictName.accepted,
        timeMs: 42,
        memoryMb: 16,
        stdout: new TestcaseIo({ data: 'output' }),
        stderr: new TestcaseIo({ path: '/tmp/stderr' }),
        msg: 'ok',
      });

      const dto = mapper.testcaseToDto(tc);
      expect(dto.result).toEqual({
        verdict: { ...Verdicts[VerdictName.accepted], fullName: 'Accepted' },
        timeMs: 42,
        memoryMb: 16,
        stdout: { type: 'string', data: 'output' },
        stderr: { type: 'file', path: '/tmp/stderr', base: 'stderr' },
        // Testcase.updateResult appends a trailing newline to each message
        msg: 'ok\n',
      });
      expect(dto.result?.verdict.type).toBe(VerdictType.passed);
    });

    it('should keep null stdout and stderr as null in the result', () => {
      const tc = new Testcase();
      tc.updateResult({ verdict: VerdictName.wrongAnswer, stdout: null, stderr: null });

      const dto = mapper.testcaseToDto(tc);
      expect(dto.result?.stdout).toBeNull();
      expect(dto.result?.stderr).toBeNull();
    });

    it('should support partial testcase updates', () => {
      const dto = mapper.testcaseToDto({ isDisabled: true });
      expect(dto).toEqual({
        stdin: undefined,
        answer: undefined,
        isExpand: undefined,
        isDisabled: true,
        result: undefined,
      });
    });
  });

  describe('testcaseResultToDto', () => {
    it('should serialize a full result', () => {
      const dto = mapper.testcaseResultToDto({
        verdict: VerdictName.timeLimitExceed,
        timeMs: 1000,
        memoryMb: null,
        stdout: new TestcaseIo({ data: 'out' }),
        stderr: null,
        msg: null,
      });

      expect(dto.verdict).toEqual({
        ...Verdicts[VerdictName.timeLimitExceed],
        fullName: 'Time Limit Exceed',
      });
      expect(dto.timeMs).toBe(1000);
      expect(dto.stdout).toEqual({ type: 'string', data: 'out' });
      expect(dto.stderr).toBeNull();
    });

    it('should leave missing fields undefined for partial results', () => {
      expect(mapper.testcaseResultToDto({})).toEqual({
        verdict: undefined,
        timeMs: undefined,
        memoryMb: undefined,
        stdout: undefined,
        stderr: undefined,
        msg: undefined,
      });
    });
  });

  describe('stressTestToDto', () => {
    it('should serialize an idle stress test', () => {
      const problem = new Problem('stress', '/src/main.cpp');
      const dto = mapper.stressTestToDto(problem.stressTest);

      expect(dto).toEqual({
        generator: null,
        bruteForce: null,
        isRunning: false,
        msg: 'Stress Test is Idle',
      });
    });

    it('should serialize a running stress test with interpolated message', () => {
      const stressTest = new StressTest(
        { path: '/gen.cpp', hash: 'g' },
        { path: '/bf.cpp', hash: 'b' },
        5,
        StressTestState.generating,
      );

      const dto = mapper.stressTestToDto(stressTest);
      expect(dto.generator).toEqual({ path: '/gen.cpp', base: 'gen.cpp' });
      expect(dto.bruteForce).toEqual({ path: '/bf.cpp', base: 'bf.cpp' });
      expect(dto.isRunning).toBe(true);
      expect(dto.msg).toBe('Generating Data (5)...');
    });

    it.each<[StressTestState, boolean, string]>([
      [StressTestState.compiling, true, 'Compiling...'],
      [StressTestState.compilationError, false, 'Compilation Error'],
      [StressTestState.runningBruteForce, true, 'Running Brute Force (5)...'],
      [StressTestState.runningSolution, true, 'Running Solution (5)...'],
      [StressTestState.foundDifference, false, 'Difference found at case 5'],
      [StressTestState.internalError, false, 'Internal Error'],
    ])('should map state %s to msg "%s"', (state, isRunning, msg) => {
      const stressTest = new StressTest(null, null, 5, state);
      const dto = mapper.stressTestToDto(stressTest);

      expect(dto.isRunning).toBe(isRunning);
      expect(dto.msg).toBe(msg);
    });

    it('should keep undefined state as undefined message for partial stress tests', () => {
      const dto = mapper.stressTestToDto({});
      expect(dto.msg).toBeUndefined();
      expect(dto.isRunning).toBe(false);
      expect(dto.generator).toBeUndefined();
      expect(dto.bruteForce).toBeUndefined();
    });
  });

  describe('overrideToDto via toDto', () => {
    it('should use settings defaults when no overrides are set', () => {
      const problem = new Problem('defaults', '/src/main.cpp');
      const dto = mapper.toDto(problem);

      expect(dto.overrides.timeLimitMs).toEqual({ defaultValue: 1000, override: null });
      expect(dto.overrides.memoryLimitMb).toEqual({ defaultValue: 512, override: null });
    });

    it('should omit language fields when the language is unknown', () => {
      langRegistryMock.getLangByFile.mockReturnValue(undefined);
      const problem = new Problem('no-lang', '/src/main.txt');
      const dto = mapper.toDto(problem);

      expect(dto.overrides.compiler).toBeUndefined();
      expect(dto.overrides.compilerArgs).toBeUndefined();
      expect(dto.overrides.interpreter).toBeUndefined();
      expect(dto.overrides.interpreterArgs).toBeUndefined();
    });

    it('should include language defaults when the language is known', () => {
      langRegistryMock.getLangByFile.mockReturnValue(makeLang());
      const problem = new Problem('with-lang', '/src/main.cpp');
      const dto = mapper.toDto(problem);

      expect(dto.overrides.compiler).toEqual({ defaultValue: 'g++', override: null });
      expect(dto.overrides.compilerArgs).toEqual({
        defaultValue: '-O2 -std=c++14',
        override: null,
      });
      // interpreter is not defined for this language
      expect(dto.overrides.interpreter).toBeUndefined();
      expect(dto.overrides.interpreterArgs).toBeUndefined();
    });

    it('should prefer problem overrides over settings defaults', () => {
      langRegistryMock.getLangByFile.mockReturnValue(makeLang());
      const problem = new Problem('override', '/src/main.cpp');
      problem.overrides = {
        timeLimitMs: 2000,
        memoryLimitMb: 256,
        compiler: 'clang++',
        compilerArgs: '-O3',
        interpreter: null,
        interpreterArgs: null,
      };

      const dto = mapper.toDto(problem);
      expect(dto.overrides.timeLimitMs).toEqual({ defaultValue: 1000, override: 2000 });
      expect(dto.overrides.memoryLimitMb).toEqual({ defaultValue: 512, override: 256 });
      expect(dto.overrides.compiler).toEqual({ defaultValue: 'g++', override: 'clang++' });
      expect(dto.overrides.compilerArgs).toEqual({
        defaultValue: '-O2 -std=c++14',
        override: '-O3',
      });
    });
  });

  describe('getVerdict via testcaseResultToDto', () => {
    it('should map every verdict to a Verdict with fullName', () => {
      for (const verdict of Object.values(VerdictName)) {
        const dto = mapper.testcaseResultToDto({ verdict });
        expect(dto.verdict?.name).toBe(verdict);
        expect(dto.verdict?.fullName).toBeTruthy();
        expect(dto.verdict?.type).toBe(Verdicts[verdict].type);
        expect(dto.verdict?.color).toBe(Verdicts[verdict].color);
      }
    });
  });
});
