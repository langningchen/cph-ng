import * as msgs from '@/webview/src/msgs';
import { BfCompare } from './bfCompare';
import { ProblemActions } from './problemActions';
import Store, { FullProblem } from './store';
import { TcActions } from './tcActions';
import { TcRunner } from './tcRunner';

export default class ProblemsManager {
    public static async listFullProblems(): Promise<FullProblem[]> {
        return Store.listFullProblems();
    }
    public static async getFullProblem(
        path?: string,
    ): Promise<FullProblem | null> {
        return Store.getFullProblem(path);
    }
    public static async dataRefresh() {
        return Store.dataRefresh();
    }
    public static async closeAll() {
        return Store.closeAll();
    }

    // Problem Actions
    public static async createProblem(msg: msgs.CreateProblemMsg) {
        return ProblemActions.createProblem(msg);
    }
    public static async importProblem(msg: msgs.ImportProblemMsg) {
        return ProblemActions.importProblem(msg);
    }
    public static async editProblemDetails(msg: msgs.EditProblemDetailsMsg) {
        return ProblemActions.editProblemDetails(msg);
    }
    public static async delProblem(msg: msgs.DelProblemMsg) {
        return ProblemActions.delProblem(msg);
    }
    public static async chooseSrcFile(msg: msgs.ChooseSrcFileMsg) {
        return ProblemActions.chooseSrcFile(msg);
    }
    public static async removeSrcFile(msg: msgs.RemoveSrcFileMsg) {
        return ProblemActions.removeSrcFile(msg);
    }
    public static async submitToCodeforces(msg: msgs.SubmitToCodeforcesMsg) {
        return ProblemActions.submitToCodeforces(msg);
    }
    public static async openFile(msg: msgs.OpenFileMsg) {
        return ProblemActions.openFile(msg);
    }
    public static async debugTc(msg: msgs.DebugTcMsg) {
        return ProblemActions.debugTc(msg);
    }

    // TC Actions
    public static async addTc(msg: msgs.AddTcMsg) {
        return TcActions.addTc(msg);
    }
    public static async loadTcs(msg: msgs.LoadTcsMsg) {
        return TcActions.loadTcs(msg);
    }
    public static async updateTc(msg: msgs.UpdateTcMsg) {
        return TcActions.updateTc(msg);
    }
    public static async toggleDisable(msg: msgs.ToggleDisableMsg) {
        return TcActions.toggleDisable(msg);
    }
    public static async clearTcStatus(msg: msgs.ClearTcStatusMsg) {
        return TcActions.clearTcStatus(msg);
    }
    public static async clearStatus(msg: msgs.ClearStatusMsg) {
        return TcActions.clearStatus(msg);
    }
    public static async chooseTcFile(msg: msgs.ChooseTcFileMsg) {
        return TcActions.chooseTcFile(msg);
    }
    public static async compareTc(msg: msgs.CompareTcMsg) {
        return TcActions.compareTc(msg);
    }
    public static async toggleTcFile(msg: msgs.ToggleTcFileMsg) {
        return TcActions.toggleTcFile(msg);
    }
    public static async delTc(msg: msgs.DelTcMsg) {
        return TcActions.delTc(msg);
    }
    public static async reorderTc(msg: msgs.ReorderTcMsg) {
        return TcActions.reorderTc(msg);
    }
    public static async dragDrop(msg: msgs.DragDropMsg) {
        return TcActions.dragDrop(msg);
    }

    // Runner
    public static async runTc(msg: msgs.RunTcMsg) {
        return TcRunner.runTc(msg);
    }
    public static async runTcs(msg: msgs.RunTcsMsg) {
        return TcRunner.runTcs(msg);
    }
    public static async stopTcs(msg: msgs.StopTcsMsg) {
        return TcRunner.stopTcs(msg);
    }

    // BfCompare
    public static async startBfCompare(msg: msgs.StartBfCompareMsg) {
        return BfCompare.startBfCompare(msg);
    }
    public static async stopBfCompare(msg: msgs.StopBfCompareMsg) {
        return BfCompare.stopBfCompare(msg);
    }
}
