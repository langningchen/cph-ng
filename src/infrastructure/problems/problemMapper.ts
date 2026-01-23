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

import type { UUID } from 'node:crypto';
import { inject, injectable } from 'tsyringe';
import { TOKENS } from '@/composition/tokens';
import { Problem } from '@/domain/entities/problem';
import { StressTest } from '@/domain/entities/stressTest';
import { Tc } from '@/domain/entities/tc';
import { TcIo } from '@/domain/entities/tcIo';
import type { IProblem, IStressTest, ITc, ITcIo } from '@/domain/types';

@injectable()
export class ProblemMapper {
  public constructor(@inject(TOKENS.version) private readonly version: string) {}

  public toDto(entity: Problem): IProblem {
    const tcs: Record<UUID, ITc> = {};
    for (const id of entity.tcOrder) {
      const tc = entity.tcs.get(id);
      if (tc) tcs[id] = this.tcToDto(tc);
    }
    return {
      version: this.version,
      name: entity.name,
      url: entity.url,
      tcs,
      tcOrder: [...entity.tcOrder],
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
    problem.url = dto.url;
    for (const id of dto.tcOrder) {
      const tc = dto.tcs[id];
      if (tc) problem.addTc(id, this.tcToEntity(tc));
    }
    problem.checker = dto.checker;
    problem.interactor = dto.interactor;
    if (dto.stressTest) problem.stressTest = this.stressTestToEntity(dto.stressTest);
    problem.addTimeElapsed(dto.timeElapsedMs);
    problem.overrides = dto.overrides;
    return problem;
  }

  private tcIoToDto(tcIo: TcIo): ITcIo {
    return tcIo.match<ITcIo>(
      (path) => ({ path }),
      (data) => ({ data }),
    );
  }
  private tcIoToEntity(dto: ITcIo): TcIo {
    return new TcIo(dto);
  }

  private tcToDto(tc: Tc): ITc {
    return {
      stdin: this.tcIoToDto(tc.stdin),
      answer: this.tcIoToDto(tc.answer),
      isExpand: tc.isExpand,
      isDisabled: tc.isDisabled,
      result: tc.verdict
        ? {
            verdict: tc.verdict,
            timeMs: tc.timeMs,
            memoryMb: tc.memoryMb,
            stdout: tc.stdout ? this.tcIoToDto(tc.stdout) : undefined,
            stderr: tc.stderr ? this.tcIoToDto(tc.stderr) : undefined,
            msg: tc.msg,
          }
        : undefined,
    };
  }
  private tcToEntity(dto: ITc): Tc {
    return new Tc(
      this.tcIoToEntity(dto.stdin),
      this.tcIoToEntity(dto.answer),
      dto.isExpand,
      dto.isDisabled,
      dto.result
        ? {
            verdict: dto.result.verdict,
            timeMs: dto.result.timeMs,
            memoryMb: dto.result.memoryMb,
            stdout: dto.result.stdout ? this.tcIoToEntity(dto.result.stdout) : undefined,
            stderr: dto.result.stderr ? this.tcIoToEntity(dto.result.stderr) : undefined,
            msg: dto.result.msg,
          }
        : undefined,
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
