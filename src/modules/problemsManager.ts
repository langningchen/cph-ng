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

import { unlink, writeFile } from 'fs/promises';
import { basename, dirname, extname, join } from 'path';
import * as vscode from 'vscode';
import { Compiler } from '../core/compiler';
import Langs from '../core/langs/langs';
import { Runner } from '../core/runner';
import Io from '../helpers/io';
import Logger from '../helpers/logger';
import Problems from '../helpers/problems';
import { getActivePath, sidebarProvider, waitUntil } from '../utils/global';
import { exists } from '../utils/process';
import { assignResult } from '../utils/result';
import { isExpandVerdict, isRunningVerdict, Problem, TC } from '../utils/types';
import { tcIo2Str, TCVerdicts } from '../utils/types.backend';
import { chooseSrcFile, chooseTcFile, getTcs } from '../utils/ui';
import * as msgs from '../webview/msgs';
import Companion from './companion';
import CphCapable from './cphCapable';
import ExtensionManager from './extensionManager';
import FileSystemProvider, { generateTcUri } from './fileSystemProvider';
import Settings from './settings';

interface FullProblem {
    problem: Problem;
    ac: AbortController | null;
    startTime: number;
}

export default class ProblemsManager {
    private static logger: Logger = new Logger('problemsManager');
    private static fullProblems: FullProblem[] = [];

    public static async listFullProblems(): Promise<FullProblem[]> {
        return this.fullProblems;
    }
    public static async getFullProblem(
        path?: string,
    ): Promise<FullProblem | null> {
        if (!path) {
            return null;
        }
        for (const fullProblem of this.fullProblems) {
            if (Problems.isRelated(fullProblem.problem, path)) {
                return fullProblem;
            }
        }
        const problem = await Problems.loadProblem(path);
        if (!problem) {
            return null;
        }
        const fullProblem = {
            problem,
            ac: null,
            startTime: Date.now(),
        } satisfies FullProblem;
        this.fullProblems.push(fullProblem);
        return fullProblem;
    }
    public static async dataRefresh() {
        this.logger.info('data refresh');
        const activePath = getActivePath();
        const idles: FullProblem[] = this.fullProblems.filter(
            (fullProblem) =>
                !fullProblem.ac &&
                !Problems.isRelated(fullProblem.problem, activePath),
        );
        for (const idle of idles) {
            idle.problem.timeElapsed += Date.now() - idle.startTime;
            await Problems.saveProblem(idle.problem);
        }
        this.fullProblems = this.fullProblems.filter((p) => !idles.includes(p));

        const fullProblem = await this.getFullProblem(activePath);
        const canImport =
            !!activePath && (await exists(CphCapable.getProbBySrc(activePath)));
        sidebarProvider.event.emit('problem', {
            problem: fullProblem && {
                problem: fullProblem.problem,
                startTime: fullProblem.startTime,
            },
            bgProblems: this.fullProblems
                .map((bgProblem) => ({
                    name: bgProblem.problem.name,
                    srcPath: bgProblem.problem.src.path,
                }))
                .filter(
                    (bgProblem) =>
                        bgProblem.srcPath !== fullProblem?.problem.src.path,
                ),
            canImport,
        });
        ExtensionManager.event.emit('context', {
            hasProblem: !!fullProblem,
            canImport,
            isRunning: !!fullProblem?.ac,
        });
    }
    public static async closeAll() {
        for (const fullProblem of this.fullProblems) {
            fullProblem.ac?.abort();
            await waitUntil(() => !fullProblem.ac);
            fullProblem.problem.timeElapsed +=
                Date.now() - fullProblem.startTime;
            await Problems.saveProblem(fullProblem.problem);
        }
        this.fullProblems = [];
    }

    public static async editProblemDetails(msg: msgs.EditProblemDetailsMsg) {
        const fullProblem = await this.getFullProblem(msg.activePath);
        if (!fullProblem) {
            return;
        }
        fullProblem.problem.name = msg.title;
        fullProblem.problem.url = msg.url;
        fullProblem.problem.timeLimit = msg.timeLimit;
        fullProblem.problem.memoryLimit = msg.memoryLimit;
        await this.dataRefresh();
    }
    public static async delProblem(msg: msgs.DelProblemMsg) {
        const fullProblem = await this.getFullProblem(msg.activePath);
        if (!fullProblem) {
            return;
        }
        const binPath = await Problems.getBinBySrc(
            fullProblem.problem.src.path,
        );
        if (!binPath) {
            return;
        }
        try {
            await unlink(binPath);
        } catch {
            Io.warn(
                vscode.l10n.t('Failed to delete problem file {file}.', {
                    file: basename(binPath),
                }),
            );
        }
        this.fullProblems = this.fullProblems.filter((p) => p !== fullProblem);
        await this.dataRefresh();
    }

