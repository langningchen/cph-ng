// biome-ignore-all lint/style/useNamingConvention: JSON-RPC fields follow the Rust wire schema.
import type { CompanionProblem, TestcaseId } from '@cph-ng/core';
import { inject, injectable } from 'tsyringe';
import type { IProblemService } from '@/application/ports/problems/IProblemService';
import type { ITestcaseIoService } from '@/application/ports/problems/ITestcaseIoService';
import { TOKENS } from '@/composition/tokens';
import { Problem } from '@/domain/entities/problem';
import { Testcase } from '@/domain/entities/testcase';
import { TestcaseIo } from '@/domain/entities/testcaseIo';
import { LanguageRegistry } from '@/infrastructure/langs/languageRegistry';
import { ProblemService as LegacyProblemService } from '@/infrastructure/problems/problemService';
import { RpcRemoteError, type TaskInfo } from './client';
import { KernelConfiguration, languageIds, quoteArgument } from './configuration';
import { KernelService, splitArguments } from './kernelService';
import { editorProblem } from './paths';
import { problemChanges, sameProblemData } from './problemChanges';
import { rpcErrorCode, rpcMethod } from './protocol';

export interface ProblemDto {
  id: string;
  code_id?: string;
  source_path: string;
  name: string;
  url: string | null;
  time_limit_ms: number;
  memory_limit_mb: number;
  checker: string | null;
  interactor: string | null;
  generator: string | null;
  brute_force: string | null;
  testcases: Array<{ id: string; stdin: string; answer: string }>;
}
@injectable()
export class RpcProblemService implements IProblemService {
  private ids = new WeakMap<Problem, string>();
  private codeIds = new WeakMap<Problem, string>();
  private writes = new WeakMap<Problem, Promise<void>>();
  private baselines = new WeakMap<Problem, ProblemDto>();
  public constructor(
    @inject(KernelConfiguration) private readonly configuration: KernelConfiguration,
    @inject(LanguageRegistry) private readonly languages: LanguageRegistry,
    @inject(KernelService) private readonly kernel: KernelService,
    @inject(LegacyProblemService) private readonly legacy: LegacyProblemService,
    @inject(TOKENS.testcaseIoService) private readonly io: ITestcaseIoService,
  ) {}
  // Compatibility paths are used only by import/export and editor file choosers.
  public getDataPath(source: string) {
    return this.legacy.getDataPath(source);
  }
  public getTestcasePath(source: string, id: TestcaseId, ext: string) {
    return this.legacy.getTestcasePath(source, id, ext);
  }
  public getLimits(problem: Problem) {
    return this.legacy.getLimits(problem);
  }
  public isRelated(problem: Problem, path: string) {
    return this.legacy.isRelated(problem, path);
  }
  public async loadTestcases(problem: Problem, file: boolean) {
    await this.legacy.loadTestcases(problem, file);
    await this.save(problem);
  }
  public applyTestcases(problem: Problem, testcases: Testcase[]) {
    this.legacy.applyTestcases(problem, testcases);
  }
  public async create(source: string): Promise<Problem> {
    const client = await this.kernel.forSource(source);
    return this.entity(
      await client.request<ProblemDto>(rpcMethod.problemCreate, { source_path: source }),
    );
  }
  public async loadBySrc(source: string): Promise<Problem | null> {
    const client = await this.kernel.forSource(source);
    try {
      return this.entity(
        await client.request<ProblemDto>(rpcMethod.problemLoad, { source_path: source }),
      );
    } catch (error) {
      if (!(error instanceof RpcRemoteError) || error.code !== rpcErrorCode.notIndexed) throw error;
      // Older compressed JSON formats remain readable during migration.
      const old = await this.legacy.loadBySrc(source);
      if (!old) return null;
      await this.save(old);
      const id = this.ids.get(old);
      if (id) await this.kernel.preferences.stageLegacyOverrides(id, old.overrides);
      return this.entity(
        await client.request<ProblemDto>(rpcMethod.problemLoad, { source_path: source }),
      );
    }
  }
  private async entity(dto: ProblemDto): Promise<Problem> {
    await this.configuration.get();
    dto = editorProblem(dto);
    const problem = new Problem(dto.name, dto.source_path);
    this.ids.set(problem, dto.id);
    this.codeIds.set(problem, dto.code_id ?? dto.id);
    problem.url = dto.url;
    problem.overrides.timeLimitMs = dto.time_limit_ms;
    problem.overrides.memoryLimitMb = dto.memory_limit_mb;
    problem.checker = dto.checker ? { path: dto.checker, hash: null } : null;
    problem.interactor = dto.interactor ? { path: dto.interactor, hash: null } : null;
    problem.stressTest.generator = dto.generator ? { path: dto.generator, hash: null } : null;
    problem.stressTest.bruteForce = dto.brute_force ? { path: dto.brute_force, hash: null } : null;
    for (const testcase of dto.testcases)
      problem.addTestcase(
        testcase.id as TestcaseId,
        new Testcase(
          new TestcaseIo({ data: testcase.stdin }),
          new TestcaseIo({ data: testcase.answer }),
        ),
      );
    this.kernel.preferences.restore(dto.id, problem);
    const config = await this.configuration.get(dto.source_path);
    const language = this.languages.getLangByFile(dto.source_path);
    const id = language ? languageIds[language.name] : undefined;
    const local = config.local_config.languages as
      | Record<string, Record<string, unknown>>
      | undefined;
    const values = id ? local?.[id] : undefined;
    if (values) {
      if (typeof values.compiler === 'string') problem.overrides.compiler = values.compiler;
      if (Array.isArray(values.compiler_args))
        problem.overrides.compilerArgs = values.compiler_args
          .map(String)
          .map(quoteArgument)
          .join(' ');
      if (typeof values.interpreter === 'string')
        problem.overrides.interpreter = values.interpreter;
      if (Array.isArray(values.interpreter_args))
        problem.overrides.interpreterArgs = values.interpreter_args
          .map(String)
          .map(quoteArgument)
          .join(' ');
    }
    this.baselines.set(problem, structuredClone(dto));
    return problem;
  }
  public async updateOverrides(problem: Problem, overrides: Problem['overrides']): Promise<void> {
    const language = this.languages.getLangByFile(problem.src.path);
    if (language) {
      const values: Record<string, unknown> = {};
      for (const [field, key] of [
        ['compiler', 'compiler'],
        ['compilerArgs', 'compiler_args'],
        ['interpreter', 'interpreter'],
        ['interpreterArgs', 'interpreter_args'],
      ] as const) {
        if (overrides[field] === problem.overrides[field]) continue;
        values[key] =
          overrides[field] === null
            ? null
            : key.endsWith('_args')
              ? splitArguments(overrides[field] ?? '')
              : overrides[field];
      }
      if (Object.keys(values).length)
        await this.configuration.set(
          { patch: { languages: { [languageIds[language.name]]: values } } },
          problem.src.path,
        );
    }
    problem.overrides = overrides;
  }
  public async reference(problem: Problem): Promise<{ problem_id: string; source_path: string }> {
    if (this.ids.has(problem)) await this.writes.get(problem);
    else await this.save(problem);
    const id = this.ids.get(problem);
    if (!id) throw new Error('Problem has no kernel identity');
    return { problem_id: id, source_path: problem.src.path };
  }
  public save(problem: Problem): Promise<void> {
    const pending = (this.writes.get(problem) ?? Promise.resolve())
      .catch(() => {})
      .then(() => this.persist(problem));
    this.writes.set(problem, pending);
    return pending;
  }
  private async snapshot(problem: Problem): Promise<ProblemDto> {
    const limits = this.getLimits(problem);
    const stress = problem.stressTest.generator && problem.stressTest.bruteForce;
    return {
      id: this.ids.get(problem) ?? '',
      source_path: problem.src.path,
      name: problem.name,
      url: problem.url,
      time_limit_ms: limits.timeLimitMs,
      memory_limit_mb: limits.memoryLimitMb,
      checker: problem.checker?.path ?? null,
      interactor: problem.interactor?.path ?? null,
      generator: stress ? (problem.stressTest.generator?.path ?? null) : null,
      brute_force: stress ? (problem.stressTest.bruteForce?.path ?? null) : null,
      testcases: await Promise.all(
        problem.testcaseOrder.map(async (id) => {
          const testcase = problem.getTestcase(id);
          return {
            id,
            stdin: await this.io.readContent(testcase.stdin),
            answer: await this.io.readContent(testcase.answer),
          };
        }),
      ),
    };
  }
  private async persist(problem: Problem): Promise<void> {
    await this.configuration.get();
    const local = await this.snapshot(problem);
    let id = this.ids.get(problem);
    let base = this.baselines.get(problem);
    const client = await this.kernel.forSource(problem.src.path);
    // Auxiliary files were explicitly selected by the user. Reattach their roots
    // even on an unchanged save, so they also work after the daemon restarts.
    for (const source of new Set([
      local.checker,
      local.interactor,
      local.generator,
      local.brute_force,
    ]))
      if (source) await this.kernel.forSource(source);
    if (id && base && sameProblemData(base, local)) {
      await this.kernel.preferences.save(id, problem);
      return;
    }
    let stored: ProblemDto;
    if (!id) {
      stored = await client.request<ProblemDto>(rpcMethod.problemImport, {
        source_path: problem.src.path,
        format: 'companion',
        problem: {
          name: local.name,
          url: local.url,
          timeLimit: local.time_limit_ms,
          memoryLimit: local.memory_limit_mb,
          tests: local.testcases.map((testcase) => ({
            id: testcase.id,
            input: testcase.stdin,
            output: testcase.answer,
          })),
        },
      });
      id = stored.id;
      local.id = id;
      this.ids.set(problem, id);
      stored = editorProblem(stored);
      base = structuredClone(stored);
      this.baselines.set(problem, base);
      problem.overrides.timeLimitMs ??= stored.time_limit_ms;
      problem.overrides.memoryLimitMb ??= stored.memory_limit_mb;
    } else {
      if (!base) throw new Error('Reopen the problem before saving.');
      stored = editorProblem(
        await client.request<ProblemDto>(rpcMethod.problemLoad, { problem_id: id }),
      );
    }
    const change = problemChanges(base, local, stored);
    // Advance only successfully committed portions of the baseline so retries retain unsaved edits.
    if (Object.keys(change.details).length) {
      await client.request(rpcMethod.problemUpdate, { problem_id: id, ...change.details });
      Object.assign(base, change.details);
    }
    for (const testcaseId of change.deleted) {
      await client.request(rpcMethod.testcaseDelete, { problem_id: id, testcase_id: testcaseId });
      base.testcases = base.testcases.filter((testcase) => testcase.id !== testcaseId);
    }
    for (const testcase of change.added) {
      await client.request(rpcMethod.testcaseAdd, {
        problem_id: id,
        testcase_id: testcase.id,
        stdin: testcase.stdin,
        answer: testcase.answer,
      });
      base.testcases.push({ ...testcase });
    }
    for (const testcase of change.updated) {
      const { id: testcaseId, ...patch } = testcase;
      await client.request(rpcMethod.testcaseUpdate, {
        problem_id: id,
        testcase_id: testcaseId,
        ...patch,
      });
      const previous = base.testcases.find((item) => item.id === testcaseId);
      if (previous) Object.assign(previous, patch);
    }
    if (change.order)
      await client.request(rpcMethod.testcaseReorder, {
        problem_id: id,
        testcase_ids: change.order,
      });
    this.baselines.set(problem, local);
    await this.kernel.preferences.save(id, problem);
  }
  /** Run all current kernel testcases, excluding only explicit local selections. No persistence occurs. */
  public async enabledTestcaseIds(problem: Problem): Promise<TestcaseId[]> {
    const reference = await this.reference(problem);
    const client = await this.kernel.forSource(problem.src.path);
    const current = await client.request<ProblemDto['testcases']>(
      rpcMethod.testcaseList,
      reference,
    );
    const base = this.baselines.get(problem);
    const known = new Set(base?.testcases.map((testcase) => testcase.id));
    const selected: TestcaseId[] = [];
    for (const testcase of current) {
      const id = testcase.id as TestcaseId;
      if (!problem.testcases.has(id)) {
        if (known.has(id)) continue; // An unsaved local deletion is still an explicit selection.
        problem.addTestcase(
          id,
          new Testcase(
            new TestcaseIo({ data: testcase.stdin }),
            new TestcaseIo({ data: testcase.answer }),
          ),
        );
        base?.testcases.push({ ...testcase });
      } else {
        const previous = base?.testcases.find((item) => item.id === id);
        const local = problem.getTestcase(id);
        if (previous) {
          for (const field of ['stdin', 'answer'] as const) {
            if ((await this.io.readContent(local[field])) !== previous[field]) continue;
            if (previous[field] !== testcase[field])
              local[field] = new TestcaseIo({ data: testcase[field] });
            previous[field] = testcase[field];
          }
        }
      }
      if (!problem.getTestcase(id).isDisabled) selected.push(id);
    }
    return selected;
  }
  public async delete(problem: Problem): Promise<void> {
    const client = await this.kernel.forSource(problem.src.path);
    await client.request(
      rpcMethod.problemDelete,
      this.ids.has(problem)
        ? { problem_id: this.ids.get(problem) }
        : { source_path: problem.src.path },
    );
    const id = this.ids.get(problem);
    if (id) await this.kernel.preferences.remove(id);
    this.ids.delete(problem);
    this.codeIds.delete(problem);
    this.baselines.delete(problem);
  }
  public async importCompanion(source: string, problem: CompanionProblem): Promise<void> {
    const client = await this.kernel.forSource(source);
    await client.request(rpcMethod.problemImport, {
      source_path: source,
      format: 'companion',
      problem,
    });
  }
  public async move(problem: Problem, destination: string): Promise<void> {
    const reference = await this.reference(problem);
    const client = await this.kernel.forSource(destination);
    await client.request(rpcMethod.problemMove, {
      problem_id: reference.problem_id,
      code_id: this.codeIds.get(problem) ?? reference.problem_id,
      destination,
    });
    problem.src.path = destination;
  }
  public async history(problem: Problem): Promise<TaskInfo[]> {
    const reference = await this.reference(problem);
    const client = await this.kernel.forSource(problem.src.path);
    return client.request(rpcMethod.historyList, reference);
  }
  public async loadHistory(problem: Problem, runId: string): Promise<TaskInfo> {
    const client = await this.kernel.forSource(problem.src.path);
    return client.request(rpcMethod.historyLoad, { run_id: runId });
  }
}
