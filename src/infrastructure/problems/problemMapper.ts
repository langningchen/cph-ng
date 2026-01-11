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
import { BfCompare } from '@/domain/entities/bfCompare';
import { Problem } from '@/domain/entities/problem';
import { Tc } from '@/domain/entities/tc';
import { type IBfCompare, type IProblem, type ITc, type ITcIo, TcIo } from '@/domain/types';

@injectable()
export class ProblemMapper {
  constructor(@inject(TOKENS.version) private readonly version: string) {}

  public toDTO(entity: Problem): IProblem {
    const tcs: Record<UUID, ITc> = {};
    for (const id of entity.tcOrder) tcs[id] = this.tcToDTO(entity.tcs[id]);
    return {
      version: this.version,
      name: entity.name,
      url: entity.url,
      tcs,
      tcOrder: [...entity.tcOrder],
      src: entity.src,
      checker: entity.checker,
      interactor: entity.interactor,
      bfCompare: entity.bfCompare ? this.bfCompareToDTO(entity.bfCompare) : undefined,
      timeElapsedMs: entity.timeElapsedMs,
      overrides: { ...entity.overrides },
    };
  }

  public toEntity(dto: IProblem): Problem {
    const problem = new Problem(dto.name, dto.src.path);
    problem.url = dto.url;
    for (const id of dto.tcOrder) problem.addTc(id, this.tcToEntity(dto.tcs[id]));
    problem.checker = dto.checker;
    problem.interactor = dto.interactor;
    if (dto.bfCompare) problem.bfCompare = this.bfCompareToEntity(dto.bfCompare);
    problem.addTimeElapsed(dto.timeElapsedMs);
    problem.overrides = dto.overrides;
    return problem;
  }

  private tcIoToDTO(tcIo: TcIo): ITcIo {
    return tcIo.match<ITcIo>(
      (path) => ({ path }),
      (data) => ({ data }),
    );
  }

  private tcIoToEntity(dto: ITcIo): TcIo {
    return new TcIo(dto);
  }

  private tcToDTO(tc: Tc): ITc {
    return {
      stdin: this.tcIoToDTO(tc.stdin),
      answer: this.tcIoToDTO(tc.answer),
      isExpand: tc.isExpand,
      isDisabled: tc.isDisabled,
      result: tc.verdict
        ? {
            verdict: tc.verdict,
            time: tc.time,
            memory: tc.memory,
            stdout: tc.stdout ? this.tcIoToDTO(tc.stdout) : undefined,
            stderr: tc.stderr ? this.tcIoToDTO(tc.stderr) : undefined,
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
            time: dto.result.time,
            memory: dto.result.memory,
            stdout: dto.result.stdout ? this.tcIoToEntity(dto.result.stdout) : undefined,
            stderr: dto.result.stderr ? this.tcIoToEntity(dto.result.stderr) : undefined,
            msg: dto.result.msg,
          }
        : undefined,
    );
  }

  private bfCompareToEntity(dto: IBfCompare): BfCompare {
    const bfCompare = new BfCompare();
    bfCompare.generator = dto.generator;
    bfCompare.bruteForce = dto.bruteForce;
    bfCompare.cnt = dto.cnt;
    bfCompare.state = dto.state;
    return bfCompare;
  }

  private bfCompareToDTO(bfCompare: BfCompare): IBfCompare {
    return {
      generator: bfCompare.generator,
      bruteForce: bfCompare.bruteForce,
      cnt: bfCompare.cnt,
      state: bfCompare.state,
    };
  }
}
