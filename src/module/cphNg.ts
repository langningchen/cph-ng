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
import { SHA256 } from 'crypto-js';
import {
    access,
    constants,
    mkdir,
    readdir,
    readFile,
    unlink,
    writeFile,
} from 'fs/promises';
import { basename, dirname, extname, join, relative } from 'path';
import * as vscode from 'vscode';
import { gunzipSync, gzipSync } from 'zlib';
import { Checker } from '../core/checker';
import { io, Logger } from '../utils/io';
import Settings from '../utils/settings';
import {
    tcIo2Path,
    tcIo2Str,
    TCVerdicts,
    write2TcIo,
} from '../utils/types.backend';
import {
    EmbeddedProblem,
    isExpandVerdict,
    isRunningVerdict,
    Problem,
    TC,
    TCIO,
    TCVerdict,
} from '../utils/types';
import Result, { assignResult } from '../utils/result';
import { renderTemplate } from '../utils/strTemplate';
import { CphCapable } from './cphCapable';
import { FileTypes } from '../webview/msgs';
import { migration, OldProblem } from '../utils/migration';
import { version } from '../../package.json';
import {
    EMBEDDED_FOOTER,
    EMBEDDED_HEADER,
    buildEmbeddedBlock,
    extractEmbedded,
} from '../utils/embedded';
import { FolderChooser } from '../utils/folderChooser';
import { Lang, LangCompileResult } from '../core/langs/lang';
import { createReadStream } from 'fs';
import { spawn } from 'child_process';
import { Langs } from '../core/langs/langs';

type ProblemChangeCallback = (
    problem: Problem | undefined,
    canImport: boolean,
) => void;

type CompileResult = Result<{
    src: NonNullable<LangCompileResult['data']>;
    checker?: NonNullable<LangCompileResult['data']>;
}>;
type RunnerResult = Result<undefined> & {
    time: number;
    stdout: string;
    stderr: string;
};

export class CphNg {
    private logger: Logger = new Logger('cphNg');
    private _problem?: Problem;
    private _canImport: boolean;
    private checker: Checker;
    private onProblemChange: ProblemChangeCallback[];
    private runAbortController?: AbortController;

    constructor() {
        this.logger.trace('constructor');
        this._canImport = false;
        this.checker = new Checker();
        this.onProblemChange = [];
    }

    get problem(): Problem | undefined {
        return this._problem;
    }
    set problem(problem: Problem | undefined) {
        this._problem && this.saveProblem();
        this.runAbortController && this.runAbortController.abort();
        this._problem = problem;
        this.emitProblemChange();
    }

    get canImport(): boolean {
        return this._canImport;
    }
    set canImport(canImport: boolean) {
        this._canImport = canImport;
        this.emitProblemChange();
    }

    public addProblemChangeListener(callback: ProblemChangeCallback) {
        this.onProblemChange.push(callback);
    }
    private emitProblemChange() {
        for (const callback of this.onProblemChange) {
            callback(this._problem, this._canImport);
        }
    }

    public async getBinByCpp(cppPath: string): Promise<string> {
        const workspaceFolder = vscode.workspace.workspaceFolders
            ? vscode.workspace.workspaceFolders[0].uri.fsPath
            : '';
        const dir = renderTemplate(Settings.problem.problemFilePath, [
            ['workspace', workspaceFolder],
            ['dirname', dirname(cppPath)],
            ['relativeDirname', relative(workspaceFolder, dirname(cppPath))],
            ['basename', basename(cppPath)],
            ['extname', extname(cppPath)],
            ['basenameNoExt', basename(cppPath, extname(cppPath))],
        ]);
        return dir;
    }

    public checkProblem() {
        this.logger.trace('checkProblem');
        if (!this._problem) {
            this.logger.warn('No problem found');
            io.warn(
                vscode.l10n.t(
                    'No problem found. Please create a problem first.',
                ),
            );
            return false;
        }
        this.logger.debug('Problem exists', { problem: this._problem });
        return true;
    }
    public checkIdx(idx: number) {
        this.logger.trace('checkIdx', { idx });
        const problem = this._problem!;
        const max = problem.tcs.length - 1;
        if (idx < 0 || idx > max) {
            this.logger.warn('Test case idx out of range', { idx, max });
            io.warn(
                vscode.l10n.t('Test case index {idx} out of range 0~{max}.', {
                    idx,
                    max,
                }),
            );
            return false;
        }
        this.logger.debug('Test case idx is valid', { idx });
        return true;
    }

