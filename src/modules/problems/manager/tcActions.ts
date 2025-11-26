import FolderChooser from '@/helpers/folderChooser';
import Io from '@/helpers/io';
import Settings from '@/helpers/settings';
import { Tc, TcIo } from '@/types';
import * as msgs from '@w/msgs';
import { stat, writeFile } from 'fs/promises';
import { basename, dirname, extname, join } from 'path';
import { commands, l10n, Uri, window } from 'vscode';
import { generateTcUri } from '../problemFs';
import TcFactory from '../tcFactory';
import { ProblemActions } from './problemActions';
import Store from './store';

export class TcActions {
    public static async addTc(msg: msgs.AddTcMsg) {
        const fullProblem = await Store.getFullProblem(msg.activePath);
        if (!fullProblem) {
            return;
        }
        fullProblem.problem.addTc(new Tc());
        await Store.dataRefresh();
    }
    public static async loadTcs(msg: msgs.LoadTcsMsg) {
        const fullProblem = await Store.getFullProblem(msg.activePath);
        if (!fullProblem) {
            return;
        }

        const option = (
            await window.showQuickPick(
                [
                    {
                        label: l10n.t('Load from a zip file'),
                        value: 'zip',
                    },
                    {
                        label: l10n.t('Load from a folder'),
                        value: 'folder',
                    },
                ],
                { canPickMany: false },
            )
        )?.value;
        if (!option) {
            return undefined;
        }

        if (option === 'zip') {
            const zipFile = await window.showOpenDialog({
                title: l10n.t('Choose a zip file containing test cases'),
                filters: { 'Zip files': ['zip'], 'All files': ['*'] },
            });
            if (!zipFile) {
                return undefined;
            }
            fullProblem.problem.applyTcs(
                await TcFactory.fromZip(
                    fullProblem.problem.src.path,
                    zipFile[0].fsPath,
                ),
            );
        } else if (option === 'folder') {
            const folderUri = await FolderChooser.chooseFolder(
                l10n.t('Choose a folder containing test cases'),
            );
            if (!folderUri) {
                return undefined;
            }
            fullProblem.problem.applyTcs(
                await TcFactory.fromFolder(folderUri.fsPath),
            );
        }
        await Store.dataRefresh();
    }
    public static async updateTc(msg: msgs.UpdateTcMsg) {
        const fullProblem = await Store.getFullProblem(msg.activePath);
        if (!fullProblem) {
            return;
        }
        fullProblem.problem.tcs[msg.id] = Tc.fromI(msg.tc);
        await Store.dataRefresh();
    }
    public static async toggleDisable(msg: msgs.ToggleDisableMsg) {
        const fullProblem = await Store.getFullProblem(msg.activePath);
        if (!fullProblem) {
            return;
        }
        fullProblem.problem.tcs[msg.id].isDisabled =
            !fullProblem.problem.tcs[msg.id].isDisabled;
        await Store.dataRefresh();
    }
    public static async clearTcStatus(msg: msgs.ClearTcStatusMsg) {
        const fullProblem = await Store.getFullProblem(msg.activePath);
        if (!fullProblem) {
            return;
        }
        fullProblem.problem.tcs[msg.id].result = undefined;
        await Store.dataRefresh();
    }
    public static async clearStatus(msg: msgs.ClearStatusMsg) {
        const fullProblem = await Store.getFullProblem(msg.activePath);
        if (!fullProblem) {
            return;
        }
        for (const tc of Object.values(fullProblem.problem.tcs)) {
            tc.result = undefined;
        }
        await Store.dataRefresh();
    }
    public static async chooseTcFile(msg: msgs.ChooseTcFileMsg): Promise<void> {
        const fullProblem = await Store.getFullProblem(msg.activePath);
        if (!fullProblem) {
            return;
        }
        const isInput = msg.label === 'stdin';
        const mainExt = isInput
            ? Settings.problem.inputFileExtensionList
            : Settings.problem.outputFileExtensionList;
        const fileUri = await window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            title: l10n.t('Choose {type} file', {
                type: isInput ? l10n.t('stdin') : l10n.t('answer'),
            }),
            filters: {
                [l10n.t('Text files')]: mainExt.map((ext) => ext.substring(1)),
                [l10n.t('All files')]: ['*'],
            },
        });
        if (!fileUri || !fileUri.length) {
            return;
        }
        const partialTc = await TcFactory.fromFile(fileUri[0].fsPath, isInput);
        partialTc.stdin &&
            (fullProblem.problem.tcs[msg.id].stdin = partialTc.stdin);
        partialTc.answer &&
            (fullProblem.problem.tcs[msg.id].answer = partialTc.answer);
        await Store.dataRefresh();
    }
    public static async compareTc(msg: msgs.CompareTcMsg): Promise<void> {
        const fullProblem = await Store.getFullProblem(msg.activePath);
        if (!fullProblem) {
            return;
        }
        const tc = fullProblem.problem.tcs[msg.id];
        if (!tc.result) {
            return;
        }
        try {
            commands.executeCommand(
                'vscode.diff',
                generateTcUri(fullProblem.problem, msg.id, 'answer'),
                generateTcUri(fullProblem.problem, msg.id, 'stdout'),
            );
        } catch (e) {
            Io.error(
                l10n.t('Failed to compare test case: {msg}', {
                    msg: (e as Error).message,
                }),
            );
        }
    }
    public static async toggleTcFile(msg: msgs.ToggleTcFileMsg): Promise<void> {
        const fullProblem = await Store.getFullProblem(msg.activePath);
        if (!fullProblem) {
            return;
        }
        const tc = fullProblem.problem.tcs[msg.id];
        const fileIo = tc[msg.label];
        if (fileIo.useFile) {
            const data = await fileIo.toString();
            if (
                data.length <= Settings.problem.maxInlineDataLength ||
                (await Io.confirm(
                    l10n.t(
                        'The file size is {size} bytes, which may be large. Are you sure you want to load it inline?',
                        { size: data.length },
                    ),
                ))
            ) {
                tc[msg.label] = new TcIo(false, data);
            }
        } else {
            const ext = {
                stdin: Settings.problem.inputFileExtensionList[0] || '.in',
                answer: Settings.problem.outputFileExtensionList[0] || '.ans',
            }[msg.label];
            let tempFilePath: string | undefined = join(
                dirname(fullProblem.problem.src.path),
                `${basename(fullProblem.problem.src.path, extname(fullProblem.problem.src.path))}-${msg.id + 1}${ext}`,
            );
            tempFilePath = await window
                .showSaveDialog({
                    defaultUri: Uri.file(tempFilePath),
                    saveLabel: l10n.t('Select location to save'),
                })
                .then((uri) => (uri ? uri.fsPath : undefined));
            if (!tempFilePath) {
                return;
            }
            await writeFile(tempFilePath, fileIo.data);
            tc[msg.label] = new TcIo(true, tempFilePath);
        }
        await Store.dataRefresh();
    }
    public static async delTc(msg: msgs.DelTcMsg): Promise<void> {
        const fullProblem = await Store.getFullProblem(msg.activePath);
        if (!fullProblem) {
            return;
        }
        fullProblem.problem.tcOrder = fullProblem.problem.tcOrder.filter(
            (id) => id !== msg.id,
        );
        await Store.dataRefresh();
    }
    public static async reorderTc(msg: msgs.ReorderTcMsg): Promise<void> {
        const fullProblem = await Store.getFullProblem(msg.activePath);
        if (!fullProblem) {
            return;
        }
        const tcOrder = fullProblem.problem.tcOrder;
        const [movedTc] = tcOrder.splice(msg.fromIdx, 1);
        tcOrder.splice(msg.toIdx, 0, movedTc);
        await Store.dataRefresh();
    }
    public static async dragDrop(msg: msgs.DragDropMsg): Promise<void> {
        // Try to get the problem, if not exist, create a new one
        let fullProblem = await Store.getFullProblem(msg.activePath);
        if (!fullProblem) {
            await ProblemActions.createProblem({
                type: 'createProblem',
                activePath: msg.activePath,
            });
            fullProblem = await Store.getFullProblem(msg.activePath);
            if (!fullProblem) {
                return;
            }
        }

        for (const item of msg.items) {
            if (
                await stat(item)
                    .then((s) => s.isDirectory())
                    .catch(() => false)
            ) {
                fullProblem.problem.applyTcs(await TcFactory.fromFolder(item));
                break;
            }
            const ext = extname(item).toLowerCase();
            if (ext === '.zip') {
                fullProblem.problem.applyTcs(
                    await TcFactory.fromZip(fullProblem.problem.src.path, item),
                );
                break;
            }
            if (
                Settings.problem.inputFileExtensionList.includes(ext) ||
                Settings.problem.outputFileExtensionList.includes(ext)
            ) {
                const { stdin, answer } = await TcFactory.fromFile(item);
                fullProblem.problem.addTc(
                    new Tc(stdin ?? new TcIo(), answer ?? new TcIo()),
                );
            }
        }
        await Store.dataRefresh();
    }
}
