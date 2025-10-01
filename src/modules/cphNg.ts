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

import AdmZip from 'adm-zip';
import {
    access,
    constants,
    mkdir,
    readdir,
    readFile,
    unlink,
    writeFile,
} from 'fs/promises';
import { orderBy } from 'natural-orderby';
import { basename, dirname, extname, join, relative } from 'path';
import * as vscode from 'vscode';
import { version } from '../../package.json';
import { Lang, LangCompileResult } from '../core/langs/lang';
import Langs from '../core/langs/langs';
import { Runner } from '../core/runner';
import FolderChooser from '../helpers/folderChooser';
import Io from '../helpers/io';
import Logger from '../helpers/logger';
import Problems from '../helpers/problems';
import {
    buildEmbeddedBlock,
    EMBEDDED_FOOTER,
    EMBEDDED_HEADER,
} from '../utils/embedded';
import Result from '../utils/result';
import { renderTemplate } from '../utils/strTemplate';
import {
    EmbeddedProblem,
    isExpandVerdict,
    isRunningVerdict,
    Problem,
    TC,
} from '../utils/types';
import { tcIo2Path, tcIo2Str, TCVerdicts } from '../utils/types.backend';
import { FileTypes } from '../webview/msgs';
import CphCapable from './cphCapable';
import Settings from './settings';

type ProblemChangeCallback = (
    problem: Problem | undefined,
    canImport: boolean,
    startTime: number | undefined,
) => void;

export type CompileResult = Result<{
    src: NonNullable<LangCompileResult['data']>;
    checker?: NonNullable<LangCompileResult['data']>;
    interactor?: NonNullable<LangCompileResult['data']>;
}>;

export default class CphNg {
    private static logger: Logger = new Logger('cphNg');
    private static _problem?: Problem;
    private static _startTime?: number;
    private static _canImport: boolean = false;
    private static onProblemChange: ProblemChangeCallback[] = [];
    private static runAbortController?: AbortController;

    static get problem(): Problem | undefined {
        return CphNg._problem;
    }
    static set problem(problem: Problem | undefined) {
        CphNg._problem && CphNg.saveProblem();
        CphNg.runAbortController && CphNg.runAbortController.abort();
        CphNg._problem = problem;
        CphNg._startTime = problem ? Date.now() : undefined;
        CphNg.emitProblemChange();
    }

    static get canImport(): boolean {
        return CphNg._canImport;
    }
    static set canImport(canImport: boolean) {
        CphNg._canImport = canImport;
        CphNg.emitProblemChange();
    }
    public static addProblemChangeListener(callback: ProblemChangeCallback) {
        CphNg.onProblemChange.push(callback);
    }
    public static emitProblemChange() {
        for (const callback of CphNg.onProblemChange) {
            callback(CphNg._problem, CphNg._canImport, CphNg._startTime);
        }
    }

    public static checkProblem() {
        CphNg.logger.trace('checkProblem');
        if (!CphNg._problem) {
            CphNg.logger.warn('No problem found');
            Io.warn(
                vscode.l10n.t(
                    'No problem found. Please create a problem first.',
                ),
            );
            return false;
        }
        CphNg.logger.debug('Problem exists', { problem: CphNg._problem });
        return true;
    }
    public static checkIdx(idx: number) {
        CphNg.logger.trace('checkIdx', { idx });
        const problem = CphNg._problem!;
        const max = problem.tcs.length - 1;
        if (idx < 0 || idx > max) {
            CphNg.logger.warn('Test case idx out of range', { idx, max });
            Io.warn(
                vscode.l10n.t('Test case index {idx} out of range 0~{max}.', {
                    idx,
                    max,
                }),
            );
            return false;
        }
        CphNg.logger.debug('Test case idx is valid', { idx });
        return true;
    }