    public static async addTc(msg: msgs.AddTcMsg) {
        const fullProblem = await this.getFullProblem(msg.activePath);
        if (!fullProblem) {
            return;
        }
        fullProblem.problem.tcs.push({
            stdin: { useFile: false, data: '' },
            answer: { useFile: false, data: '' },
            isExpand: false,
        });
        await this.dataRefresh();
    }
    public static async loadTcs(msg: msgs.LoadTcsMsg) {
        const fullProblem = await this.getFullProblem(msg.activePath);
        if (!fullProblem) {
            return;
        }
        const tcs = await getTcs(fullProblem.problem.src.path);
        if (Settings.problem.clearBeforeLoad) {
            fullProblem.problem.tcs = tcs;
        } else {
            tcs.forEach((tc) => {
                fullProblem.problem.tcs.push(tc);
            });
        }
        await this.dataRefresh();
    }
    public static async updateTc(msg: msgs.UpdateTcMsg) {
        const fullProblem = await this.getFullProblem(msg.activePath);
        if (!fullProblem) {
            return;
        }
        fullProblem.problem.tcs[msg.idx] = msg.tc;
        await this.dataRefresh();
    }

    public static async runTc(msg: msgs.RunTcMsg): Promise<void> {
        const fullProblem = await this.getFullProblem(msg.activePath);
        if (!fullProblem) {
            return;
        }
        const srcLang = Langs.getLang(fullProblem.problem.src.path);
        if (!srcLang) {
            return;
        }
        fullProblem.ac && fullProblem.ac.abort();
        fullProblem.ac = new AbortController();
        const beforeReturn = async () => {
            fullProblem.ac = null;
            await this.dataRefresh();
        };

        const tc = fullProblem.problem.tcs[msg.idx];
        tc.result = {
            verdict: TCVerdicts.CP,
            stdout: { useFile: false, data: '' },
            stderr: { useFile: false, data: '' },
            memory: undefined,
            time: 0,
            msg: '',
        };
        tc.isExpand = false;
        await this.dataRefresh();
        const result = tc.result;

        const compileResult = await Compiler.compileAll(
            fullProblem.problem,
            srcLang,
            msg.compile,
            fullProblem.ac,
        );
        if (assignResult(result, compileResult)) {
            tc.isExpand = true;
            await beforeReturn();
            return;
        }
        const compileData = compileResult.data;
        if (!compileData) {
            result.verdict = TCVerdicts.SE;
            result.msg = vscode.l10n.t('Compile data is empty.');
            await beforeReturn();
            return;
        }

        await Runner.run(
            fullProblem.problem,
            result,
            fullProblem.ac,
            srcLang,
            tc,
            compileData,
        );
        tc.isExpand = isExpandVerdict(result.verdict);
        await beforeReturn();
    }
    public static async clearTcStatus(msg: msgs.ClearTcStatusMsg) {
        const fullProblem = await this.getFullProblem(msg.activePath);
        if (!fullProblem) {
            return;
        }
        fullProblem.problem.tcs[msg.idx].result = undefined;
        await this.dataRefresh();
    }
    public static async clearStatus(msg: msgs.ClearStatusMsg) {
        const fullProblem = await this.getFullProblem(msg.activePath);
        if (!fullProblem) {
            return;
        }
        for (const tc of fullProblem.problem.tcs) {
            tc.result = undefined;
        }
        await this.dataRefresh();
    }

