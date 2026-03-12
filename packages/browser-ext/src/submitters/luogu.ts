// Copyright (C) 2026 zzsqjdhqgb
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

import type { CphSubmitData } from '@cph-ng/core';
import { BaseSubmitter } from './base';
import { submitterDomains } from './domains';

/**
 * 在页面上下文中执行的代码填充函数
 * 注意：此函数会被序列化注入到页面，不能引用外部变量
 */
function fillCodeMirror6(code: string): void {
  const cmContent = document.querySelector('.cm-content') as HTMLElement & { cmView?: unknown };
  if (!cmContent?.cmView) {
    console.error('[cph-ng] 找不到 CodeMirror cmView');
    return;
  }

  const cmView = cmContent.cmView as Record<string, unknown>;

  // 尝试多种路径找到 EditorView
  type EditorView = { dispatch: (spec: unknown) => void; state: { doc: { length: number } } };
  let view: EditorView | null = null;

  if (cmView.view && typeof (cmView.view as EditorView).dispatch === 'function') {
    view = cmView.view as EditorView;
  } else if (cmView.editorView && typeof (cmView.editorView as EditorView).dispatch === 'function') {
    view = cmView.editorView as EditorView;
  } else {
    // 遍历 cmView 的属性找 dispatch 方法
    for (const key of Object.getOwnPropertyNames(cmView)) {
      const val = cmView[key] as EditorView | undefined;
      if (val && typeof val.dispatch === 'function' && val.state) {
        view = val;
        break;
      }
    }
  }

  if (!view) {
    console.error('[cph-ng] 无法找到 EditorView');
    return;
  }

  view.dispatch({
    changes: {
      from: 0,
      to: view.state.doc.length,
      insert: code,
    },
  });
  console.log('[cph-ng] 代码填充成功');
}

export class LuoguSubmitter extends BaseSubmitter {
  public readonly supportedDomains = submitterDomains.LUOGU;

  public getSubmitUrl(data: CphSubmitData): string {
    return data.url;
  }

  public async fill(data: CphSubmitData): Promise<void> {
    // 点击显示提交框的按钮
    const showSubmit = await this.waitForElement<HTMLButtonElement>(
      '#app > div.main-container > header > div > div > div > div:nth-child(1) > button.solid.lform-size-middle',
    );
    showSubmit.click();

    // 等待 CodeMirror 6 编辑器加载
    await this.waitForElement<HTMLElement>('.cm-content');

    // 注入代码到编辑器
    this.injectCodeToEditor(data.sourceCode);

    // 点击提交按钮
    const submitBtn = await this.waitForElement<HTMLButtonElement>(
      '#app > div.main-container > main > div > div > div.main > div > div.body > button',
    );
    submitBtn.click();
  }

  /**
   * 注入代码到 CodeMirror 6 编辑器
   * 利用函数的 toString() 特性注入到页面上下文
   */
  private injectCodeToEditor(code: string): void {
    const script = document.createElement('script');
    script.textContent = `(${fillCodeMirror6.toString()})(${JSON.stringify(code)})`;
    document.documentElement.appendChild(script);
    script.remove();
  }
}
