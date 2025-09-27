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

import { TC } from '../utils/types';

export interface CreateProblemMsg {
    type: 'createProblem';
}
export interface ImportProblemMsg {
    type: 'importProblem';
}
export interface GetProblemMsg {
    type: 'getProblem';
}
export interface EditProblemDetailsMsg {
    type: 'editProblemDetails';
    title: string;
    url: string;
    timeLimit: number;
    memoryLimit: number;
}
export interface DelProblemMsg {
    type: 'delProblem';
}
export interface RunTcsMsg {
    type: 'runTcs';
    compile: boolean | null;
}
export interface StopTcsMsg {
    type: 'stopTcs';
    onlyOne: boolean;
}
export interface AddTcMsg {
    type: 'addTc';
}
export interface LoadTcsMsg {
    type: 'loadTcs';
}
export interface RunTcMsg {
    type: 'runTc';
    idx: number;
    compile: boolean | null;
}
export interface ChooseTcFileMsg {
    type: 'chooseTcFile';
    idx: number;
    label: 'stdin' | 'answer';
}
export interface UpdateTcMsg {
    type: 'updateTc';
    idx: number;
    tc: TC;
}
export interface CompareTcMsg {
    type: 'compareTc';
    idx: number;
}
export interface ToggleTcFileMsg {
    type: 'toggleTcFile';
    idx: number;
    label: 'stdin' | 'answer' | 'stdout' | 'stderr';
}
export interface DelTcMsg {
    type: 'delTc';
    idx: number;
}
export interface OpenFileMsg {
    type: 'openFile';
    path: string;
}
export type FileTypes = 'checker' | 'interactor' | 'generator' | 'bruteForce';
export interface ChooseFileMsg {
    type: 'chooseFile';
    file: FileTypes;
}
export interface RemoveFileMsg {
    type: 'removeFile';
    file: FileTypes;
}
export interface StartBfCompareMsg {
    type: 'startBfCompare';
    compile: boolean | null;
}
export interface StopBfCompareMsg {
    type: 'stopBfCompare';
}
export interface SubmitToCodeforcesMsg {
    type: 'submitToCodeforces';
}
export interface StartChatMsg {
    type: 'startChat';
}
export interface OpenSettingsMsg {
    type: 'openSettings';
    item: string;
}
