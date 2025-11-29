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

import Io from '@/helpers/io';
import Settings from '@/helpers/settings';
import { ITc, Tc, TcIo } from '@/types';
import { renderUnzipFolder } from '@/utils/strTemplate';
import AdmZip from 'adm-zip';
import { existsSync } from 'fs';
import { mkdir, readdir, unlink } from 'fs/promises';
import { orderBy } from 'natural-orderby';
import { basename, dirname, extname, join } from 'path';
import { l10n, window } from 'vscode';

type ParticleTc = {
  stdin?: TcIo;
  answer?: TcIo;
};

export default class TcFactory {
  private static async getAllFiles(dirPath: string): Promise<string[]> {
    const entries = await readdir(dirPath, { withFileTypes: true });
    const files = await Promise.all(
      entries.map((entry) => {
        const fullPath = join(dirPath, entry.name);
        return entry.isDirectory() ? TcFactory.getAllFiles(fullPath) : fullPath;
      }),
    );
    return files.flat();
  }

  public static async fromFile(
    path: string,
    isInput?: boolean,
  ): Promise<ParticleTc> {
    if (isInput === undefined) {
      isInput = Settings.problem.inputFileExtensionList.includes(
        extname(path).toLowerCase(),
      );
    }
    let stdin: string | undefined, answer: string | undefined;
    isInput ? (stdin = path) : (answer = path);
    const pairExt = isInput
      ? Settings.problem.outputFileExtensionList
      : Settings.problem.inputFileExtensionList;
    const behavior = Settings.problem.foundMatchTestCaseBehavior;
    if (behavior !== 'never') {
      for (const ext of pairExt) {
        const pairPath = path.replace(extname(path), ext);
        if (!existsSync(pairPath)) {
          continue;
        }
        if (behavior === 'ask') {
          const choice = await Io.confirm(
            l10n.t(
              'Found matching {found} file: {file}. Do you want to use it?',
              {
                found: isInput ? l10n.t('answer') : l10n.t('stdin'),
                file: basename(pairPath),
              },
            ),
          );
          if (!choice) {
            continue;
          }
        }
        isInput ? (answer = pairPath) : (stdin = pairPath);
        break;
      }
    }
    const result: ParticleTc = {};
    stdin && (result.stdin = new TcIo(true, stdin));
    answer && (result.answer = new TcIo(true, answer));
    return result;
  }
  public static async fromZip(srcPath: string, zipPath: string): Promise<Tc[]> {
    const zipData = new AdmZip(zipPath);
    const folderPath = renderUnzipFolder(srcPath, zipPath);
    if (folderPath === null) {
      return [];
    }
    await mkdir(folderPath, { recursive: true });
    zipData.extractAllTo(folderPath, true);
    if (Settings.problem.deleteAfterUnzip) {
      await unlink(zipPath);
    }
    return await this.fromFolder(folderPath);
  }
  public static async fromFolder(folderPath: string): Promise<Tc[]> {
    const allFiles = await TcFactory.getAllFiles(folderPath);
    const tcs: ITc[] = [];
    for (const filePath of allFiles) {
      const fileName = basename(filePath);
      const ext = extname(fileName).toLowerCase();
      if (Settings.problem.inputFileExtensionList.includes(ext)) {
        tcs.push({
          stdin: { useFile: true, data: filePath },
          answer: { useFile: false, data: '' },
          isExpand: false,
          isDisabled: false,
        });
      }
    }
    for (const filePath of allFiles) {
      const fileName = basename(filePath);
      const ext = extname(fileName).toLowerCase();
      if (Settings.problem.outputFileExtensionList.includes(ext)) {
        const inputFiles = Settings.problem.inputFileExtensionList.map(
          (inputExt) =>
            join(dirname(filePath), fileName.replace(ext, inputExt)),
        );
        const existingTestCase = tcs.find(
          (tc) => tc.stdin.useFile && inputFiles.includes(tc.stdin.data),
        );
        if (existingTestCase) {
          existingTestCase.answer = {
            useFile: true,
            data: filePath,
          };
        } else {
          tcs.push({
            stdin: { useFile: false, data: '' },
            answer: { useFile: true, data: filePath },
            isExpand: false,
            isDisabled: false,
          });
        }
      }
    }
    if (!tcs.length) {
      Io.warn(l10n.t('No test cases found.'));
      return [];
    }
    const orderedTcs = orderBy(tcs, [
      (it) => (it.stdin.useFile ? 0 : 1),
      (it) =>
        it.stdin.useFile
          ? basename(it.stdin.data)
          : it.answer.useFile
            ? basename(it.answer.data)
            : '',
    ]);
    const chosenIdx = await window.showQuickPick(
      orderedTcs.map((tc, idx) => ({
        label: `${basename(
          tc.stdin.useFile
            ? tc.stdin.data
            : tc.answer.useFile
              ? tc.answer.data
              : 'unknown',
        )}`,
        description: l10n.t('Input {input}, Answer {answer}', {
          input: tc.stdin.useFile
            ? tc.stdin.data.replace(folderPath + '/', '')
            : l10n.t('not found'),
          answer: tc.answer.useFile
            ? tc.answer.data.replace(folderPath + '/', '')
            : l10n.t('not found'),
        }),
        value: idx,
        picked: true,
      })),
      {
        canPickMany: true,
        title: l10n.t('Select test cases to add'),
      },
    );
    if (!chosenIdx) {
      return [];
    }
    return chosenIdx.map((idx) => Tc.fromI(orderedTcs[idx.value]));
  }
}