    private static async compile(
        lang: Lang,
        compile: boolean | null,
    ): Promise<CompileResult> {
        try {
            const problem = CphNg._problem!;
            const editor = vscode.window.visibleTextEditors.find(
                (editor) => editor.document.fileName === problem.src.path,
            );
            if (editor) {
                await editor.document.save();
            }

            const result = await lang.compile(
                problem.src,
                CphNg.runAbortController!,
                compile,
                { canUseWrapper: true },
            );
            if (result.verdict !== TCVerdicts.UKE) {
                return { ...result, data: undefined };
            }
            problem.src.hash = result.data!.hash;
            const data: CompileResult['data'] = {
                src: result.data!,
            };
            if (problem.checker) {
                const checkerLang = Langs.getLang(problem.checker.path, true);
                if (!checkerLang) {
                    data.checker = {
                        outputPath: problem.checker.path,
                        hash: '',
                    };
                } else {
                    const checkerResult = await checkerLang.compile(
                        problem.checker,
                        CphNg.runAbortController!,
                        compile,
                    );
                    if (checkerResult.verdict !== TCVerdicts.UKE) {
                        return { ...checkerResult, data };
                    }
                    problem.checker.hash = checkerResult.data!.hash;
                    data.checker = checkerResult.data!;
                }
            }
            if (problem.interactor) {
                const interactorLang = Langs.getLang(
                    problem.interactor.path,
                    true,
                );
                if (!interactorLang) {
                    data.interactor = {
                        outputPath: problem.interactor.path,
                        hash: '',
                    };
                } else {
                    const interactorResult = await interactorLang.compile(
                        problem.interactor,
                        CphNg.runAbortController!,
                        compile,
                    );
                    if (interactorResult.verdict !== TCVerdicts.UKE) {
                        return { ...interactorResult, data };
                    }
                    problem.interactor.hash = interactorResult.data!.hash;
                    data.interactor = interactorResult.data!;
                }
            }
            return {
                verdict: TCVerdicts.UKE,
                msg: '',
                data,
            };
        } catch (e) {
            return {
                verdict: TCVerdicts.SE,
                msg: (e as Error).message,
            };
        }
    }