    public static async runTcs(msg: msgs.RunTcsMsg): Promise<void> {
        const fullProblem = await this.getFullProblem(msg.activePath);
        if (!fullProblem) {
            return;
        }
        const srcLang = Langs.getLang(fullProblem.problem.src.path);
        if (!srcLang) {
            return;
        }
        fullProblem.ac && fullProblem.ac.abort();
        fullProblem.ac = new AbortController();
        const beforeReturn = async () => {
            fullProblem.ac = null;
            await this.dataRefresh();
        };

        for (const tc of fullProblem.problem.tcs) {
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
        await this.dataRefresh();

        const compileResult = await Compiler.compileAll(
            fullProblem.problem,
            srcLang,
            msg.compile,
            fullProblem.ac,
        );
        if (compileResult.verdict !== TCVerdicts.UKE) {
            console.log(compileResult);
            for (const tc of fullProblem.problem.tcs) {
                assignResult(tc.result!, compileResult);
            }
            await beforeReturn();
            return;
        }
        const compileData = compileResult.data;
        if (!compileData) {
            for (const tc of fullProblem.problem.tcs) {
                tc.result!.verdict = TCVerdicts.SE;
                tc.result!.msg = vscode.l10n.t('Compile data is empty.');
            }
            await beforeReturn();
            return;
        }
        for (const tc of fullProblem.problem.tcs) {
            tc.result!.verdict = TCVerdicts.CPD;
        }
        await this.dataRefresh();

        let hasExpandStatus = false;
        for (const tc of fullProblem.problem.tcs) {
            if (fullProblem.ac.signal.aborted) {
                if (fullProblem.ac.signal.reason === 'onlyOne') {
                    fullProblem.ac = new AbortController();
                } else {
                    tc.result!.verdict = TCVerdicts.SK;
                    continue;
                }
            }
            await Runner.run(
                fullProblem.problem,
                tc.result!,
                fullProblem.ac,
                srcLang,
                tc,
                compileData,
            );
            if (!hasExpandStatus) {
                tc.isExpand = isExpandVerdict(tc.result!.verdict);
                await this.dataRefresh();
                hasExpandStatus = tc.isExpand;
            }
        }
        await beforeReturn();
    }

    public static async stopTcs(msg: msgs.StopTcsMsg): Promise<void> {
        const fullProblem = await this.getFullProblem(msg.activePath);
        if (!fullProblem) {
            return;
        }
        if (fullProblem.ac) {
            fullProblem.ac.abort(msg.onlyOne ? 'onlyOne' : undefined);
        } else {
            for (const tc of fullProblem.problem.tcs) {
                if (tc.result && isRunningVerdict(tc.result.verdict)) {
                    tc.result.verdict = TCVerdicts.RJ;
                }
            }
        }
        await this.dataRefresh();
    }
    public static async chooseTcFile(msg: msgs.ChooseTcFileMsg): Promise<void> {
        const fullProblem = await this.getFullProblem(msg.activePath);
        if (!fullProblem) {
            return;
        }
        const files = await chooseTcFile(msg.label);
        if (files.stdin) {
            fullProblem.problem.tcs[msg.idx].stdin = {
                useFile: true,
                path: files.stdin,
            };
        }
        if (files.answer) {
            fullProblem.problem.tcs[msg.idx].answer = {
                useFile: true,
                path: files.answer,
            };
        }
        await this.dataRefresh();
    }
    public static async compareTc(msg: msgs.CompareTcMsg): Promise<void> {
        const fullProblem = await this.getFullProblem(msg.activePath);
        if (!fullProblem) {
            return;
        }
        const tc = fullProblem.problem.tcs[msg.idx];
        if (!tc.result) {
            return;
        }
        try {
            vscode.commands.executeCommand(
                'vscode.diff',
                generateTcUri(fullProblem.problem, msg.idx, 'answer'),
                generateTcUri(fullProblem.problem, msg.idx, 'stdout'),
            );
        } catch (e) {
            Io.error(
                vscode.l10n.t('Failed to compare test case: {msg}', {
                    msg: (e as Error).message,
                }),
            );
        }
    }
    public static async toggleTcFile(msg: msgs.ToggleTcFileMsg): Promise<void> {
        const fullProblem = await this.getFullProblem(msg.activePath);
        if (!fullProblem) {
            return;
        }
        const tc = fullProblem.problem.tcs[msg.idx];
        const fileIo = tc[msg.label];
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
                tc[msg.label] = { useFile: false, data };
            }
        } else {
            const ext = {
                stdin: 'in',
                answer: 'ans',
            }[msg.label];
            let tempFilePath: string | undefined = join(
                dirname(fullProblem.problem.src.path),
                `${basename(fullProblem.problem.src.path, extname(fullProblem.problem.src.path))}-${msg.idx + 1}.${ext}`,
            );
            tempFilePath = await vscode.window
                .showSaveDialog({
                    defaultUri: vscode.Uri.file(tempFilePath),
                    saveLabel: vscode.l10n.t('Select location to save'),
                })
                .then((uri) => (uri ? uri.fsPath : undefined));
            if (!tempFilePath) {
                return;
            }
            await writeFile(tempFilePath, fileIo.data);
            tc[msg.label] = { useFile: true, path: tempFilePath };
        }
        await this.dataRefresh();
    }
    public static async delTc(msg: msgs.DelTcMsg): Promise<void> {
        const fullProblem = await this.getFullProblem(msg.activePath);
        if (!fullProblem) {
            return;
        }
        fullProblem.problem.tcs.splice(msg.idx, 1);
        await this.dataRefresh();
    }

    public static async chooseSrcFile(
        msg: msgs.ChooseSrcFileMsg,
    ): Promise<void> {
        const fullProblem = await this.getFullProblem(msg.activePath);
        if (!fullProblem) {
            return;
        }
        const path = await chooseSrcFile(msg.fileType);
        if (!path) {
            return;
        }
        if (msg.fileType === 'checker') {
            fullProblem.problem.checker = { path };
        } else if (msg.fileType === 'interactor') {
            fullProblem.problem.interactor = { path };
        } else if (msg.fileType === 'generator') {
            if (!fullProblem.problem.bfCompare) {
                fullProblem.problem.bfCompare = { running: false, msg: '' };
            }
            fullProblem.problem.bfCompare.generator = { path };
        } else {
            if (!fullProblem.problem.bfCompare) {
                fullProblem.problem.bfCompare = { running: false, msg: '' };
            }
            fullProblem.problem.bfCompare.bruteForce = { path };
        }
        await this.dataRefresh();
    }
    public static async removeSrcFile(
        msg: msgs.RemoveSrcFileMsg,
    ): Promise<void> {
        const fullProblem = await this.getFullProblem(msg.activePath);
        if (!fullProblem) {
            return;
        }
        if (msg.fileType === 'checker') {
            fullProblem.problem.checker = undefined;
        } else if (msg.fileType === 'interactor') {
            fullProblem.problem.interactor = undefined;
        } else if (
            msg.fileType === 'generator' &&
            fullProblem.problem.bfCompare
        ) {
            fullProblem.problem.bfCompare.generator = undefined;
        } else if (
            msg.fileType === 'bruteForce' &&
            fullProblem.problem.bfCompare
        ) {
            fullProblem.problem.bfCompare.bruteForce = undefined;
        }
        await this.dataRefresh();
    }
    public static async startBfCompare(
        msg: msgs.StartBfCompareMsg,
    ): Promise<void> {
        const fullProblem = await this.getFullProblem(msg.activePath);
        if (!fullProblem) {
            return;
        }
        const srcLang = Langs.getLang(fullProblem.problem.src.path);
        if (!srcLang) {
            return;
        }
        const bfCompare = fullProblem.problem.bfCompare;
        if (!bfCompare || !bfCompare.generator || !bfCompare.bruteForce) {
            Io.warn(
                vscode.l10n.t(
                    'Please choose both generator and brute force files first.',
                ),
            );
            return;
        }
        if (bfCompare.running) {
            Io.warn(
                vscode.l10n.t('Brute Force comparison is already running.'),
            );
            return;
        }
        fullProblem.ac && fullProblem.ac.abort();
        fullProblem.ac = new AbortController();
        const beforeReturn = async () => {
            bfCompare.running = false;
            if (fullProblem.ac?.signal.aborted) {
                bfCompare.msg = vscode.l10n.t(
                    'Brute Force comparison stopped by user, {cnt} runs completed.',
                    { cnt },
                );
            }
            fullProblem.ac = null;
            await this.dataRefresh();
        };

        bfCompare.running = true;
        bfCompare.msg = vscode.l10n.t('Compiling...');
        await this.dataRefresh();
        const compileResult = await Compiler.compileAll(
            fullProblem.problem,
            srcLang,
            msg.compile,
            fullProblem.ac,
            true,
        );
        if (compileResult.verdict !== TCVerdicts.UKE) {
            bfCompare.msg = vscode.l10n.t('Solution compilation failed.');
            await beforeReturn();
            return;
        }
        const compileData = compileResult.data;
        if (!compileData || !compileData.bfCompare) {
            bfCompare.msg = vscode.l10n.t('Compile data is empty.');
            await beforeReturn();
            return;
        }

        let cnt = 0;
        while (true) {
            cnt++;
            if (fullProblem.ac.signal.aborted) {
                bfCompare.msg = vscode.l10n.t(
                    'Brute Force comparison stopped by user.',
                );
                break;
            }

            bfCompare.msg = vscode.l10n.t('#{cnt} Running generator...', {
                cnt,
            });
            await this.dataRefresh();
            const generatorRunResult = await Runner.doRun(
                [compileData.bfCompare.generator.outputPath],
                Settings.bfCompare.generatorTimeLimit,
                { useFile: false, data: '' },
                fullProblem.ac,
                undefined,
            );
            if (generatorRunResult.verdict !== TCVerdicts.UKE) {
                if (generatorRunResult.verdict !== TCVerdicts.RJ) {
                    bfCompare.msg = vscode.l10n.t(
                        'Generator run failed: {msg}',
                        {
                            msg: generatorRunResult.msg,
                        },
                    );
                }
                break;
            }

            bfCompare.msg = vscode.l10n.t('#{cnt} Running brute force...', {
                cnt,
            });
            await this.dataRefresh();
            const bruteForceRunResult = await Runner.doRun(
                [compileData.bfCompare.bruteForce.outputPath],
                Settings.bfCompare.bruteForceTimeLimit,
                { useFile: false, data: generatorRunResult.stdout },
                fullProblem.ac,
                undefined,
            );
            if (bruteForceRunResult.verdict !== TCVerdicts.UKE) {
                if (generatorRunResult.verdict !== TCVerdicts.RJ) {
                    bfCompare.msg = vscode.l10n.t(
                        'Brute force run failed: {msg}',
                        {
                            msg: bruteForceRunResult.msg,
                        },
                    );
                }
                break;
            }

            bfCompare.msg = vscode.l10n.t('#{cnt} Running solution...', {
                cnt,
            });
            await this.dataRefresh();
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
                fullProblem.problem,
                tempTc.result!,
                fullProblem.ac,
                srcLang,
                tempTc,
                compileResult.data!,
            );
            if (tempTc.result?.verdict !== TCVerdicts.AC) {
                if (tempTc.result?.verdict !== TCVerdicts.RJ) {
                    if (
                        !tempTc.stdin.useFile &&
                        tempTc.stdin.data.length >
                            Settings.problem.maxInlineDataLength &&
                        (await Io.confirm(
                            vscode.l10n.t(
                                'The brute force compare found a difference, but the input file is {size} bytes, which may be large. Do you want to save it in file instead?',
                                { size: tempTc.stdin.data.length },
                            ),
                            true,
                        ))
                    ) {
                        let tempFilePath: string | undefined = join(
                            dirname(fullProblem.problem.src.path),
                            `${basename(fullProblem.problem.src.path, extname(fullProblem.problem.src.path))}-${cnt}.in`,
                        );
                        tempFilePath = await vscode.window
                            .showSaveDialog({
                                defaultUri: vscode.Uri.file(tempFilePath),
                                saveLabel: vscode.l10n.t(
                                    'Select location to save',
                                ),
                            })
                            .then((uri) => (uri ? uri.fsPath : undefined));
                        if (tempFilePath) {
                            await writeFile(tempFilePath, tempTc.stdin.data);
                            tempTc.stdin = {
                                useFile: true,
                                path: tempFilePath,
                            };
                        }
                    }
                    fullProblem.problem.tcs.push(tempTc);
                    bfCompare.msg = vscode.l10n.t(
                        'Found a difference in #{cnt} run.',
                        { cnt },
                    );
                }
                break;
            }
        }
        await beforeReturn();
    }
    public static async stopBfCompare(
        msg: msgs.StopBfCompareMsg,
    ): Promise<void> {
        const fullProblem = await this.getFullProblem(msg.activePath);
        if (!fullProblem) {
            return;
        }
        if (
            !fullProblem.problem.bfCompare ||
            !fullProblem.problem.bfCompare.running
        ) {
            Io.warn(vscode.l10n.t('Brute Force comparison is not running.'));
            return;
        }
        fullProblem.ac && fullProblem.ac.abort();
        await this.dataRefresh();
    }
    public static async submitToCodeforces(
        msg: msgs.SubmitToCodeforcesMsg,
    ): Promise<void> {
        const fullProblem = await this.getFullProblem(msg.activePath);
        if (!fullProblem) {
            return;
        }
        Companion.submit(fullProblem.problem);
    }
    public static async openFile(msg: msgs.OpenFileMsg): Promise<void> {
        if (!msg.isVirtual) {
            var document = await vscode.workspace.openTextDocument(msg.path);
        } else {
            const fullProblem = await this.getFullProblem(msg.activePath);
            if (!fullProblem) {
                return;
            }
            var document = await vscode.workspace.openTextDocument(
                vscode.Uri.from({
                    scheme: FileSystemProvider.scheme,
                    authority: fullProblem.problem.src.path,
                    path: msg.path,
                }),
            );
        }
        await vscode.window.showTextDocument(document);
    }
}
