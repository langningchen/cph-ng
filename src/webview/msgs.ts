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

export interface BaseMsg {
    type: string;
    activePath?: string;
}

export interface CreateProblemMsg extends BaseMsg {
    type: 'createProblem';
}
export interface ImportProblemMsg extends BaseMsg {
    type: 'importProblem';
}
export interface InitMsg extends BaseMsg {
    type: 'init';
}
export interface EditProblemDetailsMsg extends BaseMsg {
    type: 'editProblemDetails';
    title: string;
    url: string;
    timeLimit: number;
    memoryLimit: number;
    compilationSettings?: {
        compiler?: string;
        compilerArgs?: string;
        runner?: string;
        runnerArgs?: string;
    };
}
export interface DelProblemMsg extends BaseMsg {
    type: 'delProblem';
}
export interface RunTcsMsg extends BaseMsg {
    type: 'runTcs';
    compile: boolean | null;
}
export interface StopTcsMsg extends BaseMsg {
    type: 'stopTcs';
    onlyOne: boolean;
}
export interface AddTcMsg extends BaseMsg {
    type: 'addTc';
}
export interface LoadTcsMsg extends BaseMsg {
    type: 'loadTcs';
}
export interface RunTcMsg extends BaseMsg {
    type: 'runTc';
    idx: number;
    compile: boolean | null;
}
export interface ClearTcStatusMsg extends BaseMsg {
    type: 'clearTcStatus';
    idx: number;
}
export interface ClearStatusMsg extends BaseMsg {
    type: 'clearStatus';
}
export type WebviewTcFileTypes = 'stdin' | 'answer';
export interface ChooseTcFileMsg extends BaseMsg {
    type: 'chooseTcFile';
    idx: number;
    label: WebviewTcFileTypes;
}
export interface UpdateTcMsg extends BaseMsg {
    type: 'updateTc';
    idx: number;
    tc: TC;
}
export interface CompareTcMsg extends BaseMsg {
    type: 'compareTc';
    idx: number;
}
export interface ToggleTcFileMsg extends BaseMsg {
    type: 'toggleTcFile';
    idx: number;
    label: WebviewTcFileTypes;
}
export interface DelTcMsg extends BaseMsg {
    type: 'delTc';
    idx: number;
}
export interface ReorderTcMsg extends BaseMsg {
    type: 'reorderTc';
    fromIdx: number;
    toIdx: number;
}
export interface OpenFileMsg extends BaseMsg {
    type: 'openFile';
    path: string;
    isVirtual?: boolean;
}
export type WebviewSrcFileTypes =
    | 'checker'
    | 'interactor'
    | 'generator'
    | 'bruteForce';
export interface ChooseSrcFileMsg extends BaseMsg {
    type: 'chooseSrcFile';
    fileType: WebviewSrcFileTypes;
}
export interface RemoveSrcFileMsg extends BaseMsg {
    type: 'removeSrcFile';
    fileType: WebviewSrcFileTypes;
}
export interface StartBfCompareMsg extends BaseMsg {
    type: 'startBfCompare';
    compile: boolean | null;
}
export interface StopBfCompareMsg extends BaseMsg {
    type: 'stopBfCompare';
}
export interface SubmitToCodeforcesMsg extends BaseMsg {
    type: 'submitToCodeforces';
}
export interface StartChatMsg extends BaseMsg {
    type: 'startChat';
}
export interface OpenSettingsMsg extends BaseMsg {
    type: 'openSettings';
    item: string;
}
export interface DebugTcMsg extends BaseMsg {
    type: 'debugTc';
    idx: number;
}
export type WebviewMsg =
    | CreateProblemMsg
    | ImportProblemMsg
    | InitMsg
    | EditProblemDetailsMsg
    | DelProblemMsg
    | RunTcsMsg
    | StopTcsMsg
    | AddTcMsg
    | LoadTcsMsg
    | RunTcMsg
    | ClearTcStatusMsg
    | ClearStatusMsg
    | ChooseTcFileMsg
    | UpdateTcMsg
    | CompareTcMsg
    | ToggleTcFileMsg
    | DelTcMsg
    | ReorderTcMsg
    | OpenFileMsg
    | ChooseSrcFileMsg
    | RemoveSrcFileMsg
    | StartBfCompareMsg
    | StopBfCompareMsg
    | SubmitToCodeforcesMsg
    | StartChatMsg
    | OpenSettingsMsg
    | DebugTcMsg;
