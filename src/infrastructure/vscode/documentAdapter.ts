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

import { window } from 'vscode';
import type { IDocument } from '@/application/ports/vscode/IDocument';

export class DocumentAdapter implements IDocument {
  private waitUntil = async (check: () => boolean) => {
    return new Promise<void>((resolve, _reject) => {
      if (check()) {
        resolve();
        return;
      }
      const intervalId = setInterval(() => {
        if (check()) {
          clearInterval(intervalId);
          resolve();
        }
      }, 50);
    });
  };

  public async save(path: string): Promise<void> {
    path = path.toLowerCase();
    const editor = window.visibleTextEditors.find(
      (editor) => editor.document.fileName?.toLowerCase() === path,
    );
    if (editor) {
      await editor.document.save();
      await this.waitUntil(() => !editor.document.isDirty);
    }
  }
}