    private getTCHash(tc: TC) {
        const problem = this._problem!;
        return SHA256(
            `${problem.src.path}-${
                tc.stdin.useFile ? tc.stdin.path : tc.stdin.data
            }`,
        )
            .toString()
            .substring(64 - 6);
    }

    private async compile(
        lang: Lang,
        compile?: boolean,
    ): Promise<CompileResult> {
        try {
            const problem = this._problem!;
            const editor = vscode.window.visibleTextEditors.find(
                (editor) => editor.document.fileName === problem.src.path,
            );
            if (editor) {
                await editor.document.save();
            }
            const compileResult = await lang.compile(
                problem.src,
                this.runAbortController!,
                compile,
            );
            if (compileResult.verdict !== TCVerdicts.UKE) {
                return { ...compileResult, data: { src: compileResult.data! } };
            }
            problem.src.hash = compileResult.data!.hash;
            if (!problem.checker) {
                return { ...compileResult, data: { src: compileResult.data! } };
            }

            const checkerLang = Langs.getLang(problem.checker.path);
            if (!checkerLang) {
                return {
                    ...compileResult,
                    data: {
                        src: compileResult.data!,
                        checker: { outputPath: problem.checker.path, hash: '' },
                    },
                };
            }

            const checkerCompileResult = await checkerLang.compile(
                problem.checker,
                this.runAbortController!,
                compile,
            );
            if (checkerCompileResult.verdict !== TCVerdicts.UKE) {
                return {
                    ...checkerCompileResult,
                    data: {
                        src: compileResult.data!,
                        checker: checkerCompileResult.data,
                    },
                };
            }
            problem.checker.hash = checkerCompileResult.data!.hash;
            return {
                verdict: TCVerdicts.UKE,
                msg: '',
                data: {
                    src: compileResult.data!,
                    checker: checkerCompileResult.data,
                },
            };
        } catch (e) {
            return {
                verdict: TCVerdicts.SE,
                msg: (e as Error).message,
            };
        }
    }
    private async doRun(
        runCommand: string[],
        timeLimit: number,
        stdin: TCIO,
        abortController: AbortController,
    ): Promise<RunnerResult> {
        this.logger.trace('runExecutable', {
            runCommand,
            timeLimit,
            stdin,
        });
        this.logger.info('Running executable', runCommand);
        return new Promise((resolve) => {
            const startTime = Date.now();
            const child = spawn(runCommand[0], runCommand.slice(1), {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: dirname(runCommand[0]),
                signal: abortController.signal,
            });

            let stdout = '';
            let stderr = '';
            let killed = false;

            const killTimeout = setTimeout(() => {
                killed = true;
                this.logger.warn('Killing process due to timeout', {
                    runCommand,
                    timeLimit,
                });
                child.kill('SIGKILL');
            }, timeLimit + Settings.runner.timeAddition);

            child.stdout.on('data', (data) => {
                stdout += data.toString();
                this.logger.debug('Process stdout', { data: data.toString() });
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
                this.logger.debug('Process stderr', { data: data.toString() });
            });

            const commonResolve = (verdict: TCVerdict, msg: string) => {
                const endTime = Date.now();
                clearTimeout(killTimeout);
                this.logger.debug('Process completed', {
                    verdict,
                    msg,
                    duration: endTime - startTime,
                });
                let time = endTime - startTime;
                const match = stderr.match(
                    /-----CPH DATA STARTS-----(\{.*\})-----/,
                );
                if (match) {
                    try {
                        const data = JSON.parse(match[1]);
                        time = data.time / 1000.0;
                    } catch (e) {
                        this.logger.error('Failed to parse wrapper data', e);
                    }
                    stderr = stderr.replace(match[0], '').trimEnd();
                }
                resolve({
                    verdict,
                    msg,
                    stdout,
                    stderr,
                    time,
                } satisfies RunnerResult);
            };

            child.on('close', (code, signal) => {
                if (killed) {
                    commonResolve(
                        TCVerdicts.TLE,
                        vscode.l10n.t('Killed due to timeout'),
                    );
                } else if (code) {
                    commonResolve(
                        TCVerdicts.RE,
                        vscode.l10n.t('Process exited with code: {code}.', {
                            code,
                        }),
                    );
                } else if (signal) {
                    commonResolve(
                        TCVerdicts.RE,
                        vscode.l10n.t('Process exited with signal: {signal}.', {
                            signal,
                        }),
                    );
                } else {
                    commonResolve(TCVerdicts.UKE, '');
                }
            });

            child.on('error', (e: Error) => {
                this.logger.error('Process error', e);
                commonResolve(
                    abortController.signal.aborted
                        ? TCVerdicts.RJ
                        : TCVerdicts.SE,
                    e.message,
                );
            });

            if (stdin.useFile) {
                const inputStream = createReadStream(stdin.path, {
                    encoding: 'utf8',
                });

                inputStream.on('data', (chunk) => {
                    child.stdin.write(chunk);
                    this.logger.debug('Writing to stdin', { chunk });
                });

                inputStream.on('end', () => {
                    child.stdin.end();
                    this.logger.debug('Input stream ended');
                });

                inputStream.on('error', (e: Error) => {
                    this.logger.error('Input stream error', e);
                    commonResolve(
                        TCVerdicts.SE,
                        vscode.l10n.t('Input file read failed: {msg}.', {
                            msg: e.message,
                        }),
                    );
                });
            } else {
                child.stdin.write(stdin.data);
                child.stdin.end();
                this.logger.debug('Input written to stdin', {
                    stdin: stdin.data,
                });
            }
        });
    }
    private async run(
        lang: Lang,
        tc: TC,
        compileData: NonNullable<CompileResult['data']>,
    ) {
        const problem = this._problem!;
        const result = tc.result!;
        const abortController = this.runAbortController!;
        try {
            result.verdict = TCVerdicts.JG;
            this.emitProblemChange();

            const runResult = await this.doRun(
                await lang.runCommand(compileData.src.outputPath),
                problem.timeLimit,
                tc.stdin,
                abortController,
            );
            result.time = runResult.time;
            result.verdict = TCVerdicts.JGD;
            if (tc.answer.useFile) {
                result.stdout = {
                    useFile: true,
                    path: join(
                        Settings.cache.directory,
                        'out',
                        `${this.getTCHash(tc)}.out`,
                    ),
                };
            } else {
                result.stdout.useFile = false;
            }
            result.stdout = await write2TcIo(result.stdout, runResult.stdout);

            if (
                Settings.runner.stderrThreshold !== -1 &&
                runResult.stderr.length >= Settings.runner.stderrThreshold
            ) {
                result.stderr = {
                    useFile: true,
                    path: join(
                        Settings.cache.directory,
                        'out',
                        `${this.getTCHash(tc)}.err`,
                    ),
                };
            } else {
                result.stderr.useFile = false;
            }
            result.stderr = await write2TcIo(result.stderr, runResult.stderr);
            this.emitProblemChange();

            if (assignResult(result, runResult)) {
            } else if (result.time && result.time > problem.timeLimit) {
                result.verdict = TCVerdicts.TLE;
            } else {
                result.verdict = TCVerdicts.CMP;
                this.emitProblemChange();
                assignResult(
                    result,
                    compileData.checker
                        ? await this.checker.runChecker(
                              compileData.checker.outputPath,
                              tc,
                              abortController,
                          )
                        : await this.compareOutputs(
                              runResult.stdout,
                              await tcIo2Str(tc.answer),
                              runResult.stderr,
                          ),
                );
            }
            this.emitProblemChange();
        } catch (e) {
            assignResult(result, {
                verdict: TCVerdicts.SE,
                msg: (e as Error).message,
            });
            this.emitProblemChange();
        }
    }
    private async compareOutputs(
        stdout: string,
        answer: string,
        stderr: string,
    ): Promise<Result<{}>> {
        this.logger.trace('compareOutputs', { stdout, answer, stderr });
        if (!Settings.comparing.ignoreError && stderr) {
            return { verdict: TCVerdicts.RE, msg: '' };
        }
        const fixedOutput = stdout
            .trimEnd()
            .split('\n')
            .map((line) => line.trimEnd())
            .join('\n');
        const fixedAnswer = answer
            .trimEnd()
            .split('\n')
            .map((line) => line.trimEnd())
            .join('\n');
        if (
            Settings.comparing.oleSize &&
            fixedOutput.length >=
                fixedAnswer.length * Settings.comparing.oleSize
        ) {
            return { verdict: TCVerdicts.OLE, msg: '' };
        }
        const compressOutput = stdout.replace(/\r|\n|\t|\s/g, '');
        const compressAnswer = answer.replace(/\r|\n|\t|\s/g, '');
        this.logger.trace('Compressed data', {
            compressOutput,
            compressAnswer,
        });
        if (compressOutput !== compressAnswer) {
            return { verdict: TCVerdicts.WA, msg: '' };
        }
        if (fixedOutput !== fixedAnswer && !Settings.comparing.regardPEAsAC) {
            return { verdict: TCVerdicts.PE, msg: '' };
        }
        return { verdict: TCVerdicts.AC, msg: '' };
    }