    public static async createProblem(): Promise<void> {
        try {
            const activeEditor = vscode.window.activeTextEditor;
            if (!activeEditor) {
                Io.warn(
                    vscode.l10n.t(
                        'No active editor found. Please open a file to create a problem.',
                    ),
                );
                return;
            }
            const filePath = activeEditor.document.fileName;
            if (CphNg._problem && CphNg._problem.src.path === filePath) {
                Io.warn(
                    vscode.l10n.t(
                        'Problem already exists for this file: {file}.',
                        { file: basename(filePath) },
                    ),
                );
                return;
            }
            CphNg.problem = {
                version,
                name: basename(filePath, extname(filePath)),
                src: { path: filePath },
                tcs: [],
                timeLimit: Settings.problem.defaultTimeLimit,
                memoryLimit: Settings.problem.defaultMemoryLimit,
                timeElapsed: 0,
            };
            CphNg.saveProblem();
        } catch (e) {
            Io.error(
                vscode.l10n.t('Failed to create problem: {msg}', {
                    msg: (e as Error).message,
                }),
            );
        }
    }
    public static async importProblem(): Promise<void> {
        try {
            const activeEditor = vscode.window.activeTextEditor;
            if (!activeEditor) {
                Io.warn(
                    vscode.l10n.t(
                        'No active editor found. Please open a file to create a problem.',
                    ),
                );
                return;
            }
            const filePath = activeEditor.document.fileName;
            if (CphNg._problem && CphNg._problem.src.path === filePath) {
                Io.warn(
                    vscode.l10n.t(
                        'Problem already exists for this file: {file}.',
                        { file: basename(filePath) },
                    ),
                );
                return;
            }
            const probFile = CphCapable.getProbByCpp(filePath);
            try {
                await access(probFile, constants.R_OK);
                const problem = await CphCapable.loadProblem(probFile);
                if (problem) {
                    CphNg.saveProblem();
                } else {
                    Io.warn(
                        vscode.l10n.t('Failed to import file.', {
                            file: basename(filePath),
                        }),
                    );
                }
                CphNg.problem = problem;
            } catch {
                Io.warn(
                    vscode.l10n.t('File {file} does not exists.', {
                        file: probFile,
                    }),
                );
            }
        } catch (e) {
            Io.error(
                vscode.l10n.t('Failed to import problem: {msg}.', {
                    msg: (e as Error).message,
                }),
            );
        }
    }
    public static async getProblem() {
        CphNg.emitProblemChange();
    }
    public static async loadProblem(cppFile: string): Promise<void> {
        CphNg.logger.trace('loadProblem', { cppFile });
        CphNg.problem = await Problems.loadProblem(cppFile);
    }
    public static async editProblemDetails(
        title: string,
        url: string,
        timeLimit: number,
        memoryLimit: number,
    ): Promise<void> {
        if (!CphNg.checkProblem()) {
            return;
        }
        const problem = CphNg._problem!;
        problem.name = title;
        problem.url = url;
        problem.timeLimit = timeLimit;
        problem.memoryLimit = memoryLimit;
        CphNg.saveProblem();
    }
    public static async saveProblem(): Promise<void> {
        CphNg.logger.trace('saveProblem');
        if (!CphNg.checkProblem()) {
            return;
        }
        const problem = CphNg._problem!;
        CphNg.emitProblemChange();
        const currentTime = Date.now();
        problem.timeElapsed += currentTime - CphNg._startTime!;
        Problems.saveProblem(problem);
    }
    public static async exportToEmbedded(): Promise<void> {
        CphNg.logger.trace('exportToEmbedded');
        if (!CphNg.checkProblem()) {
            return;
        }
        const problem = CphNg._problem!;
        try {
            const embeddedProblem: EmbeddedProblem = {
                name: problem.name,
                url: problem.url,
                tcs: await Promise.all(
                    problem.tcs.map(async (tc) => ({
                        stdin: await tcIo2Str(tc.stdin),
                        answer: await tcIo2Str(tc.answer),
                    })),
                ),
                timeLimit: problem.timeLimit,
                memoryLimit: problem.memoryLimit,
            };
            if (problem.checker) {
                embeddedProblem.spjCode = await readFile(
                    problem.checker.path,
                    'utf-8',
                );
            }
            if (problem.interactor) {
                embeddedProblem.interactorCode = await readFile(
                    problem.interactor.path,
                    'utf-8',
                );
            }
            const cppFile = problem.src.path;
            let cppData = await readFile(cppFile, 'utf-8');
            const startIdx = cppData.indexOf(EMBEDDED_HEADER);
            const endIdx = cppData.indexOf(EMBEDDED_FOOTER);
            if (startIdx !== -1 && endIdx !== -1) {
                cppData =
                    cppData.substring(0, startIdx) +
                    cppData.substring(endIdx + EMBEDDED_FOOTER.length);
            }
            cppData = cppData.trim();
            cppData += buildEmbeddedBlock(embeddedProblem);
            await writeFile(cppFile, cppData);
        } catch (e) {
            Io.error(
                vscode.l10n.t('Failed to export problem: {msg}.', {
                    msg: (e as Error).message,
                }),
            );
        }
    }
    public static async delProblem(): Promise<void> {
        CphNg.logger.trace('delProblem');
        if (!CphNg.checkProblem()) {
            return;
        }
        const problem = CphNg._problem!;
        const binPath = await Problems.getBinByCpp(problem.src.path);
        try {
            await access(binPath, constants.F_OK);
            await unlink(binPath);
            CphNg._problem = undefined;
        } catch {
            Io.warn(
                vscode.l10n.t('Problem file {file} not found.', {
                    file: basename(binPath),
                }),
            );
        } finally {
            CphNg.problem = undefined;
        }
    }
    public static async addTc(): Promise<void> {
        CphNg.logger.trace('addTestCase');
        if (!CphNg._problem) {
            return;
        }
        CphNg._problem.tcs.push({
            stdin: { useFile: false, data: '' },
            answer: { useFile: false, data: '' },
            isExpand: false,
        });
        CphNg.saveProblem();
    }
    public static async loadTcs(): Promise<void> {
        CphNg.logger.trace('loadTestCases');
        try {
            if (!CphNg.checkProblem()) {
                return;
            }
            const problem = CphNg._problem!;

            CphNg.logger.debug('Showing test case loading options');
            const option = (
                await vscode.window.showQuickPick(
                    [
                        {
                            label: vscode.l10n.t('Load from a zip file'),
                            value: 'zip',
                        },
                        {
                            label: vscode.l10n.t('Load from a folder'),
                            value: 'folder',
                        },
                    ],
                    { canPickMany: false },
                )
            )?.value;
            if (!option) {
                CphNg.logger.debug('User cancelled test case loading');
                return;
            }
            CphNg.logger.info('User selected loading option:', option);

            let folderPath = '';
            if (option === 'zip') {
                CphNg.logger.debug('Loading test cases from zip file');
                const zipFile = await vscode.window.showOpenDialog({
                    title: vscode.l10n.t(
                        'Choose a zip file containing test cases',
                    ),
                    filters: { 'Zip files': ['zip'], 'All files': ['*'] },
                });
                if (!zipFile) {
                    CphNg.logger.debug('User cancelled zip file selection');
                    return;
                }
                const zipPath = zipFile[0].fsPath;
                CphNg.logger.info('Processing zip file:', zipPath);
                const zipData = new AdmZip(zipPath);
                const entries = zipData.getEntries();
                if (!entries.length) {
                    CphNg.logger.warn('Empty zip file');
                    Io.warn(
                        vscode.l10n.t('No test cases found in the zip file.'),
                    );
                    return;
                }
                const cppPath = problem.src.path;
                const workspaceFolder = vscode.workspace.workspaceFolders
                    ? vscode.workspace.workspaceFolders[0].uri.fsPath
                    : '';
                folderPath = renderTemplate(Settings.problem.unzipFolder, [
                    ['workspace', workspaceFolder],
                    ['dirname', dirname(cppPath)],
                    [
                        'relativeDirname',
                        relative(workspaceFolder, dirname(cppPath)),
                    ],
                    ['basename', basename(cppPath)],
                    ['extname', extname(cppPath)],
                    ['basenameNoExt', basename(cppPath, extname(cppPath))],
                    ['zipDirname', dirname(zipPath)],
                    ['zipBasename', basename(zipPath)],
                    ['zipBasenameNoExt', basename(zipPath, extname(zipPath))],
                ]);
                CphNg.logger.debug('Extracting zip to:', folderPath);
                await mkdir(folderPath, { recursive: true });
                zipData.extractAllTo(folderPath, true);
                if (Settings.problem.deleteAfterUnzip) {
                    CphNg.logger.debug('Deleting zip file:', zipPath);
                    await unlink(zipPath);
                }
            } else if (option === 'folder') {
                CphNg.logger.debug('Loading test cases from folder');
                const folderUri = await FolderChooser.chooseFolder(
                    vscode.l10n.t('Choose a folder containing test cases'),
                );
                if (!folderUri) {
                    CphNg.logger.debug('User cancelled folder selection');
                    return;
                }
                folderPath = folderUri.fsPath;
                CphNg.logger.info('Using folder:', folderPath);
            } else {
                const errorMsg = vscode.l10n.t('Unknown option: {option}.', {
                    option,
                });
                CphNg.logger.error(errorMsg);
                throw new Error(errorMsg);
            }

            async function getAllFiles(dirPath: string): Promise<string[]> {
                const entries = await readdir(dirPath, { withFileTypes: true });
                const files = await Promise.all(
                    entries.map((entry) => {
                        const fullPath = join(dirPath, entry.name);
                        return entry.isDirectory()
                            ? getAllFiles(fullPath)
                            : fullPath;
                    }),
                );
                return files.flat();
            }

            const allFiles = await getAllFiles(folderPath);
            CphNg.logger.info(`Found ${allFiles.length} files in total`);
            const tcs: TC[] = [];
            for (const filePath of allFiles) {
                const fileName = basename(filePath);
                const ext = extname(fileName).toLowerCase();
                if (ext === '.in') {
                    CphNg.logger.debug('Found input file:', fileName);
                    tcs.push({
                        stdin: { useFile: true, path: filePath },
                        answer: { useFile: false, data: '' },
                        isExpand: false,
                    });
                }
            }
            for (const filePath of allFiles) {
                const fileName = basename(filePath);
                const ext = extname(fileName).toLowerCase();
                if (ext === '.ans' || ext === '.out') {
                    CphNg.logger.debug('Found answer file:', fileName);
                    const inputFile = join(
                        dirname(filePath),
                        fileName.replace(ext, '.in'),
                    );
                    const existingTestCase = tcs.find(
                        (tc) => tc.stdin.useFile && tc.stdin.path === inputFile,
                    );
                    if (existingTestCase) {
                        existingTestCase.answer = {
                            useFile: true,
                            path: filePath,
                        };
                        CphNg.logger.debug('Matched answer with input:', {
                            input: inputFile,
                            answer: filePath,
                        });
                    } else {
                        CphNg.logger.warn(
                            'Answer file without matching input:',
                            fileName,
                        );
                        tcs.push({
                            stdin: { useFile: false, data: '' },
                            answer: { useFile: true, path: filePath },
                            isExpand: false,
                        });
                    }
                }
            }
            CphNg.logger.info(`Created ${tcs.length} test cases`);
            const orderedTcs = orderBy(tcs, [
                (it) => (it.stdin.useFile ? 0 : 1),
                (it) =>
                    it.stdin.useFile
                        ? basename(it.stdin.path)
                        : it.answer.useFile
                          ? basename(it.answer.path)
                          : '',
            ]);
            CphNg.logger.debug('Ordered test cases for selection', orderedTcs);
            const chosenIdx = await vscode.window.showQuickPick(
                orderedTcs.map((tc, idx) => ({
                    label: `${basename(
                        tc.stdin.useFile
                            ? tc.stdin.path
                            : tc.answer.useFile
                              ? tc.answer.path
                              : 'unknown',
                    )}`,
                    description: vscode.l10n.t(
                        'Input {input}, Answer {answer}',
                        {
                            input: tc.stdin.useFile
                                ? tc.stdin.path.replace(folderPath + '/', '')
                                : vscode.l10n.t('not found'),
                            answer: tc.answer.useFile
                                ? tc.answer.path.replace(folderPath + '/', '')
                                : vscode.l10n.t('not found'),
                        },
                    ),
                    value: idx,
                    picked: true,
                })),
                {
                    canPickMany: true,
                    title: vscode.l10n.t('Select test cases to add'),
                },
            );
            if (!chosenIdx) {
                CphNg.logger.debug('User cancelled test case selection');
                return;
            }
            const selectedTCs = chosenIdx.map((idx) => orderedTcs[idx.value]);
            CphNg.logger.info(`User selected ${selectedTCs.length} test cases`);
            if (Settings.problem.clearBeforeLoad) {
                problem.tcs = selectedTCs;
            } else {
                selectedTCs.forEach((tc) => {
                    problem.tcs.push(tc);
                });
            }
            CphNg.saveProblem();
        } catch (e) {
            Io.error(
                vscode.l10n.t('Failed to load test cases: {msg}', {
                    msg: (e as Error).message,
                }),
            );
        }
    }
    public static async updateTc(idx: number, tc: TC): Promise<void> {
        CphNg.logger.trace('updateTestCase', { idx, tc });
        if (!CphNg.checkProblem() || !CphNg.checkIdx(idx)) {
            return;
        }
        const problem = CphNg._problem!;
        problem.tcs[idx] = tc;
        CphNg.saveProblem();
    }
    public static async runTc(
        idx: number,
        compile: boolean | null,
    ): Promise<void> {
        CphNg.logger.trace('runTestCase', { idx });
        if (!CphNg.checkProblem() || !CphNg.checkIdx(idx)) {
            return;
        }
        const problem = CphNg._problem!;
        CphNg.runAbortController && CphNg.runAbortController.abort();
        CphNg.runAbortController = new AbortController();
        const srcLang = Langs.getLang(problem.src.path);
        if (!srcLang) {
            return;
        }

        const tc = problem.tcs[idx];
        tc.result = {
            verdict: TCVerdicts.CP,
            stdout: { useFile: false, data: '' },
            stderr: { useFile: false, data: '' },
            memory: undefined,
            time: 0,
            msg: '',
        };
        tc.isExpand = false;
        CphNg.emitProblemChange();
        const result = tc.result;

        const compileResult = await CphNg.compile(srcLang, compile);
        if (compileResult.verdict !== TCVerdicts.UKE) {
            result.verdict = TCVerdicts.CE;
            tc.isExpand = true;
            CphNg.saveProblem();
            CphNg.runAbortController = undefined;
            return;
        }
        const compileData = compileResult.data!;

        await Runner.run(
            problem,
            result,
            CphNg.runAbortController,
            srcLang,
            tc,
            compileData,
        );
        tc.isExpand = isExpandVerdict(result.verdict);
        CphNg.saveProblem();
        CphNg.runAbortController = undefined;
    }
    public static async runTcs(compile: boolean | null): Promise<void> {
        if (!CphNg.checkProblem()) {
            return;
        }
        const problem = CphNg._problem!;
        if (!problem.tcs.length) {
            return;
        }
        CphNg.runAbortController && CphNg.runAbortController.abort();
        CphNg.runAbortController = new AbortController();
        const srcLang = Langs.getLang(problem.src.path);
        if (!srcLang) {
            return;
        }
        for (const tc of problem.tcs) {
            tc.result = {
                verdict: TCVerdicts.CP,
                stdout: { useFile: false, data: '' },
                stderr: { useFile: false, data: '' },
                memory: undefined,
                time: 0,
                msg: '',
            };
            tc.isExpand = false;
        }
        CphNg.emitProblemChange();

        const compileResult = await CphNg.compile(srcLang, compile);
        if (compileResult.verdict !== TCVerdicts.UKE) {
            for (const tc of problem.tcs) {
                tc.result!.verdict = TCVerdicts.CE;
            }
            CphNg.saveProblem();
            CphNg.runAbortController = undefined;
            return;
        }
        const compileData = compileResult.data!;
        for (const tc of problem.tcs) {
            tc.result!.verdict = TCVerdicts.CPD;
        }
        CphNg.emitProblemChange();

        let hasExpandStatus = false;
        for (const tc of problem.tcs) {
            if (CphNg.runAbortController?.signal.aborted) {
                if (CphNg.runAbortController.signal.reason === 'onlyOne') {
                    CphNg.runAbortController = new AbortController();
                } else {
                    tc.result!.verdict = TCVerdicts.SK;
                    continue;
                }
            }
            await Runner.run(
                problem,
                tc.result!,
                CphNg.runAbortController,
                srcLang,
                tc,
                compileData,
            );
            if (!hasExpandStatus) {
                tc.isExpand = isExpandVerdict(tc.result!.verdict);
                CphNg.emitProblemChange();
                hasExpandStatus = tc.isExpand;
            }
        }
        CphNg.saveProblem();
        CphNg.runAbortController = undefined;
    }
    public static async stopTcs(onlyOne: boolean): Promise<void> {
        if (!CphNg.checkProblem()) {
            return;
        }
        const problem = CphNg._problem!;
        if (CphNg.runAbortController) {
            CphNg.runAbortController.abort(onlyOne ? 'onlyOne' : undefined);
        } else {
            for (const tc of problem.tcs) {
                if (isRunningVerdict(tc.result!.verdict)) {
                    tc.result!.verdict = TCVerdicts.RJ;
                }
            }
            CphNg.saveProblem();
        }
    }
    public static async chooseTcFile(
        idx: number,
        option: 'stdin' | 'answer',
    ): Promise<void> {
        try {
            if (!CphNg.checkProblem() || !CphNg.checkIdx(idx)) {
                return;
            }
            const problem = CphNg._problem!;
            const tc = problem.tcs[idx];
            const fileUri = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                title: vscode.l10n.t('Choose {type} file', {
                    type:
                        option === 'stdin'
                            ? vscode.l10n.t('stdin')
                            : vscode.l10n.t('answer'),
                }),
                filters: {
                    [vscode.l10n.t('Text files')]: ['in', 'ans', 'out'],
                    [vscode.l10n.t('All files')]: ['*'],
                },
            });
            if (fileUri && fileUri[0]) {
                const path = fileUri[0].fsPath;
                const isInput = option === 'stdin';
                const mainExt = extname(path);
                const pairExt = isInput ? ['.ans', '.out'] : ['.in'];
                tc[isInput ? 'stdin' : 'answer'] = {
                    useFile: true,
                    path,
                };
                if (Settings.problem.foundMatchTestCaseBehavior !== 'never') {
                    for (const ext of pairExt) {
                        const pairPath = path.replace(mainExt, ext);
                        if (
                            await access(pairPath, constants.F_OK)
                                .then(() => true)
                                .catch(() => false)
                        ) {
                            if (
                                Settings.problem.foundMatchTestCaseBehavior ===
                                    'always' ||
                                (await Io.confirm(
                                    vscode.l10n.t(
                                        'Found matching {found} file: {file}. Do you want to use it?',
                                        {
                                            found: vscode.l10n.t(
                                                isInput ? 'answer' : 'stdin',
                                            ),
                                            file: basename(pairPath),
                                        },
                                    ),
                                    true,
                                ))
                            ) {
                                tc[isInput ? 'answer' : 'stdin'] = {
                                    useFile: true,
                                    path: pairPath,
                                };
                                break;
                            }
                        }
                    }
                }
                CphNg.saveProblem();
            }
        } catch (e) {
            Io.error(
                vscode.l10n.t('Failed to choose test case file: {msg}', {
                    msg: (e as Error).message,
                }),
            );
        }
    }
    public static async compareTc(idx: number): Promise<void> {
        try {
            if (!CphNg.checkProblem() || !CphNg.checkIdx(idx)) {
                return;
            }
            const problem = CphNg._problem!;
            const tc = problem.tcs[idx];
            const leftFile = await tcIo2Path(tc.answer);
            const rightFile = await tcIo2Path(tc.result!.stdout);
            vscode.commands.executeCommand(
                'vscode.diff',
                vscode.Uri.file(leftFile),
                vscode.Uri.file(rightFile),
            );
        } catch (e) {
            Io.error(
                vscode.l10n.t('Failed to compare test case: {msg}', {
                    msg: (e as Error).message,
                }),
            );
        }
    }
    public static async toggleTcFile(
        idx: number,
        label: 'stdin' | 'answer' | 'stdout' | 'stderr',
    ): Promise<void> {
        if (!CphNg.checkProblem() || !CphNg.checkIdx(idx)) {
            return;
        }
        const problem = CphNg._problem!;
        const tc = problem.tcs[idx];
        const isInputOrAnswer = label === 'stdin' || label === 'answer';
        const fileIo = isInputOrAnswer ? tc[label] : tc.result![label];
        if (fileIo.useFile) {
            const data = await tcIo2Str(fileIo);
            if (
                data.length <= Settings.problem.maxInlineDataLength ||
                (await Io.confirm(
                    vscode.l10n.t(
                        'The file size is {size} bytes, which may be large. Are you sure you want to load it inline?',
                        { size: data.length },
                    ),
                    true,
                ))
            ) {
                if (isInputOrAnswer) {
                    tc[label] = { useFile: false, data };
                } else {
                    tc.result![label] = { useFile: false, data };
                }
            }
        } else {
            const ext = {
                stdin: 'in',
                answer: 'ans',
                stdout: 'out',
                stderr: 'err',
            }[label];
            const tempFilePath = await vscode.window
                .showSaveDialog({
                    defaultUri: vscode.Uri.file(
                        join(
                            dirname(problem.src.path),
                            `${basename(problem.src.path, extname(problem.src.path))}-${idx + 1}.${ext}`,
                        ),
                    ),
                    saveLabel: vscode.l10n.t('Select location to save'),
                })
                .then((uri) => (uri ? uri.fsPath : undefined));
            if (!tempFilePath) {
                return;
            }
            await writeFile(tempFilePath, fileIo.data || '');
            if (isInputOrAnswer) {
                tc[label] = { useFile: true, path: tempFilePath };
            } else {
                tc.result![label] = { useFile: true, path: tempFilePath };
            }
        }
        CphNg.saveProblem();
    }
    public static async delTc(idx: number): Promise<void> {
        if (!CphNg.checkProblem() || !CphNg.checkIdx(idx)) {
            return;
        }
        const problem = CphNg._problem!;
        problem.tcs.splice(idx, 1);
        CphNg.saveProblem();
    }
    public static async chooseFile(fileType: FileTypes): Promise<void> {
        if (!CphNg.checkProblem()) {
            return;
        }
        const problem = CphNg._problem!;
        const checkerFileUri = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            title: vscode.l10n.t('Select {fileType} File', {
                fileType: {
                    checker: vscode.l10n.t('Checker'),
                    interactor: vscode.l10n.t('Interactor'),
                    generator: vscode.l10n.t('Generator'),
                    bruteForce: vscode.l10n.t('Brute Force'),
                }[fileType],
            }),
        });
        if (!checkerFileUri) {
            return;
        }
        if (fileType === 'checker') {
            problem.checker = { path: checkerFileUri[0].fsPath };
        } else if (fileType === 'interactor') {
            problem.interactor = { path: checkerFileUri[0].fsPath };
        } else if (fileType === 'generator') {
            if (!problem.bfCompare) {
                problem.bfCompare = { running: false, msg: '' };
            }
            problem.bfCompare.generator = { path: checkerFileUri[0].fsPath };
        } else {
            if (!problem.bfCompare) {
                problem.bfCompare = { running: false, msg: '' };
            }
            problem.bfCompare.bruteForce = { path: checkerFileUri[0].fsPath };
        }
        CphNg.saveProblem();
    }
    public static async removeFile(fileType: FileTypes): Promise<void> {
        if (!CphNg.checkProblem()) {
            return;
        }
        const problem = CphNg._problem!;
        if (fileType === 'checker') {
            problem.checker = undefined;
        } else if (fileType === 'interactor') {
            problem.interactor = undefined;
        } else if (fileType === 'generator') {
            problem.bfCompare && (problem.bfCompare.generator = undefined);
        } else {
            problem.bfCompare && (problem.bfCompare.bruteForce = undefined);
        }
        CphNg.saveProblem();
    }
    public static async startBfCompare(compile: boolean | null): Promise<void> {
        if (!CphNg.checkProblem()) {
            return;
        }
        const problem = CphNg._problem!;
        if (!problem.bfCompare) {
            problem.bfCompare = { running: false, msg: '' };
        }
        if (problem.bfCompare.running) {
            Io.warn(
                vscode.l10n.t('Brute Force comparison is already running.'),
            );
            return;
        }
        if (!problem.bfCompare.generator || !problem.bfCompare.bruteForce) {
            Io.warn(
                vscode.l10n.t(
                    'Please choose both generator and brute force files first.',
                ),
            );
            return;
        }
        CphNg.runAbortController && CphNg.runAbortController.abort();
        CphNg.runAbortController = new AbortController();
        const srcLang = Langs.getLang(problem.src.path);
        if (!srcLang) {
            return;
        }

        const cleanUp = () => {
            problem.bfCompare!.running = false;
            if (CphNg.runAbortController?.signal.aborted) {
                problem.bfCompare!.msg = vscode.l10n.t(
                    'Brute Force comparison stopped by user, {cnt} runs completed.',
                    { cnt },
                );
            }
            CphNg.runAbortController = undefined;
            CphNg.saveProblem();
        };

        problem.bfCompare.running = true;
        problem.bfCompare.msg = vscode.l10n.t('Compiling solution...');
        CphNg.emitProblemChange();
        const solutionCompileResult = await CphNg.compile(srcLang, compile);
        if (solutionCompileResult.verdict !== TCVerdicts.UKE) {
            problem.bfCompare.msg = vscode.l10n.t(
                'Solution compilation failed.',
            );
            cleanUp();
            return;
        }

        problem.bfCompare.msg = vscode.l10n.t('Compiling generator...');
        CphNg.emitProblemChange();
        const generatorCompileResult = await srcLang.compile(
            problem.bfCompare.generator,
            CphNg.runAbortController,
            compile,
        );
        if (generatorCompileResult.verdict !== TCVerdicts.UKE) {
            problem.bfCompare.msg = vscode.l10n.t(
                'Generator compilation failed.',
            );
            cleanUp();
            return;
        }
        problem.bfCompare.generator.hash = generatorCompileResult.data!.hash;

        problem.bfCompare.msg = vscode.l10n.t('Compiling brute force...');
        CphNg.emitProblemChange();
        const bruteForceCompileResult = await srcLang.compile(
            problem.bfCompare.bruteForce,
            CphNg.runAbortController,
            compile,
        );
        if (bruteForceCompileResult.verdict !== TCVerdicts.UKE) {
            problem.bfCompare.msg = vscode.l10n.t(
                'Brute force compilation failed.',
            );
            cleanUp();
            return;
        }
        problem.bfCompare.bruteForce.hash = bruteForceCompileResult.data!.hash;

        let cnt = 0;
        while (true) {
            cnt++;
            if (CphNg.runAbortController.signal.aborted) {
                problem.bfCompare.msg = vscode.l10n.t(
                    'Brute Force comparison stopped by user.',
                );
                break;
            }

            problem.bfCompare.msg = vscode.l10n.t(
                '#{cnt} Running generator...',
                { cnt },
            );
            CphNg.emitProblemChange();
            const generatorRunResult = await Runner.doRun(
                [generatorCompileResult.data!.outputPath],
                Settings.bfCompare.generatorTimeLimit,
                { useFile: false, data: '' },
                CphNg.runAbortController,
                undefined,
            );
            if (generatorRunResult.verdict !== TCVerdicts.UKE) {
                if (generatorRunResult.verdict !== TCVerdicts.RJ) {
                    problem.bfCompare.msg = vscode.l10n.t(
                        'Generator run failed: {msg}',
                        {
                            msg: generatorRunResult.msg,
                        },
                    );
                }
                break;
            }

            problem.bfCompare.msg = vscode.l10n.t(
                '#{cnt} Running brute force...',
                { cnt },
            );
            CphNg.emitProblemChange();
            const bruteForceRunResult = await Runner.doRun(
                [bruteForceCompileResult.data!.outputPath],
                Settings.bfCompare.bruteForceTimeLimit,
                { useFile: false, data: generatorRunResult.stdout },
                CphNg.runAbortController,
                undefined,
            );
            if (bruteForceRunResult.verdict !== TCVerdicts.UKE) {
                if (generatorRunResult.verdict !== TCVerdicts.RJ) {
                    problem.bfCompare.msg = vscode.l10n.t(
                        'Brute force run failed: {msg}',
                        {
                            msg: bruteForceRunResult.msg,
                        },
                    );
                }
                break;
            }

            problem.bfCompare.msg = vscode.l10n.t(
                '#{cnt} Running solution...',
                { cnt },
            );
            CphNg.emitProblemChange();
            const tempTc: TC = {
                stdin: { useFile: false, data: generatorRunResult.stdout },
                answer: {
                    useFile: false,
                    data: bruteForceRunResult.stdout,
                },
                isExpand: true,
                result: {
                    verdict: TCVerdicts.CP,
                    stdout: { useFile: false, data: '' },
                    stderr: { useFile: false, data: '' },
                    memory: undefined,
                    time: 0,
                    msg: '',
                },
            } satisfies TC;
            await Runner.run(
                problem,
                tempTc.result!,
                CphNg.runAbortController,
                srcLang,
                tempTc,
                solutionCompileResult.data!,
            );
            if (tempTc.result?.verdict !== TCVerdicts.AC) {
                if (tempTc.result?.verdict !== TCVerdicts.RJ) {
                    problem.tcs.push(tempTc);
                    problem.bfCompare.msg = vscode.l10n.t(
                        'Found a difference in #{cnt} run.',
                        { cnt },
                    );
                }
                break;
            }
        }
        cleanUp();
    }
    public static async stopBfCompare(): Promise<void> {
        if (!CphNg.checkProblem()) {
            return;
        }
        const problem = CphNg._problem!;
        if (!problem.bfCompare || !problem.bfCompare.running) {
            Io.warn(vscode.l10n.t('Brute Force comparison is not running.'));
            return;
        }
        CphNg.runAbortController && CphNg.runAbortController.abort();
        problem.bfCompare.running = false;
        CphNg.saveProblem();
    }
}
