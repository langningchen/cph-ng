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

import { UpdateTcMsg, WebviewMsg } from './msgs';

export const basename = (path: string) => {
    if (path.includes('/')) {
        return path.split('/').pop();
    }
    return path.split('\\').pop();
};

export const delProps = (obj: Object, props: string[]) => {
    return Object.fromEntries(
        Object.entries(obj).filter(([key]) => !props.includes(key)),
    );
};

export const getCompile = (e: React.MouseEvent) => {
    if (e.ctrlKey) {
        return true;
    }
    if (e.altKey) {
        return false;
    }
    return null;
};

// Message queue system to handle race conditions between updateTc and runTcs
// This uses a proper async queue instead of relying on delays

interface QueuedMessage {
    msg: WebviewMsg;
    resolve: () => void;
}

class MessageQueue {
    private queue: QueuedMessage[] = [];
    private processing = false;
    private pendingUpdateTc: Map<number, UpdateTcMsg> = new Map();

    async enqueue(msg: WebviewMsg): Promise<void> {
        return new Promise((resolve) => {
            this.queue.push({ msg, resolve });
            this.processQueue();
        });
    }

    private async processQueue() {
        if (this.processing) {
            return;
        }

        this.processing = true;

        while (this.queue.length > 0) {
            const item = this.queue.shift()!;
            await this.processMessage(item.msg);
            item.resolve();
        }

        this.processing = false;
    }

    private async processMessage(msg: WebviewMsg) {
        // For updateTc messages, store them to debounce multiple updates
        if (msg.type === 'updateTc') {
            this.pendingUpdateTc.set(msg.idx, msg);
            return;
        }

        // For run commands, flush all pending updateTc messages first
        if (msg.type === 'runTcs' || msg.type === 'runTc') {
            // Force blur on active element to capture any pending changes
            const activeElement = document.activeElement;
            if (
                activeElement &&
                (activeElement.tagName === 'TEXTAREA' ||
                    activeElement.tagName === 'INPUT')
            ) {
                (activeElement as HTMLElement).blur();
            }

            // Wait for any blur events to be processed
            await new Promise((resolve) => setTimeout(resolve, 0));

            // Flush all pending updateTc messages
            for (const updateMsg of this.pendingUpdateTc.values()) {
                vscode.postMessage({
                    ...updateMsg,
                    activePath: window.activePath,
                });
            }
            this.pendingUpdateTc.clear();
        }

        // Send the message
        vscode.postMessage({ ...msg, activePath: window.activePath });
    }

    // Periodically flush pending updateTc messages
    startPeriodicFlush() {
        setInterval(() => {
            if (this.pendingUpdateTc.size > 0 && !this.processing) {
                for (const updateMsg of this.pendingUpdateTc.values()) {
                    vscode.postMessage({
                        ...updateMsg,
                        activePath: window.activePath,
                    });
                }
                this.pendingUpdateTc.clear();
            }
        }, 300);
    }
}

const messageQueue = new MessageQueue();
messageQueue.startPeriodicFlush();

export const msg = (msg: WebviewMsg) => {
    messageQueue.enqueue(msg);
};
