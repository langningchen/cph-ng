import { Compiler } from '@/core/compiler';
import { Runner } from '@/core/runner';
import {
    isExpandVerdict,
    isRunningVerdict,
    TcResult,
    TcVerdicts,
    TcWithResult,
} from '@/types';
import { waitUntil } from '@/utils/global';
import { KnownResult } from '@/utils/result';
import * as msgs from '@/webview/src/msgs';
import Store from './store';

export class TcRunner {
    public static async runTc(msg: msgs.RunTcMsg): Promise<void> {
        const fullProblem = await Store.getFullProblem(msg.activePath);
        if (!fullProblem) {
            return;
        }
        fullProblem.ac && fullProblem.ac.abort();
        fullProblem.ac = new AbortController();

        try {
            const tc = fullProblem.problem.tcs[msg.id] as TcWithResult;
            tc.result?.dispose();
            tc.result = new TcResult(TcVerdicts.CP);
            tc.isExpand = false;
            await Store.dataRefresh();

            // Compile
            const compileResult = await Compiler.compileAll(
                fullProblem.problem,
                msg.compile,
                fullProblem.ac,
            );
            if (compileResult instanceof KnownResult) {
                tc.result.fromResult(compileResult);
                tc.isExpand = true;
                return;
            }
            tc.result.verdict = TcVerdicts.CPD;

            // Run
            await Runner.run(
                fullProblem.problem,
                tc,
                compileResult.data.srcLang,
                fullProblem.ac,
                compileResult.data,
            );
            tc.isExpand = isExpandVerdict(tc.result.verdict);
        } finally {
            fullProblem.ac = null;
            await Store.dataRefresh();
        }
    }

    public static async runTcs(msg: msgs.RunTcsMsg): Promise<void> {
        const fullProblem = await Store.getFullProblem(msg.activePath);
        if (!fullProblem) {
            return;
        }
        fullProblem.ac && fullProblem.ac.abort();
        fullProblem.ac = new AbortController();

        try {
            const tcs = fullProblem.problem.tcs;
            const tcOrder = [...fullProblem.problem.tcOrder].filter(
                (id) => !tcs[id].isDisabled,
            );
            for (const tcId of tcOrder) {
                tcs[tcId].result?.dispose();
                tcs[tcId].result = new TcResult(TcVerdicts.CP);
                tcs[tcId].isExpand = false;
            }
            await Store.dataRefresh();

            // Compile
            const compileResult = await Compiler.compileAll(
                fullProblem.problem,
                msg.compile,
                fullProblem.ac,
            );
            if (compileResult instanceof KnownResult) {
                for (const tcId of tcOrder) {
                    tcs[tcId].result?.fromResult(compileResult);
                }
                return;
            }
            for (const tcId of tcOrder) {
                const result = tcs[tcId].result;
                if (result) {
                    result.verdict = TcVerdicts.CPD;
                }
            }
            await Store.dataRefresh();

            // Run
            let hasExpandStatus = false;
            for (const tcId of tcOrder) {
                const tc = tcs[tcId] as TcWithResult;
                if (!tc.result) {
                    continue;
                }
                if (fullProblem.ac.signal.aborted) {
                    if (fullProblem.ac.signal.reason === 'onlyOne') {
                        fullProblem.ac = new AbortController();
                    } else {
                        tc.result.verdict = TcVerdicts.SK;
                        continue;
                    }
                }
                await Runner.run(
                    fullProblem.problem,
                    tc,
                    compileResult.data.srcLang,
                    fullProblem.ac,
                    compileResult.data,
                );
                if (!hasExpandStatus) {
                    tc.isExpand = isExpandVerdict(tc.result.verdict);
                    await Store.dataRefresh();
                    hasExpandStatus = tc.isExpand;
                }
            }
        } finally {
            fullProblem.ac = null;
            await Store.dataRefresh();
        }
    }

    public static async stopTcs(msg: msgs.StopTcsMsg): Promise<void> {
        const fullProblem = await Store.getFullProblem(msg.activePath);
        if (!fullProblem) {
            return;
        }
        if (fullProblem.ac) {
            fullProblem.ac.abort(msg.onlyOne ? 'onlyOne' : undefined);
            if (msg.onlyOne) {
                return;
            }
            await waitUntil(() => !fullProblem.ac);
        }
        for (const tc of Object.values(fullProblem.problem.tcs)) {
            if (tc.result && isRunningVerdict(tc.result.verdict)) {
                tc.result.verdict = TcVerdicts.RJ;
            }
        }
        await Store.dataRefresh();
    }
}