    public async createProblem(): Promise<void> {
        try {
            const activeEditor = vscode.window.activeTextEditor;
            if (!activeEditor) {
                io.warn(
                    vscode.l10n.t(
                        'No active editor found. Please open a file to create a problem.',
                    ),
                );
                return;
            }
            const filePath = activeEditor.document.fileName;
            if (this._problem && this._problem.src.path === filePath) {
                io.warn(
                    vscode.l10n.t(
                        'Problem already exists for this file: {file}.',
                        { file: basename(filePath) },
                    ),
                );
                return;
            }
            this.problem = {
                version,
                name: basename(filePath, extname(filePath)),
                src: { path: filePath },
                tcs: [],
                timeLimit: Settings.problem.defaultTimeLimit,
            };
            this.saveProblem();
        } catch (e) {
            io.error(
                vscode.l10n.t('Failed to create problem: {msg}', {
                    msg: (e as Error).message,
                }),
            );
        }
    }
    public async importProblem(): Promise<void> {
        try {
            const activeEditor = vscode.window.activeTextEditor;
            if (!activeEditor) {
                io.warn(
                    vscode.l10n.t(
                        'No active editor found. Please open a file to create a problem.',
                    ),
                );
                return;
            }
            const filePath = activeEditor.document.fileName;
            if (this._problem && this._problem.src.path === filePath) {
                io.warn(
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
                if (!problem) {
                    io.warn(
                        vscode.l10n.t('Failed to import file.', {
                            file: basename(filePath),
                        }),
                    );
                }
                this.problem = problem;
            } catch {
                io.warn(
                    vscode.l10n.t('File {file} does not exists.', {
                        file: probFile,
                    }),
                );
            }
            this.saveProblem();
        } catch (e) {
            io.error(
                vscode.l10n.t('Failed to import problem: {msg}.', {
                    msg: (e as Error).message,
                }),
            );
        }
    }
    public async getProblem() {
        this.emitProblemChange();
    }
    private async loadProblemFromBin(binFile: string): Promise<void> {
        try {
            const data = await readFile(binFile);
            try {
                this.problem = migration(
                    JSON.parse(
                        gunzipSync(data).toString(),
                    ) satisfies OldProblem,
                );
                this.logger.info(
                    'Problem loaded',
                    { problem: this._problem },
                    'from',
                    binFile,
                );
            } catch (e) {
                io.warn(
                    vscode.l10n.t('Parse problem file {file} failed: {msg}.', {
                        file: basename(binFile),
                        msg: (e as Error).message,
                    }),
                );
                this.problem = undefined;
            }
        } catch {
            this.problem = undefined;
        }
    }
    private async loadProblemFromEmbedded(cppFile: string): Promise<void> {
        try {
            const cppData = (await readFile(cppFile)).toString();
            const embeddedProblem = extractEmbedded(cppData);
            if (!embeddedProblem) {
                const startIdx = cppData.indexOf(EMBEDDED_HEADER);
                const endIdx = cppData.indexOf(EMBEDDED_FOOTER);
                if (startIdx !== -1 || endIdx !== -1) {
                    io.warn(
                        vscode.l10n.t('Invalid embedded data in {file}.', {
                            file: basename(cppFile),
                        }),
                    );
                }
                this.problem = undefined;
                return;
            }
            try {
                this.problem = {
                    version,
                    name: embeddedProblem.name,
                    url: embeddedProblem.url,
                    src: { path: cppFile },
                    tcs: embeddedProblem.tcs.map((embeddedTc) => ({
                        stdin: { useFile: false, data: embeddedTc.stdin },
                        answer: { useFile: false, data: embeddedTc.answer },
                        isExpand: false,
                    })),
                    timeLimit: embeddedProblem.timeLimit,
                };
                if (embeddedProblem.spjCode) {
                    this.problem.checker = {
                        path: join(
                            dirname(cppFile),
                            basename(cppFile, extname(cppFile)) +
                                '.spj' +
                                extname(cppFile),
                        ),
                    };
                    await writeFile(
                        this.problem.checker?.path,
                        embeddedProblem.spjCode,
                    );
                }
                this.saveProblem();
            } catch (e) {
                io.warn(
                    vscode.l10n.t(
                        'Parse embedded data in file {file} failed: {msg}.',
                        {
                            file: basename(cppFile),
                            msg: (e as Error).message,
                        },
                    ),
                );
                this.problem = undefined;
            }
        } catch {
            this.problem = undefined;
        }
    }
    public async loadProblem(cppFile: string): Promise<void> {
        this.logger.trace('loadProblem', { cppFile });
        await this.loadProblemFromBin(await this.getBinByCpp(cppFile));
        if (this.problem === undefined) {
            await this.loadProblemFromEmbedded(cppFile);
        }
    }
    public async editProblemDetails(
        title: string,
        url: string,
        timeLimit: number,
    ): Promise<void> {
        if (!this.checkProblem()) {
            return;
        }
        const problem = this._problem!;
        problem.name = title;
        problem.url = url;
        problem.timeLimit = timeLimit;
        this.saveProblem();
    }
    public async saveProblem(): Promise<void> {
        this.logger.trace('saveProblem');
        try {
            if (!this.checkProblem()) {
                return;
            }
            const problem = this._problem!;
            const binPath = await this.getBinByCpp(problem.src.path);
            this.logger.info('Saving problem', { problem }, 'to', binPath);
            this.emitProblemChange();
            await mkdir(dirname(binPath), { recursive: true });
            await writeFile(
                binPath,
                gzipSync(Buffer.from(JSON.stringify(problem))),
            );
        } catch (e) {
            io.error(
                vscode.l10n.t('Failed to save problem: {msg}', {
                    msg: (e as Error).message,
                }),
            );
        }
    }
    public async exportToEmbedded(): Promise<void> {
        this.logger.trace('exportToEmbedded');
        if (!this.checkProblem()) {
            return;
        }
        const problem = this._problem!;
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
            };
            if (problem.checker?.path) {
                embeddedProblem.spjCode = (
                    await readFile(problem.checker?.path)
                ).toString();
            }
            const cppFile = problem.src.path;
            let cppData = (await readFile(cppFile)).toString();
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
            io.error(
                vscode.l10n.t('Failed to export problem: {msg}.', {
                    msg: (e as Error).message,
                }),
            );
        }
    }
    public async delProblem(): Promise<void> {
        this.logger.trace('delProblem');
        if (!this.checkProblem()) {
            return;
        }
        const problem = this._problem!;
        const binPath = await this.getBinByCpp(problem.src.path);
        try {
            await access(binPath, constants.F_OK);
            await unlink(binPath);
            this._problem = undefined;
        } catch {
            io.warn(
                vscode.l10n.t('Problem file {file} not found.', {
                    file: basename(binPath),
                }),
            );
        } finally {
            this.problem = undefined;
        }
    }
    public async addTc(): Promise<void> {
        this.logger.trace('addTestCase');
        if (!this._problem) {
            return;
        }
        this._problem.tcs.push({
            stdin: { useFile: false, data: '' },
            answer: { useFile: false, data: '' },
            isExpand: false,
        });
        this.saveProblem();
    }
    public async loadTcs(): Promise<void> {
        this.logger.trace('loadTestCases');
        try {
            if (!this.checkProblem()) {
                return;
            }
            const problem = this._problem!;

            this.logger.debug('Showing test case loading options');
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
                this.logger.debug('User cancelled test case loading');
                return;
            }
            this.logger.info('User selected loading option:', option);

            let folderPath = '';
            if (option === 'zip') {
                this.logger.debug('Loading test cases from zip file');
                const zipFile = await vscode.window.showOpenDialog({
                    title: vscode.l10n.t(
                        'Choose a zip file containing test cases',
                    ),
                    filters: { 'Zip files': ['zip'], 'All files': ['*'] },
                });
                if (!zipFile) {
                    this.logger.debug('User cancelled zip file selection');
                    return;
                }
                const zipPath = zipFile[0].fsPath;
                this.logger.info('Processing zip file:', zipPath);
                const zipData = new AdmZip(zipPath);
                const entries = zipData.getEntries();
                if (!entries.length) {
                    this.logger.warn('Empty zip file');
                    io.warn(
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
                this.logger.debug('Extracting zip to:', folderPath);
                await mkdir(folderPath, { recursive: true });
                zipData.extractAllTo(folderPath, true);
                if (Settings.problem.deleteAfterUnzip) {
                    this.logger.debug('Deleting zip file:', zipPath);
                    await unlink(zipPath);
                }
            } else if (option === 'folder') {
                this.logger.debug('Loading test cases from folder');
                const folderUri = await FolderChooser.chooseFolder(
                    vscode.l10n.t('Choose a folder containing test cases'),
                );
                if (!folderUri) {
                    this.logger.debug('User cancelled folder selection');
                    return;
                }
                folderPath = folderUri.fsPath;
                this.logger.info('Using folder:', folderPath);
            } else {
                const errorMsg = vscode.l10n.t('Unknown option: {option}.', {
                    option,
                });
                this.logger.error(errorMsg);
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
            this.logger.info(`Found ${allFiles.length} files in total`);
            const tcs: TC[] = [];
            for (const filePath of allFiles) {
                const fileName = basename(filePath);
                const ext = extname(fileName).toLowerCase();
                if (ext === '.in') {
                    this.logger.debug('Found input file:', fileName);
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
                    this.logger.debug('Found answer file:', fileName);
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
                        this.logger.debug('Matched answer with input:', {
                            input: inputFile,
                            answer: filePath,
                        });
                    } else {
                        this.logger.warn(
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
            this.logger.info(`Created ${tcs.length} test cases`);
            const chosenIdx = await vscode.window.showQuickPick(
                tcs.map((tc, idx) => ({
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
                this.logger.debug('User cancelled test case selection');
                return;
            }
            const selectedTCs = chosenIdx.map((idx) => tcs[idx.value]);
            this.logger.info(`User selected ${selectedTCs.length} test cases`);
            if (Settings.problem.clearBeforeLoad) {
                problem.tcs = selectedTCs;
            } else {
                selectedTCs.forEach((tc) => {
                    problem.tcs.push(tc);
                });
            }
            this.saveProblem();
        } catch (e) {
            io.error(
                vscode.l10n.t('Failed to load test cases: {msg}', {
                    msg: (e as Error).message,
                }),
            );
        }
    }
    public async updateTc(idx: number, tc: TC): Promise<void> {
        this.logger.trace('updateTestCase', { idx, tc });
        if (!this.checkProblem() || !this.checkIdx(idx)) {
            return;
        }
        const problem = this._problem!;
        problem.tcs[idx] = tc;
        this.saveProblem();
    }
    public async runTc(idx: number, compile?: boolean): Promise<void> {
        this.logger.trace('runTestCase', { idx });
        if (!this.checkProblem() || !this.checkIdx(idx)) {
            return;
        }
        const problem = this._problem!;
        this.runAbortController && this.runAbortController.abort();
        this.runAbortController = new AbortController();
        const srcLang = Langs.getLang(problem.src.path);
        if (!srcLang) {
            return;
        }

        const tc = problem.tcs[idx];
        tc.result = {
            verdict: TCVerdicts.CP,
            stdout: { useFile: false, data: '' },
            stderr: { useFile: false, data: '' },
            time: 0,
            msg: '',
        };
        tc.isExpand = false;
        this.emitProblemChange();
        const result = tc.result;

        const compileResult = await this.compile(srcLang, compile);
        if (compileResult.verdict !== TCVerdicts.UKE) {
            io.compilationMsg = compileResult.msg;
            result.verdict = TCVerdicts.CE;
            tc.isExpand = true;
            this.saveProblem();
            this.runAbortController = undefined;
            return;
        }
        const compileData = compileResult.data!;

        await this.run(srcLang, tc, compileData);
        tc.isExpand = isExpandVerdict(result.verdict);
        this.saveProblem();
        this.runAbortController = undefined;
    }
    public async runTcs(compile?: boolean): Promise<void> {
        if (!this.checkProblem()) {
            return;
        }
        const problem = this._problem!;
        if (!problem.tcs.length) {
            return;
        }
        this.runAbortController && this.runAbortController.abort();
        this.runAbortController = new AbortController();
        const srcLang = Langs.getLang(problem.src.path);
        if (!srcLang) {
            return;
        }
        for (const tc of problem.tcs) {
            tc.result = {
                verdict: TCVerdicts.CP,
                stdout: { useFile: false, data: '' },
                stderr: { useFile: false, data: '' },
                time: 0,
                msg: '',
            };
            tc.isExpand = false;
        }
        this.emitProblemChange();

        const compileResult = await this.compile(srcLang, compile);
        if (compileResult.verdict !== TCVerdicts.UKE) {
            io.compilationMsg = compileResult.msg;
            for (const tc of problem.tcs) {
                tc.result!.verdict = TCVerdicts.CE;
            }
            this.saveProblem();
            this.runAbortController = undefined;
            return;
        }
        const compileData = compileResult.data!;
        for (const tc of problem.tcs) {
            tc.result!.verdict = TCVerdicts.CPD;
        }
        this.emitProblemChange();

        let hasExpandStatus = false;
        for (const tc of problem.tcs) {
            if (this.runAbortController?.signal.aborted) {
                if (this.runAbortController.signal.reason === 'onlyOne') {
                    this.runAbortController = new AbortController();
                } else {
                    tc.result!.verdict = TCVerdicts.SK;
                    continue;
                }
            }
            await this.run(srcLang, tc, compileData);
            if (!hasExpandStatus) {
                tc.isExpand = isExpandVerdict(tc.result!.verdict);
                this.emitProblemChange();
                hasExpandStatus = tc.isExpand;
            }
        }
        this.saveProblem();
        this.runAbortController = undefined;
    }
    public async stopTcs(onlyOne: boolean): Promise<void> {
        if (!this.checkProblem()) {
            return;
        }
        const problem = this._problem!;
        if (this.runAbortController) {
            this.runAbortController.abort(onlyOne ? 'onlyOne' : undefined);
        } else {
            for (const tc of problem.tcs) {
                if (isRunningVerdict(tc.result!.verdict)) {
                    tc.result!.verdict = TCVerdicts.RJ;
                }
            }
            this.saveProblem();
        }
    }
    public async chooseTcFile(
        idx: number,
        option: 'stdin' | 'answer',
    ): Promise<void> {
        try {
            if (!this.checkProblem() || !this.checkIdx(idx)) {
                return;
            }
            const problem = this._problem!;
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
                                (await io.confirm(
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
                this.saveProblem();
            }
        } catch (e) {
            io.error(
                vscode.l10n.t('Failed to choose test case file: {msg}', {
                    msg: (e as Error).message,
                }),
            );
        }
    }
    public async compareTc(idx: number): Promise<void> {
        try {
            if (!this.checkProblem() || !this.checkIdx(idx)) {
                return;
            }
            const problem = this._problem!;
            const tc = problem.tcs[idx];
            const leftFile = await tcIo2Path(tc.answer);
            const rightFile = await tcIo2Path(tc.result!.stdout);
            vscode.commands.executeCommand(
                'vscode.diff',
                vscode.Uri.file(leftFile),
                vscode.Uri.file(rightFile),
            );
        } catch (e) {
            io.error(
                vscode.l10n.t('Failed to compare test case: {msg}', {
                    msg: (e as Error).message,
                }),
            );
        }
    }
    public async toggleTcFile(idx: number, ext: string): Promise<void> {
        if (!this.checkProblem() || !this.checkIdx(idx)) {
            return;
        }
        const problem = this._problem!;
        const tc = problem.tcs[idx];
        if (tc.stdin.useFile) {
            tc.stdin = { useFile: false, data: await tcIo2Str(tc.stdin) };
        } else {
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
            await writeFile(tempFilePath, tc.stdin.data || '');
            tc.stdin = { useFile: true, path: tempFilePath };
        }
        this.saveProblem();
    }
    public async delTc(idx: number): Promise<void> {
        if (!this.checkProblem() || !this.checkIdx(idx)) {
            return;
        }
        const problem = this._problem!;
        problem.tcs.splice(idx, 1);
        this.saveProblem();
    }
    public async chooseFile(fileType: FileTypes): Promise<void> {
        if (!this.checkProblem()) {
            return;
        }
        const problem = this._problem!;
        const checkerFileUri = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            title: vscode.l10n.t('Select {fileType} File', {
                fileType:
                    fileType === 'checker'
                        ? vscode.l10n.t('Checker')
                        : fileType === 'generator'
                          ? vscode.l10n.t('Generator')
                          : vscode.l10n.t('Brute Force'),
            }),
        });
        if (!checkerFileUri) {
            return;
        }
        if (fileType === 'checker') {
            problem.checker = { path: checkerFileUri[0].fsPath };
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
        this.saveProblem();
    }
    public async removeFile(fileType: FileTypes): Promise<void> {
        if (!this.checkProblem()) {
            return;
        }
        const problem = this._problem!;
        if (fileType === 'checker') {
            problem.checker = undefined;
        } else if (fileType === 'generator') {
            if (problem.bfCompare) {
                problem.bfCompare.generator = undefined;
            }
        } else {
            problem.bfCompare && (problem.bfCompare.bruteForce = undefined);
        }
        this.saveProblem();
    }
    public async startBfCompare(compile?: boolean): Promise<void> {
        if (!this.checkProblem()) {
            return;
        }
        const problem = this._problem!;
        if (!problem.bfCompare) {
            problem.bfCompare = { running: false, msg: '' };
        }
        if (problem.bfCompare.running) {
            io.warn(
                vscode.l10n.t('Brute Force comparison is already running.'),
            );
            return;
        }
        if (!problem.bfCompare.generator || !problem.bfCompare.bruteForce) {
            io.warn(
                vscode.l10n.t(
                    'Please choose both generator and brute force files first.',
                ),
            );
            return;
        }
        this.runAbortController && this.runAbortController.abort();
        this.runAbortController = new AbortController();
        const srcLang = Langs.getLang(problem.src.path);
        if (!srcLang) {
            return;
        }

        const cleanUp = () => {
            problem.bfCompare!.running = false;
            if (this.runAbortController?.signal.aborted) {
                problem.bfCompare!.msg = vscode.l10n.t(
                    'Brute Force comparison stopped by user, {cnt} runs completed.',
                    { cnt },
                );
            }
            this.runAbortController = undefined;
            this.saveProblem();
        };

        problem.bfCompare.running = true;
        problem.bfCompare.msg = vscode.l10n.t('Compiling solution...');
        this.emitProblemChange();
        const solutionCompileResult = await this.compile(srcLang, compile);
        if (solutionCompileResult.verdict !== TCVerdicts.UKE) {
            io.compilationMsg = solutionCompileResult.msg;
            problem.bfCompare.msg = vscode.l10n.t(
                'Solution compilation failed.',
            );
            cleanUp();
            return;
        }

        problem.bfCompare.msg = vscode.l10n.t('Compiling generator...');
        this.emitProblemChange();
        const generatorCompileResult = await srcLang.compile(
            problem.bfCompare.generator,
            this.runAbortController,
            compile,
        );
        if (generatorCompileResult.verdict !== TCVerdicts.UKE) {
            io.compilationMsg = generatorCompileResult.msg;
            problem.bfCompare.msg = vscode.l10n.t(
                'Generator compilation failed.',
            );
            cleanUp();
            return;
        }
        problem.bfCompare.generator.hash = generatorCompileResult.data!.hash;

        problem.bfCompare.msg = vscode.l10n.t('Compiling brute force...');
        this.emitProblemChange();
        const bruteForceCompileResult = await srcLang.compile(
            problem.bfCompare.bruteForce,
            this.runAbortController,
            compile,
        );
        if (bruteForceCompileResult.verdict !== TCVerdicts.UKE) {
            io.compilationMsg = bruteForceCompileResult.msg;
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
            if (this.runAbortController.signal.aborted) {
                problem.bfCompare.msg = vscode.l10n.t(
                    'Brute Force comparison stopped by user.',
                );
                break;
            }

            problem.bfCompare.msg = vscode.l10n.t(
                '#{cnt} Running generator...',
                { cnt },
            );
            this.emitProblemChange();
            const generatorRunResult = await this.doRun(
                [generatorCompileResult.data!.outputPath],
                Settings.bfCompare.generatorTimeLimit,
                { useFile: false, data: '' },
                this.runAbortController,
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
            this.emitProblemChange();
            const bruteForceRunResult = await this.doRun(
                [bruteForceCompileResult.data!.outputPath],
                Settings.bfCompare.bruteForceTimeLimit,
                { useFile: false, data: generatorRunResult.stdout },
                this.runAbortController,
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
            this.emitProblemChange();
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
                    time: 0,
                    msg: '',
                },
            } satisfies TC;
            await this.run(srcLang, tempTc, solutionCompileResult.data!);
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

    public async stopBfCompare(): Promise<void> {
        if (!this.checkProblem()) {
            return;
        }
        const problem = this._problem!;
        if (!problem.bfCompare || !problem.bfCompare.running) {
            io.warn(vscode.l10n.t('Brute Force comparison is not running.'));
            return;
        }
        this.runAbortController && this.runAbortController.abort();
        problem.bfCompare.running = false;
        this.saveProblem();
    }
}
