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

import Cache from '@/helpers/cache';
import Io from '@/helpers/io';
import Logger from '@/helpers/logger';
import Settings from '@/helpers/settings';
import { randomUUID, UUID } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { mkdir, readFile, stat, unlink, writeFile } from 'fs/promises';
import { basename, dirname, extname, join, relative } from 'path';
import { l10n } from 'vscode';
import { gunzipSync, gzipSync } from 'zlib';
import { version } from '../utils/packageInfo';
import { exists } from '../utils/process';
import { KnownResult } from '../utils/result';
import { renderPathWithFile } from '../utils/strTemplate';
import { migration, OldProblem } from './migration';
import {
  IBfCompare,
  ICompilationSettings,
  IFileWithHash,
  IProblem,
  ITc,
  ITcIo,
  ITcResult,
  ITcVerdict,
} from './types';

export class TcVerdict implements ITcVerdict {
  constructor(
    public name: string,
    public fullName: string,
    public color: string,
  ) {}
}

export class TcResult implements ITcResult {
  public time?: number;
  public memory?: number;
  public stdout: TcIo = new TcIo();
  public stderr: TcIo = new TcIo();
  public msg: string[] = [];

  constructor(public verdict: TcVerdict = TcVerdicts.UKE) {}
  public fromI(result: ITcResult): void {
    this.verdict = result.verdict;
    this.time = result.time;
    this.memory = result.memory;
    this.stdout.fromI(result.stdout);
    this.stderr.fromI(result.stderr);
    this.msg = result.msg || [];
  }
  public fromResult<T>(result: KnownResult<T>) {
    this.verdict = result.verdict;
    result.msg && this.msg.push(result.msg);
  }
  public dispose() {
    this.stdout.dispose();
    this.stderr.dispose();
  }
}
export class TcIo {
  useFile: boolean;
  data: string;

  constructor(useFile?: boolean, data?: string) {
    this.useFile = useFile ||= false;
    this.data = data || '';
  }

  public fromI(tc: ITcIo) {
    this.useFile = tc.useFile;
    this.data = tc.data;
  }
  public fromString(data: string): void {
    if (this.useFile) {
      writeFileSync(this.data, data);
    } else {
      this.data = data;
    }
  }
  public toString(): string {
    if (this.useFile) {
      return readFileSync(this.data, 'utf-8');
    } else {
      return this.data;
    }
  }
  public toPath(): string {
    if (this.useFile) {
      return this.data;
    } else {
      const path = Cache.createIo();
      writeFileSync(path, this.data);
      return path;
    }
  }
  public async inlineSmall(): Promise<void> {
    if (this.useFile) {
      try {
        const stats = await stat(this.data);
        if (stats.size <= Settings.problem.maxInlineDataLength) {
          const filePath = this.data;
          this.useFile = false;
          this.data = await readFile(filePath, 'utf-8');
          Cache.dispose(filePath);
        }
      } catch {}
    }
  }
  public dispose() {
    this.useFile && Cache.dispose(this.data);
  }
}

export class Tc implements ITc {
  constructor(
    public stdin: TcIo = new TcIo(),
    public answer: TcIo = new TcIo(),
    public isExpand: boolean = false,
    public isDisabled: boolean = false,
    public result?: TcResult,
  ) {}
  public static fromI(tc: ITc): Tc {
    const instance = new Tc();
    instance.fromI(tc);
    return instance;
  }
  public fromI(tc: ITc): void {
    (this.stdin.fromI(tc.stdin), this.answer.fromI(tc.answer));
    ((this.isExpand = tc.isExpand), (this.isDisabled = tc.isDisabled));
    if (tc.result) {
      this.result = new TcResult();
      this.result.fromI(tc.result);
    }
  }
}
export type TcWithResult = Tc & { result: TcResult };

export class FileWithHash implements IFileWithHash {
  constructor(
    public path: string,
    public hash?: string,
  ) {}
}

