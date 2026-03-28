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

import type { IProblem, IStressTest, ITestcase, ITestcaseIo, TestcaseId } from '@cph-ng/core';
import { inject, injectable } from 'tsyringe';
import { TOKENS } from '@/composition/tokens';
import { Problem } from '@/domain/entities/problem';
import { StressTest } from '@/domain/entities/stressTest';
import { Testcase } from '@/domain/entities/testcase';
import { TestcaseIo } from '@/domain/entities/testcaseIo';

@injectable()
export class ProblemMapper {
  public constructor(@inject(TOKENS.version) private readonly version: string) {}

  public toDto(entity: Problem): IProblem {
    const testcases: Record<TestcaseId, ITestcase> = {};
    for (const testcaseId of entity.testcaseOrder) {
      const testcase = entity.testcases.get(testcaseId);
      if (testcase) testcases[testcaseId] = this.testcaseToDto(testcase);
    }
    return {
      version: this.version,
      name: entity.name,
      url: entity.url,
      testcases,
      testcaseOrder: [...entity.testcaseOrder],
      src: entity.src,
      checker: entity.checker,
      interactor: entity.interactor,
      stressTest: this.stressTestToDto(entity.stressTest),
      timeElapsedMs: entity.timeElapsedMs,
      overrides: { ...entity.overrides },
    };
  }
  public toEntity(dto: IProblem): Problem {
    const problem = new Problem(dto.name, dto.src.path);
    problem.src.hash = dto.src.hash;
    problem.url = dto.url;
    for (const testcaseId of dto.testcaseOrder) {
      const testcase = dto.testcases[testcaseId];
      if (testcase) problem.addTestcase(testcaseId, this.testcaseToEntity(testcase));
    }
    problem.checker = dto.checker;
    problem.interactor = dto.interactor;
    if (dto.stressTest) problem.stressTest = this.stressTestToEntity(dto.stressTest);
    problem.addTimeElapsed(dto.timeElapsedMs);
    problem.overrides = dto.overrides;
    return problem;
  }

  private testcaseIoToDto(testcaseIo: TestcaseIo): ITestcaseIo {
    return testcaseIo.match<ITestcaseIo>(
      (path) => ({ path }),
      (data) => ({ data }),
    );
  }
  private testcaseIoToEntity(dto: ITestcaseIo): TestcaseIo {
    return new TestcaseIo(dto);
  }

  private testcaseToDto(testcase: Testcase): ITestcase {
    return {
      stdin: this.testcaseIoToDto(testcase.stdin),
      answer: this.testcaseIoToDto(testcase.answer),
      isExpand: testcase.isExpand,
      isDisabled: testcase.isDisabled,
      result: testcase.result?.verdict
        ? {
            verdict: testcase.result.verdict,
            timeMs: testcase.result.timeMs,
            memoryMb: testcase.result.memoryMb,
            stdout: testcase.result.stdout ? this.testcaseIoToDto(testcase.result.stdout) : null,
            stderr: testcase.result.stderr ? this.testcaseIoToDto(testcase.result.stderr) : null,
            msg: testcase.result.msg,
          }
        : null,
    };
  }
  private testcaseToEntity(dto: ITestcase): Testcase {
    return new Testcase(
      this.testcaseIoToEntity(dto.stdin),
      this.testcaseIoToEntity(dto.answer),
      dto.isExpand,
      dto.isDisabled,
      dto.result
        ? {
            verdict: dto.result.verdict,
            timeMs: dto.result.timeMs,
            memoryMb: dto.result.memoryMb,
            stdout: dto.result.stdout ? this.testcaseIoToEntity(dto.result.stdout) : null,
            stderr: dto.result.stderr ? this.testcaseIoToEntity(dto.result.stderr) : null,
            msg: dto.result.msg,
          }
        : null,
    );
  }

  private stressTestToDto(stressTest: StressTest): IStressTest {
    return {
      generator: stressTest.generator,
      bruteForce: stressTest.bruteForce,
      cnt: stressTest.cnt,
      state: stressTest.state,
    };
  }
  private stressTestToEntity(dto: IStressTest): StressTest {
    return new StressTest(dto.generator, dto.bruteForce, dto.cnt, dto.state);
  }
}
