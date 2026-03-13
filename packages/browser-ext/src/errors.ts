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

import { t } from './i18n';

export class ElementError extends Error {
  public readonly name = 'elementError';
  public constructor(public readonly selector: string) {
    super();
  }
  public toString() {
    return t('elementErrorMessage', [this.selector]);
  }
}

export class ExtractError extends Error {
  public readonly name = 'extractError';
  public constructor(public readonly key: string) {
    super();
  }
  public toString() {
    return t('extractErrorMessage', [this.key]);
  }
}

export class InternalError extends Error {
  public readonly name = 'internalError';
  public constructor(public readonly message: string) {
    super();
  }
  public toString() {
    return `${t('internalErrorMessage')}\n\n${this.message}`;
  }
}
