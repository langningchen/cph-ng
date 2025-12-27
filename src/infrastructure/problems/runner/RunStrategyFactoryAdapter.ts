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
  IRunStrategyFactory,
  RunStrategyType,
} from '@/application/ports/problems/IRunStrategyFactory';
import { ExternalRunnerStrategy } from '@/infrastructure/problems/runner/strategies/ExternalRunnerStrategy';
import type { IRunStrategy } from '@/infrastructure/problems/runner/strategies/IRunStrategy';
import { NormalStrategy } from '@/infrastructure/problems/runner/strategies/NormalStrategy';
import { WrapperStrategy } from '@/infrastructure/problems/runner/strategies/WrapperStrategy';

@injectable()
export class RunStrategyFactoryAdapter implements IRunStrategyFactory {
  public create(type: RunStrategyType): IRunStrategy {
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
