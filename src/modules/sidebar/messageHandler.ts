import Io from '@/helpers/io';
import Logger from '@/helpers/logger';
import { getActivePath, sidebarProvider, telemetry } from '@/utils/global';
import { WebviewMsg } from '@w/msgs';
import { commands, l10n } from 'vscode';
import ProblemsManager from '../problems/manager';

const logger = new Logger('sidebar-message');

export const handleMessage = async (msg: WebviewMsg) => {
  logger.info('Received', msg.type, 'message');
  logger.debug('Received message data from webview', msg);
  try {
    const handleEnd = telemetry.start('sidebar.handleMessage', {
      type: msg.type,
    });
    if (msg.type === 'init') {
      sidebarProvider.event.emit('activePath', {
        activePath: getActivePath(),
      });
      await ProblemsManager.dataRefresh();
    } else if (msg.type === 'createProblem') {
      await ProblemsManager.createProblem(msg);
    } else if (msg.type === 'importProblem') {
      await ProblemsManager.importProblem(msg);
    } else if (msg.type === 'editProblemDetails') {
      await ProblemsManager.editProblemDetails(msg);
    } else if (msg.type === 'delProblem') {
      await ProblemsManager.delProblem(msg);
    } else if (msg.type === 'addTc') {
      await ProblemsManager.addTc(msg);
    } else if (msg.type === 'loadTcs') {
      await ProblemsManager.loadTcs(msg);
    } else if (msg.type === 'updateTc') {
      await ProblemsManager.updateTc(msg);
    } else if (msg.type === 'runTc') {
      await ProblemsManager.runTc(msg);
    } else if (msg.type === 'toggleDisable') {
      await ProblemsManager.toggleDisable(msg);
    } else if (msg.type === 'clearTcStatus') {
      await ProblemsManager.clearTcStatus(msg);
    } else if (msg.type === 'clearStatus') {
      await ProblemsManager.clearStatus(msg);
    } else if (msg.type === 'runTcs') {
      await ProblemsManager.runTcs(msg);
    } else if (msg.type === 'stopTcs') {
      await ProblemsManager.stopTcs(msg);
    } else if (msg.type === 'chooseTcFile') {
      await ProblemsManager.chooseTcFile(msg);
    } else if (msg.type === 'compareTc') {
      await ProblemsManager.compareTc(msg);
    } else if (msg.type === 'toggleTcFile') {
      await ProblemsManager.toggleTcFile(msg);
    } else if (msg.type === 'delTc') {
      await ProblemsManager.delTc(msg);
    } else if (msg.type === 'reorderTc') {
      await ProblemsManager.reorderTc(msg);
    } else if (msg.type === 'chooseSrcFile') {
      await ProblemsManager.chooseSrcFile(msg);
    } else if (msg.type === 'removeSrcFile') {
      await ProblemsManager.removeSrcFile(msg);
    } else if (msg.type === 'startBfCompare') {
      await ProblemsManager.startBfCompare(msg);
    } else if (msg.type === 'stopBfCompare') {
      await ProblemsManager.stopBfCompare(msg);
    } else if (msg.type === 'submitToCodeforces') {
      await ProblemsManager.submitToCodeforces(msg);
    } else if (msg.type === 'openFile') {
      await ProblemsManager.openFile(msg);
    } else if (msg.type === 'openTestlib') {
      await ProblemsManager.openTestlib(msg);
    } else if (msg.type === 'debugTc') {
      await ProblemsManager.debugTc(msg);
    } else if (msg.type === 'dragDrop') {
      await ProblemsManager.dragDrop(msg);
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
    telemetry.error('sidebar-handleMessage-error', {
      type: msg.type,
      error: (e as Error).message,
    });
  }
};
