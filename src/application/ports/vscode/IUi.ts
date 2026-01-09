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

import type {
  OpenDialogOptions,
  QuickPickItem,
  QuickPickOptions,
  SaveDialogOptions,
  Uri,
} from 'vscode';

export type CustomOpenDialogOptions = Omit<OpenDialogOptions, 'defaultUri'> & {
  defaultPath?: string;
};

export type CustomSaveDialogOptions = Omit<SaveDialogOptions, 'defaultUri'> & {
  defaultPath?: string;
};

export type CustomQuickPickItem<T> = Omit<QuickPickItem, 'iconPath' | 'buttons'> & { value: T };
export type CustomQuickPickOptions = Omit<QuickPickOptions, 'canPickMany'>;

export type AlertLevel = 'warn';

export interface IUi {
  openDialog(options: CustomOpenDialogOptions): Promise<string | undefined>;
  saveDialog(options: CustomSaveDialogOptions): Promise<string | undefined>;
  confirm(title: string): Promise<boolean>;
  quickPick<T>(
    items: CustomQuickPickItem<T>[],
    options: CustomQuickPickOptions,
  ): Promise<T | undefined>;
  quickPickMany<T>(items: CustomQuickPickItem<T>[], options?: CustomQuickPickOptions): Promise<T[]>;
  chooseFolder(title: string): Promise<string | undefined>;
  alert(level: AlertLevel, title: string): void;
  compareFiles(left: Uri, right: Uri): void;
}