export const TcVerdicts = {
  UKE: new TcVerdict('UKE', l10n.t('Unknown Error'), '#0000ff'),
  AC: new TcVerdict('AC', l10n.t('Accepted'), '#49cd32'),
  PC: new TcVerdict('PC', l10n.t('Partially Correct'), '#ed9813'),
  PE: new TcVerdict('PE', l10n.t('Presentation Error'), '#ff778e'),
  WA: new TcVerdict('WA', l10n.t('Wrong Answer'), '#d3140d'),
  TLE: new TcVerdict('TLE', l10n.t('Time Limit Exceed'), '#0c0066'),
  MLE: new TcVerdict('MLE', l10n.t('Memory Limit Exceed'), '#5300a7'),
  OLE: new TcVerdict('OLE', l10n.t('Output Limit Exceed'), '#8300a7'),
  RE: new TcVerdict('RE', l10n.t('Runtime Error'), '#1a26c8'),
  RF: new TcVerdict('RF', l10n.t('Restricted Function'), '#008f81'),
  CE: new TcVerdict('CE', l10n.t('Compilation Error'), '#8b7400'),
  SE: new TcVerdict('SE', l10n.t('System Error'), '#000000'),
  WT: new TcVerdict('WT', l10n.t('Waiting'), '#4100d9'),
  FC: new TcVerdict('FC', l10n.t('Fetched'), '#4c00ff'),
  CP: new TcVerdict('CP', l10n.t('Compiling'), '#5e19ff'),
  CPD: new TcVerdict('CPD', l10n.t('Compiled'), '#7340ff'),
  JG: new TcVerdict('JG', l10n.t('Judging'), '#844fff'),
  JGD: new TcVerdict('JGD', l10n.t('Judged'), '#967fff'),
  CMP: new TcVerdict('CMP', l10n.t('Comparing'), '#a87dff'),
  SK: new TcVerdict('SK', l10n.t('Skipped'), '#4b4b4b'),
  RJ: new TcVerdict('RJ', l10n.t('Rejected'), '#4e0000'),
} as const;

export class Problem implements IProblem {
  private static logger = new Logger('Problem');

  public version: string = version;
  public name: string;
  public url?: string;
  public tcs: Record<UUID, Tc> = {};
  public tcOrder: UUID[] = [];
  public timeLimit: number = Settings.problem.defaultTimeLimit;
  public memoryLimit: number = Settings.problem.defaultMemoryLimit;
  public src: FileWithHash;
  public checker?: FileWithHash;
  public interactor?: FileWithHash;
  public bfCompare?: IBfCompare;
  public timeElapsed: number = 0;
  public compilationSettings?: ICompilationSettings;

  constructor(name: string, src: string) {
    this.name = name;
    this.src = new FileWithHash(src);
  }

  public static fromI(problem: IProblem): Problem {
    const instance = new Problem(problem.name, problem.src.path);
    instance.fromI(problem);
    return instance;
  }
  public fromI(problem: IProblem): void {
    this.version = problem.version;
    this.name = problem.name;
    this.url = problem.url;
    this.tcs = Object.fromEntries(
      Object.entries(problem.tcs).map(([id, tc]) => [id, Tc.fromI(tc)]),
    );
    this.tcOrder = [...problem.tcOrder];
    this.timeLimit = problem.timeLimit;
    this.memoryLimit = problem.memoryLimit;
    this.src = new FileWithHash(problem.src.path);
    this.src.hash = problem.src.hash;
    problem.checker &&
      (this.checker = new FileWithHash(
        problem.checker.path,
        problem.checker.hash,
      ));
    problem.interactor &&
      (this.interactor = new FileWithHash(
        problem.interactor.path,
        problem.interactor.hash,
      ));
    if (problem.bfCompare) {
      this.bfCompare = { ...problem.bfCompare };
    }
    this.timeElapsed = problem.timeElapsed;
    if (problem.compilationSettings) {
      this.compilationSettings = { ...problem.compilationSettings };
    }
  }
  public static async fromSrc(srcPath: string): Promise<Problem | null> {
    const binPath = await Problem.getBinBySrc(srcPath);
    if (!binPath) {
      return null;
    }
    try {
      var data = await readFile(binPath);
    } catch {
      return null;
    }

    try {
      var oldProblem = JSON.parse(gunzipSync(data).toString()) as OldProblem;
    } catch (e) {
      Io.warn(
        l10n.t('Parse problem {file} failed: {msg}.', {
          file: basename(binPath),
          msg: (e as Error).message,
        }),
      );
      return null;
    }

    // Migrate old problem data to the latest version
    try {
      var problem = migration(oldProblem);
    } catch (e) {
      Io.warn(
        l10n.t('Migrate problem {file} failed: {msg}.', {
          file: basename(binPath),
          msg: (e as Error).message,
        }),
      );
      return null;
    }

    // When the user moves the workspace
    // we need to fix the paths in the problem data
    const fixPath = async (oldPath: string): Promise<string> => {
      if (await exists(oldPath)) {
        return oldPath;
      }
      // Use the relative path from the old path to the src file
      // and join it with the new src file path
      const newPath = join(
        dirname(srcPath),
        relative(dirname(problem.src.path), oldPath),
      );
      if (await exists(newPath)) {
        this.logger.debug('Fixed path', oldPath, 'to', newPath);
        return newPath;
      }
      return oldPath;
    };
    const fixTcIo = async (tcIo: TcIo) => {
      tcIo.useFile && (tcIo.data = await fixPath(tcIo.data));
    };
    const fixFileWithHash = async (fileWithHash?: FileWithHash) => {
      fileWithHash && (fileWithHash.path = await fixPath(fileWithHash.path));
    };

    const promises: Promise<void>[] = [];
    for (const tc of Object.values(problem.tcs)) {
      promises.push(fixTcIo(tc.stdin), fixTcIo(tc.answer));
    }
    promises.push(
      fixFileWithHash(problem.checker),
      fixFileWithHash(problem.interactor),
      fixFileWithHash(problem.bfCompare?.generator),
      fixFileWithHash(problem.bfCompare?.bruteForce),
    );
    await Promise.all(promises);
    problem.src.path = srcPath;

    this.logger.info('Problem', problem.src.path, 'loaded');
    this.logger.trace('Loaded problem data', { problem });
    return problem;
  }

