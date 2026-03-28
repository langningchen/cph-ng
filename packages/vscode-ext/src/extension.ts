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

import 'reflect-metadata';
import { install } from 'source-map-support';
import { container } from 'tsyringe';
import type { ExtensionContext } from 'vscode';
import { setupContainer } from '@/composition/container';
import { ExtensionManager } from '@/infrastructure/vscode/extensionManager';

install();
let extensionManager: ExtensionManager | null = null;
export const activate = async (context: ExtensionContext) => {
  await setupContainer(context);
  extensionManager = container.resolve(ExtensionManager);
  await extensionManager.activate(context);
};
export const deactivate = async () => {
  await extensionManager?.deactivate();
};
