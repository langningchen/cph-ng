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

import { CompilationIo } from '@/helpers/io';
import { UUID } from 'crypto';
import {
  CancellationToken,
  l10n,
  LanguageModelTextPart,
  LanguageModelTool,
  LanguageModelToolInvocationOptions,
  LanguageModelToolInvocationPrepareOptions,
  LanguageModelToolResult,
  PreparedToolInvocation,
} from 'vscode';
import ProblemsManager from '../modules/problems/manager';

interface CphTestRunnerParams {
  activePath: string;
  id?: UUID;
}

class LlmTcRunner implements LanguageModelTool<CphTestRunnerParams> {
  async prepareInvocation(
    options: LanguageModelToolInvocationPrepareOptions<CphTestRunnerParams>,
    _token: CancellationToken,
  ): Promise<PreparedToolInvocation> {
    const { id } = options.input;
    return {
      invocationMessage: id
        ? l10n.t('Running test case {id} using CPH-NG...', {
            id,
          })
        : l10n.t('Running all test cases using CPH-NG...'),
      confirmationMessages: {
        title: l10n.t('Run Test Cases'),
        message: id
          ? l10n.t(
              'Do you want to run test case {id} for the current problem?',
              { id },
            )
          : l10n.t(
              'Do you want to run all test cases for the current problem?',
            ),
      },
    };
  }

  async invoke(
    options: LanguageModelToolInvocationOptions<CphTestRunnerParams>,
    token: CancellationToken,
  ): Promise<LanguageModelToolResult> {
    const { id } = options.input;
    const result = new LanguageModelToolResult([]);

    const activePath = options.input.activePath;
    const bgProblem = await ProblemsManager.getFullProblem(activePath);
    if (!bgProblem) {
      result.content.push(
        new LanguageModelTextPart(
          l10n.t(
            'Error: No competitive programming problem found. Please ask the user to open or create a problem first.',
          ),
        ),
      );
      return result;
    }

    const problem = bgProblem.problem;
    if (id !== undefined) {
      if (typeof id !== 'string' || !id.trim()) {
        result.content.push(
          new LanguageModelTextPart(
            l10n.t('Error: Test case identifier must be a non-empty string.'),
          ),
        );
        return result;
      }
      if (!problem.tcs[id]) {
        result.content.push(
          new LanguageModelTextPart(
            l10n.t('Error: Test case {id} not found in the current problem.', {
              id,
            }),
          ),
        );
        return result;
      }
    }

    try {
      token.onCancellationRequested(async () => {
        await ProblemsManager.stopTcs({
          type: 'stopTcs',
          activePath,
          onlyOne: false,
        });
      });

      if (id !== undefined) {
        await ProblemsManager.runTc({
          type: 'runTc',
          activePath,
          id,
          compile: null,
        });
      } else {
        await ProblemsManager.runTcs({
          type: 'runTcs',
          activePath,
          compile: null,
        });
      }
    } catch (e: any) {
      result.content.push(
        new LanguageModelTextPart(
          l10n.t('Failed to run test cases: {msg}', {
            msg: e?.message ?? String(e),
          }),
        ),
      );
      return result;
    }

    const refreshedBg = await ProblemsManager.getFullProblem(activePath);
    if (!refreshedBg || !refreshedBg.problem) {
      result.content.push(
        new LanguageModelTextPart(
          l10n.t('Error: Unable to retrieve problem after running test cases.'),
        ),
      );
      return result;
    }

    const refreshedProblem = refreshedBg.problem;
    const tcIds = id !== undefined ? [id] : refreshedProblem.tcOrder;
    const tcs = tcIds
      .map((tcId) => refreshedProblem.tcs[tcId])
      .filter((tc) => tc !== undefined);

    if (tcs.length === 0) {
      result.content.push(
        new LanguageModelTextPart(
          l10n.t('No test cases are available to display.'),
        ),
      );
      return result;
    }

    const firstResult = tcs[0]?.result;
    const outputParts: string[] = [];

    if (firstResult?.verdict.name === 'CE') {
      outputParts.push(l10n.t('Compilation Error'));
      if (firstResult.msg) {
        outputParts.push('');
        outputParts.push(
          l10n.t('Compiler message: {msg}', {
            msg: firstResult.msg,
          }),
        );
      }
      if (CompilationIo.toString()) {
        outputParts.push('');
        outputParts.push(CompilationIo.toString());
      }
    } else {
      const verdictSummary = new Map<
        string,
        { count: number; fullName: string }
      >();
      for (const tc of tcs) {
        const res = tc.result;
        if (!res) {
          continue;
        }
        const summaryEntry = verdictSummary.get(res.verdict.name) ?? {
          count: 0,
          fullName: res.verdict.fullName,
        };
        summaryEntry.count += 1;
        verdictSummary.set(res.verdict.name, summaryEntry);
      }

      if (verdictSummary.size > 0) {
        const summaryText = Array.from(verdictSummary.entries())
          .map(([name, info]) => `${name} (${info.fullName}): ${info.count}`)
          .join(', ');
        outputParts.push(
          l10n.t('Test cases run successfully. Summary: {summary}', {
            summary: summaryText,
          }),
        );
      } else {
        outputParts.push(l10n.t('Test cases run successfully.'));
      }
      outputParts.push('');

      tcs.forEach((tc, testCaseIndex) => {
        const tcId = tcIds[testCaseIndex];
        const testResult = tc.result;
        outputParts.push(
          l10n.t('--- Test Case {id} ---', {
            id: tcId,
          }),
        );
        if (!testResult) {
          outputParts.push(
            l10n.t('No execution result available for this run.'),
          );
          outputParts.push('');
          return;
        }
        outputParts.push(
          l10n.t('Verdict: {name} ({fullName})', {
            name: testResult.verdict.name,
            fullName: testResult.verdict.fullName,
          }),
        );
        outputParts.push(
          l10n.t('Time: {time}ms', {
            time: testResult.time,
          }),
        );
        if (testResult.memory !== undefined) {
          outputParts.push(
            l10n.t('Memory: {memory}KB', {
              memory: testResult.memory,
            }),
          );
        }
        if (testResult.msg) {
          outputParts.push(
            l10n.t('Message: {msg}', {
              msg: testResult.msg,
            }),
          );
        }
        outputParts.push('');
      });
    }

    result.content.push(new LanguageModelTextPart(outputParts.join('\n')));
    return result;
  }
}

export default LlmTcRunner;