  public static async getBinBySrc(srcPath: string): Promise<string | null> {
    return renderPathWithFile(Settings.problem.problemFilePath, srcPath, true);
  }
  public async getBin(): Promise<string | null> {
    return Problem.getBinBySrc(this.src.path);
  }

  public addTc(tc: Tc): UUID {
    const uuid = randomUUID();
    this.tcs[uuid] = tc;
    this.tcOrder.push(uuid);
    return uuid;
  }
  public applyTcs(tcs: Tc[]) {
    Settings.problem.clearBeforeLoad && (this.tcOrder = []);
    for (const tc of tcs) {
      this.addTc(Tc.fromI(tc));
    }
  }
  public isRelated(path?: string): boolean {
    if (!path) {
      return false;
    }
    path = path.toLowerCase();

    // We always consider the IO files related to the problem
    if (
      Settings.problem.inputFileExtensionList.includes(extname(path)) ||
      Settings.problem.outputFileExtensionList.includes(extname(path))
    ) {
      return true;
    }

    if (
      path.startsWith(Settings.cache.directory.toLowerCase()) ||
      this.src.path.toLowerCase() === path ||
      this.checker?.path.toLowerCase() === path ||
      this.interactor?.path.toLowerCase() === path ||
      this.bfCompare?.bruteForce?.path.toLowerCase() === path ||
      this.bfCompare?.generator?.path.toLowerCase() === path
    ) {
      return true;
    }
    const tcIoRelated = (tcIo?: TcIo) =>
      tcIo && tcIo.useFile && tcIo.data.toLowerCase() === path;
    for (const tc of Object.values(this.tcs)) {
      if (
        tcIoRelated(tc.stdin) ||
        tcIoRelated(tc.answer) ||
        tcIoRelated(tc.result?.stdout) ||
        tcIoRelated(tc.result?.stderr)
      ) {
        return true;
      }
    }
    return false;
  }
  public async save(): Promise<boolean> {
    const binPath = await this.getBin();
    if (!binPath) {
      return false;
    }
    Problem.logger.trace('Saving problem data', this, 'to', binPath);
    for (const [key, tc] of Object.entries(this.tcs)) {
      this.tcOrder.includes(key as UUID) ||
        (tc.stdin.dispose(), tc.answer.dispose(), tc.result?.dispose());
    }
    this.tcs = Object.fromEntries(
      Object.entries(this.tcs).filter(([key]) =>
        this.tcOrder.includes(key as UUID),
      ),
    );
    try {
      await mkdir(dirname(binPath), { recursive: true });
      await writeFile(binPath, gzipSync(Buffer.from(JSON.stringify(this))));
      Problem.logger.info('Saved problem', this.src.path);
      return true;
    } catch (e) {
      Problem.logger.error('Failed to save problem', this.src.path, e);
      Io.error(
        l10n.t('Failed to save problem: {msg}', {
          msg: (e as Error).message,
        }),
      );
      return false;
    }
  }
  public async del() {
    const binPath = await this.getBin();
    if (!binPath) {
      return;
    }
    try {
      await unlink(binPath);
      Problem.logger.info('Deleted problem', this.src.path);
    } catch (e) {
      Problem.logger.warn(
        l10n.t('Delete problem {file} failed: {msg}.', {
          file: binPath,
          msg: (e as Error).message,
        }),
      );
    }
  }
}
