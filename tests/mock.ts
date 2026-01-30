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

import type { DeepPartial } from 'ts-essentials';
import { mock as baseMock, type MockProxy } from 'vitest-mock-extended';

export const mock = <T>(defaultValue: DeepPartial<T> = {} as DeepPartial<T>): MockProxy<T> & T => {
  return baseMock<T>(defaultValue, {
    fallbackMockImplementation: () => {
      throw new Error('Mock method called but no implementation was provided.');
    },
  });
};
