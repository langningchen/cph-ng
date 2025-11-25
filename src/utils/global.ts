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

import { TextEditor, Uri } from 'vscode';
import ProblemFs from '../modules/problems/problemFs';
import SidebarProvider from '../modules/sidebar';

export let extensionUri: Uri;
export let extensionPath: string;
export const setExtensionUri = (uri: Uri) => {
    extensionUri = uri;
    extensionPath = uri.fsPath;
};
export const problemFs = new ProblemFs();
export const sidebarProvider = new SidebarProvider();

let _activePath: string | undefined;
export const setActivePath = (textEditor?: TextEditor) => {
    if (!textEditor) {
        _activePath = undefined;
    } else {
        const activeUri = textEditor.document.uri;
        if (activeUri.scheme !== 'file') {
            return;
        }
        _activePath = activeUri.fsPath;
    }
};
export const getActivePath = () => _activePath;

export const waitUntil = async (check: () => boolean) => {
    return new Promise<void>((resolve, _reject) => {
        if (check()) {
            resolve();
        }
        const intervalId = setInterval(() => {
            if (check()) {
                clearInterval(intervalId);
                resolve();
            }
        }, 50);
    });
};
