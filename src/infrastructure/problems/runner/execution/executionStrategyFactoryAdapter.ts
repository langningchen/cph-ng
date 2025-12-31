// Copyright (C) 2025 Langning Chen
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

import { container, injectable } from 'tsyringe';
import type {
  ExecutionStrategyType,
  IExecutionStrategyFactory,
} from '@/application/ports/problems/runner/execution/IExecutionStrategyFactory';
import type { IExecutionStrategy } from '@/application/ports/problems/runner/execution/strategies/IExecutionStrategy';
import { ExternalRunnerStrategy } from '@/infrastructure/problems/runner/execution/strategies/externalRunnerStrategy';
import { NormalStrategy } from '@/infrastructure/problems/runner/execution/strategies/normalStrategy';
import { WrapperStrategy } from '@/infrastructure/problems/runner/execution/strategies/wrapperStrategy';

@injectable()
export class ExecutionStrategyFactoryAdapter
  implements IExecutionStrategyFactory
{
  public create(type: ExecutionStrategyType): IExecutionStrategy {
    switch (type) {
      case 'external':
        return container.resolve(ExternalRunnerStrategy);
      case 'wrapper':
        return container.resolve(WrapperStrategy);
      case 'normal':
        return container.resolve(NormalStrategy);
      default:
        throw new Error(`Unknown strategy type: ${type}`);
    }
  }
}
