import type { WebviewMsg } from '@w/msgs';
import { commands, l10n } from 'vscode';
import { container } from 'tsyringe';
import Io from '@/helpers/io';
import Logger from '@/helpers/logger';
import { getActivePath, sidebarProvider, telemetry } from '@/utils/global';
import { TOKENS } from '@/composition/tokens';

const logger = new Logger('sidebarMessageHandler');

export const handleMessage = async (msg: WebviewMsg) => {
  logger.info('Received', msg.type, 'message');
  logger.debug('Received message data from webview', msg);
  try {
    const problemsManager = container.resolve(TOKENS.ProblemsManager);
    const repo = container.resolve(TOKENS.ProblemRepository);
    const handleEnd = telemetry.start('sidebarMessage', {
      type: msg.type,
    });
    if (msg.type === 'init') {
      sidebarProvider.event.emit('activePath', {
        activePath: getActivePath(),
      });
      await repo.dataRefresh();
    } else if (msg.type === 'createProblem') {
      await problemsManager.createProblem(msg);
    } else if (msg.type === 'importProblem') {
      await problemsManager.importProblem(msg);
    } else if (msg.type === 'editProblemDetails') {
      await problemsManager.editProblemDetails(msg);
    } else if (msg.type === 'delProblem') {
      await problemsManager.delProblem(msg);
    } else if (msg.type === 'addTc') {
      await problemsManager.addTc(msg);
    } else if (msg.type === 'loadTcs') {
      await problemsManager.loadTcs(msg);
    } else if (msg.type === 'updateTc') {
      await problemsManager.updateTc(msg);
    } else if (msg.type === 'runTc') {
      await problemsManager.runTc(msg);
    } else if (msg.type === 'toggleDisable') {
      await problemsManager.toggleDisable(msg);
    } else if (msg.type === 'clearTcStatus') {
      await problemsManager.clearTcStatus(msg);
    } else if (msg.type === 'clearStatus') {
      await problemsManager.clearStatus(msg);
    } else if (msg.type === 'runTcs') {
      await problemsManager.runTcs(msg);
    } else if (msg.type === 'stopTcs') {
      await problemsManager.stopTcs(msg);
    } else if (msg.type === 'chooseTcFile') {
      await problemsManager.chooseTcFile(msg);
    } else if (msg.type === 'compareTc') {
      await problemsManager.compareTc(msg);
    } else if (msg.type === 'toggleTcFile') {
      await problemsManager.toggleTcFile(msg);
    } else if (msg.type === 'delTc') {
      await problemsManager.delTc(msg);
    } else if (msg.type === 'reorderTc') {
      await problemsManager.reorderTc(msg);
    } else if (msg.type === 'chooseSrcFile') {
      await problemsManager.chooseSrcFile(msg);
    } else if (msg.type === 'removeSrcFile') {
      await problemsManager.removeSrcFile(msg);
    } else if (msg.type === 'startBfCompare') {
      await problemsManager.startBfCompare(msg);
    } else if (msg.type === 'stopBfCompare') {
      await problemsManager.stopBfCompare(msg);
    } else if (msg.type === 'submitToCodeforces') {
      await problemsManager.submitToCodeforces(msg);
    } else if (msg.type === 'openFile') {
      await problemsManager.openFile(msg);
    } else if (msg.type === 'openTestlib') {
      await problemsManager.openTestlib(msg);
    } else if (msg.type === 'dragDrop') {
      await problemsManager.dragDrop(msg);
    } else if (msg.type === 'startChat') {
      await commands.executeCommand('workbench.action.chat.open', {
        mode: 'agent',
        query: '#cphNgRunTestCases ',
        isPartialQuery: true,
      });
    } else if (msg.type === 'openSettings') {
      await commands.executeCommand('workbench.action.openSettings', msg.item);
    }
    handleEnd();
  } catch (e) {
    logger.error('Error handling webview message', msg, e);
    Io.error(
      l10n.t('Error occurred when handling message {msgType}: {msg}.', {
        msgType: msg.type,
        msg: (e as Error).message,
      }),
    );
    telemetry.error('sidebarError', e, {
      type: msg.type,
    });
  }
};
