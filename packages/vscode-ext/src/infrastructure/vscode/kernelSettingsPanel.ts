// biome-ignore-all lint/style/useNamingConvention: Configuration fields follow the Rust wire schema.
import { randomBytes } from 'node:crypto';
import { extname, join } from 'node:path';
import {
  commands,
  type ExtensionContext,
  Uri,
  ViewColumn,
  type WebviewPanel,
  window,
  workspace,
} from 'vscode';
import { completeLegacyToolchains } from '@/infrastructure/rpc/arguments';
import { type KernelConfiguration, missingValues } from '@/infrastructure/rpc/configuration';
import { splitArguments } from '@/infrastructure/rpc/kernelService';
import { rpcMethod } from '@/infrastructure/rpc/protocol';

/** Host only: validates messages and renders Rust-owned settings in a full editor tab. */
export class KernelSettingsPanel {
  private panel?: WebviewPanel;
  private source?: string;
  public constructor(
    private readonly context: ExtensionContext,
    private readonly configuration: KernelConfiguration,
  ) {
    context.subscriptions.push(
      commands.registerCommand('cph-ng.openKernelSettings', () => this.open()),
      commands.registerCommand('cph-ng.migrateKernelSettings', () => this.open()),
      { dispose: () => this.panel?.dispose() },
    );
  }
  private open(): void {
    const editor = window.activeTextEditor;
    if (this.panel) {
      this.panel.reveal(ViewColumn.One);
      return;
    }
    this.source = editor?.document.uri.scheme === 'file' ? editor.document.uri.fsPath : undefined;
    const panel = window.createWebviewPanel(
      'cphNgKernelSettings',
      'CPH-NG Kernel Settings',
      ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [],
      },
    );
    this.panel = panel;
    panel.onDidDispose(() => {
      this.panel = undefined;
    });
    panel.webview.onDidReceiveMessage(async (message: unknown) => {
      if (!message || typeof message !== 'object') return;
      const msg = message as { id?: unknown; method?: unknown; scope?: unknown; data?: unknown };
      if (
        typeof msg.id !== 'number' ||
        !Number.isSafeInteger(msg.id) ||
        typeof msg.method !== 'string'
      )
        return;
      try {
        const source = msg.scope === 'problem' ? this.source : undefined;
        if (msg.scope === 'problem' && !source)
          throw new Error('Open a source file before choosing the current problem.');
        const data =
          msg.data && typeof msg.data === 'object' ? (msg.data as Record<string, unknown>) : {};
        let result: unknown;
        switch (msg.method) {
          case 'get':
            result = { ...(await this.configuration.get(source)), source: this.source };
            break;
          case 'openFile': {
            let path = join(this.configuration.kernel.storeRoot, 'config.toml');
            if (source) {
              const client = await this.configuration.kernel.forSource(source);
              const problem = await client.request<{ id: string }>(rpcMethod.problemLoad, {
                source_path: source,
              });
              if (!/^[0-9a-f-]{36}$/i.test(problem.id))
                throw new Error('Invalid problem identity.');
              path = join(
                this.configuration.kernel.storeRoot,
                'problems',
                problem.id,
                'config.toml',
              );
            }
            await window.showTextDocument(await workspace.openTextDocument(Uri.file(path)));
            result = { opened: true };
            break;
          }
          case 'save': {
            if (
              typeof data.toml !== 'string' &&
              (!data.patch || typeof data.patch !== 'object' || Array.isArray(data.patch))
            )
              throw new Error('Invalid configuration update.');
            result = await this.configuration.set(
              {
                ...(typeof data.toml === 'string'
                  ? { toml: data.toml }
                  : { patch: data.patch as Record<string, unknown> }),
                ...(typeof data.expected_raw_toml === 'string'
                  ? { expected_raw_toml: data.expected_raw_toml }
                  : {}),
              },
              source,
            );
            break;
          }
          case 'detect':
            result = await this.configuration.detect();
            break;
          case 'check': {
            if (
              typeof data.language !== 'string' ||
              !['compiler', 'interpreter'].includes(String(data.kind)) ||
              typeof data.path !== 'string'
            )
              throw new Error('Choose a language, executable kind and path.');
            result = await this.configuration.check(
              data.language,
              data.kind as 'compiler' | 'interpreter',
              data.path,
            );
            break;
          }
          case 'previewMigration':
            result = await this.migration(source, false);
            break;
          case 'migrate':
            result = await this.migration(source, true);
            break;
          default:
            throw new Error('Unsupported settings action.');
        }
        await panel.webview.postMessage({ id: msg.id, result });
      } catch (error) {
        await panel.webview.postMessage({
          id: msg.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
    panel.webview.html = settingsHtml(panel.webview.cspSource);
  }
  private async migration(source: string | undefined, apply: boolean): Promise<unknown> {
    const client = source
      ? await this.configuration.kernel.forSource(source)
      : await this.configuration.kernel.forConfiguration();
    const problem = source
      ? await client.request<{ id: string }>(rpcMethod.problemLoad, { source_path: source })
      : undefined;
    const marker = `judge.settingsMigration.v1.${problem?.id ?? 'global'}`;
    if (this.context.globalState.get<boolean>(marker))
      throw new Error('Legacy settings have already been imported for this scope.');
    let imported = this.configuration.legacyPatch();
    if (problem) {
      imported = {};
      const legacy = this.configuration.kernel.preferences.legacyOverrides(problem.id);
      const language = (
        {
          '.c': 'c',
          '.cpp': 'cpp',
          '.cc': 'cpp',
          '.cxx': 'cpp',
          '.c++': 'cpp',
          '.rs': 'rust',
          '.py': 'python',
          '.java': 'java',
          '.js': 'javascript',
          '.mjs': 'javascript',
          '.cjs': 'javascript',
        } as Record<string, string>
      )[extname(source ?? '').toLowerCase()];
      if (legacy && language) {
        const value: Record<string, unknown> = {};
        for (const [key, field] of [
          ['compiler', 'compiler'],
          ['compiler_args', 'compilerArgs'],
          ['interpreter', 'interpreter'],
          ['interpreter_args', 'interpreterArgs'],
        ] as const) {
          if (typeof legacy[field] === 'string' && (key.endsWith('_args') || legacy[field] !== ''))
            value[key] = key.endsWith('_args')
              ? splitArguments(legacy[field] ?? '')
              : legacy[field];
        }
        if (Object.keys(value).length) imported.languages = { [language]: value };
      }
    }
    const snapshot = await this.configuration.get(source);
    const patch = completeLegacyToolchains(
      missingValues(snapshot.local_config, imported),
      snapshot.config.languages,
    );
    if (!apply) return { patch, path: snapshot.path };
    const saved = await this.configuration.set(
      { patch, expected_raw_toml: snapshot.raw_toml },
      source,
    );
    if (problem) await this.configuration.kernel.preferences.finishMigration(problem.id);
    await this.context.globalState.update(marker, true);
    return saved;
  }
}

function settingsHtml(cspSource: string): string {
  const nonce = randomBytes(18).toString('base64');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; img-src ${cspSource};">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style nonce="${nonce}">
body{font:14px var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-editor-background);margin:0;padding:32px;line-height:1.5}main{max-width:1080px;margin:auto}h1{font-size:26px;font-weight:600;margin:0 0 8px}h2{font-size:18px;margin:0 0 12px}p{margin:8px 0 16px}.muted{color:var(--vscode-descriptionForeground)}.toolbar,.row{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.toolbar{margin:24px 0}.card{border:1px solid var(--vscode-panel-border);border-radius:6px;padding:20px;margin:18px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:16px}label{display:flex;flex-direction:column;gap:6px}input,select,textarea,button{font:inherit;border:1px solid var(--vscode-input-border,var(--vscode-panel-border));border-radius:3px;padding:7px 10px}input,textarea,select{color:var(--vscode-input-foreground);background:var(--vscode-input-background);min-width:0}button{cursor:pointer;background:var(--vscode-button-background);color:var(--vscode-button-foreground)}button.secondary{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground)}button:disabled{opacity:.5;cursor:wait}textarea{resize:vertical;min-height:65px}#toml{box-sizing:border-box;width:100%;min-height:350px;font-family:var(--vscode-editor-font-family),monospace;font-size:13px;tab-size:2}.error{color:var(--vscode-errorForeground)}#message{white-space:pre-wrap;min-height:24px}#path{overflow-wrap:anywhere}pre{white-space:pre-wrap;overflow-wrap:anywhere}small{color:var(--vscode-descriptionForeground)}summary{cursor:pointer;font-weight:600}.result{border-top:1px solid var(--vscode-panel-border);padding:10px 0;display:flex;justify-content:space-between;gap:16px;align-items:center}.result span{overflow-wrap:anywhere}#save{position:sticky;bottom:20px;box-shadow:0 2px 12px #0004}a{color:var(--vscode-textLink-foreground)}
</style></head><body><main><h1>Kernel settings</h1><p class="muted">Compiler, execution and judging settings are shared with the CLI. Rust validates and stores every change.</p>
<div class="toolbar"><label>Scope<select id="scope"><option value="global">Global</option><option value="problem">Current problem</option></select></label><button id="refresh" class="secondary">Reload</button><button id="discard" class="secondary">Discard draft</button><button id="open-file" class="secondary">Open config file</button></div>
<p id="path" class="muted"></p><p id="limits-note" class="muted"></p><div id="message" role="status" aria-live="polite"></div><div id="fields"></div><button id="save">Save form changes</button>
<section class="card"><h2>Toolchains</h2><p class="muted">Detect tools on the machine running the kernel. Selecting a tool fills the form; save to apply it.</p><button id="detect" class="secondary">Detect installed toolchains</button><div id="tools"></div><details><summary>Check an executable</summary><div class="toolbar"><select id="check-language" aria-label="Language"><option>cpp</option><option>c</option><option>rust</option><option>python</option><option>java</option><option>javascript</option></select><select id="check-kind" aria-label="Executable kind"><option>compiler</option><option>interpreter</option></select><input id="check-path" aria-label="Executable path" placeholder="Executable path"><button id="check">Check</button></div></details></section>
<section class="card"><details><summary>Advanced: edit TOML for this scope</summary><p class="muted">Only values saved in this scope appear here. Removing a value restores inheritance. Saving the form reloads this text.</p><textarea id="toml" aria-label="Configuration TOML" spellcheck="false"></textarea><div class="toolbar"><button id="save-toml">Save TOML</button></div><details><summary>Effective configuration</summary><pre id="effective"></pre></details></details></section>
<section class="card"><h2>Import previous VS Code settings</h2><p class="muted">Preview an import from explicit legacy settings (global scope) or saved compiler overrides (current problem). Existing Rust settings are preserved. Each scope can be imported once.</p><button id="preview" class="secondary">Preview import</button><pre id="migration"></pre><button id="migrate" hidden>Apply import</button></section>
</main><script nonce="${nonce}">
const vscode = acquireVsCodeApi(),
  pending = new Map(),
  inputs = new Map();
let sequence = 0,
  snapshot,
  dirty = false,
  rawDirty = false,
  patch = {},
  busy = 0;
const $ = (id) => document.getElementById(id),
  scope = () => $('scope').value;
function status(text, error = false) {
  $('message').textContent = text;
  $('message').className = error ? 'error' : '';
}
function request(method, data = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('Kernel request timed out. Reload to try again.'));
    }, 60000);
    pending.set(id, { resolve, reject, timer });
    vscode.postMessage({ id, method, scope: scope(), data });
  });
}
window.addEventListener('message', ({ data }) => {
  const p = pending.get(data.id);
  if (!p) return;
  pending.delete(data.id);
  clearTimeout(p.timer);
  data.error ? p.reject(new Error(data.error)) : p.resolve(data.result);
});
async function action(fn) {
  busy++;
  document.querySelectorAll('button,input,select,textarea').forEach((b) => (b.disabled = true));
  try {
    await fn();
  } catch (e) {
    status(e.message, true);
  } finally {
    if (--busy === 0) document.querySelectorAll('button,input,select,textarea').forEach((b) => (b.disabled = false));
  }
}
function get(obj, path) {
  return path.reduce((o, k) => o?.[k], obj);
}
function put(obj, path, value) {
  let o = obj;
  path.slice(0, -1).forEach((k) => (o = o[k] ??= {}));
  o[path.at(-1)] = value;
}
function title(path) {
  return path.join(' · ').replaceAll('_', ' ');
}
function field(path, value) {
  const key = path.join('.'),
    numeric = typeof value === 'number' || key === 'judge.legacy_comparison.output_ratio_limit',
    local = get(snapshot.local_config, path),
    label = document.createElement('label'),
    name = document.createElement('span');
  name.textContent = title(path.slice(1).length ? path.slice(1) : path);
  label.append(name);
  let input;
  if (typeof value === 'boolean') {
    input = document.createElement('select');
    [
      ['', local === undefined ? 'Inherit (' + value + ')' : 'Inherit'],
      ['true', 'Enabled'],
      ['false', 'Disabled'],
    ].forEach(([v, t]) => {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = t;
      input.append(o);
    });
    input.value = local === undefined ? '' : String(local);
  } else {
    input = document.createElement(Array.isArray(value) ? 'textarea' : 'input');
    if (numeric) {
      input.type = 'number';
      input.min = '0';
      input.step = 'any';
    }
    input.value =
      local === undefined ? '' : Array.isArray(local) ? JSON.stringify(local) : String(local);
    input.placeholder =
      (local === undefined ? 'Inherited: ' : 'Current effective: ') + (Array.isArray(value) ? JSON.stringify(value) : String(value ?? ''));
  }
  input.setAttribute('aria-label', title(path));
  input.addEventListener('input', () => {
    dirty = true;
    try {
      let v =
        input.value === ''
          ? null
          : numeric
            ? Number(input.value)
            : typeof value === 'boolean'
              ? input.value === 'true'
              : Array.isArray(value)
                ? JSON.parse(input.value)
                : input.value;
      if (
        Array.isArray(value) &&
        v !== null &&
        (!Array.isArray(v) || v.some((x) => typeof x !== 'string'))
      )
        throw new Error('Arguments must be a JSON array of strings.');
      put(patch, path, v);
      input.setCustomValidity('');
      status('Unsaved form changes.');
    } catch (e) {
      input.setCustomValidity(e.message);
      status(e.message, true);
    }
  });
  inputs.set(key, input);
  label.append(input);
  const hint = document.createElement('small');
  hint.textContent =
    local === undefined
      ? 'Inherited · leave blank to keep inheritance'
      : 'Set in this scope · clear to inherit';
  label.append(hint);
  return label;
}
function render(value) {
  snapshot = value;
  patch = {};
  dirty = false;
  rawDirty = false;
  inputs.clear();
  $('fields').replaceChildren();
  $('path').textContent =
    value.path +
    ' — Sources: ' +
    value.sources.join(' → ') +
    (value.source ? ' — Source: ' + value.source : '');
  $('toml').value = value.raw_toml;
  $('effective').textContent = value.toml;
  $('limits-note').textContent = scope() === 'problem'
    ? 'Edit the time and memory limits of an existing problem in its problem details. The [problem] TOML section defines defaults for newly created problems only.'
    : 'Problem time and memory defaults apply when creating new problems.';
  const combined = { ...value.local_config, ...value.config };
  for (const [section, setting] of Object.entries(combined)) {
    if (scope() === 'problem' && section === 'problem') continue;
    const card = document.createElement('section');
    card.className = 'card';
    const heading = document.createElement('h2');
    heading.textContent = section.replaceAll('_', ' ');
    card.append(heading);
    const grid = document.createElement('div');
    grid.className = 'grid';
    function walk(v, path) {
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        const values = {
          ...(get(value.local_config, path) || {}),
          ...(get(value.config, path) || {}),
          ...v,
        };
        Object.entries(values).forEach(([k, x]) => walk(x, [...path, k]));
      } else grid.append(field(path, v));
    }
    walk(setting, [section]);
    card.append(grid);
    $('fields').append(card);
  }
}
function ensureClean() {
  if (dirty || rawDirty) throw new Error('Save your changes before changing scope or reloading.');
}
async function reload() {
  render(await request('get'));
  status('Settings loaded.');
  $('migration').textContent = '';
  $('migrate').hidden = true;
}
$('discard').onclick = () =>
  action(async () => {
    dirty = false;
    rawDirty = false;
    await reload();
  });
$('open-file').onclick = () => action(async () => { await request('openFile'); });
$('refresh').onclick = () =>
  action(async () => {
    ensureClean();
    await reload();
  });
let lastScope = 'global';
$('scope').onchange = () =>
  action(async () => {
    try {
      ensureClean();
    } catch (e) {
      $('scope').value = lastScope;
      throw e;
    }
    lastScope = scope();
    snapshot = undefined;
    inputs.clear();
    $('fields').replaceChildren();
    $('toml').value = '';
    $('effective').textContent = '';
    $('path').textContent = '';
    await reload();
  });
$('save').onclick = () =>
  action(async () => {
    if (!snapshot) throw new Error('Load valid settings first, or use Open config file to repair the TOML.');
    if (rawDirty) throw new Error('Save the TOML draft first.');
    for (const input of inputs.values()) if (!input.reportValidity()) return;
    render(await request('save', { patch, expected_raw_toml: snapshot.raw_toml }));
    status('Settings saved. New runs use these values.');
  });
$('toml').oninput = () => {
  rawDirty = true;
  status('Unsaved TOML changes.');
};
$('save-toml').onclick = () =>
  action(async () => {
    if (!snapshot) throw new Error('Load valid settings first, or use Open config file to repair the TOML.');
    if (dirty) throw new Error('Save the form draft first.');
    render(await request('save', { toml: $('toml').value, expected_raw_toml: snapshot.raw_toml }));
    status('TOML saved.');
  });
function showTools(items) {
  $('tools').replaceChildren();
  if (!items.length) {
    $('tools').textContent = 'No matching toolchains found. Check the executable path below.';
    return;
  }
  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'result';
    const text = document.createElement('span');
    text.textContent =
      item.language + ' ' + item.kind + ' · ' + item.name + ' ' + item.version + ' — ' + item.path;
    const use = document.createElement('button');
    use.className = 'secondary';
    use.textContent = 'Use';
    use.onclick = () => {
      const path = ['languages', item.language, item.kind];
      let input = inputs.get(path.join('.'));
      if (!input) {
        const card = document.createElement('section');
        card.className = 'card';
        card.append(field(path, item.path));
        $('fields').append(card);
        input = inputs.get(path.join('.'));
      }
      input.value = item.path;
      input.dispatchEvent(new Event('input'));
      input.focus();
      status('Toolchain selected. Save the form to apply.');
    };
    row.append(text, use);
    $('tools').append(row);
  }
}
$('detect').onclick = () =>
  action(async () => {
    status('Detecting toolchains…');
    showTools(await request('detect'));
    status('Detection finished.');
  });
$('check').onclick = () =>
  action(async () => {
    const result = await request('check', {
      language: $('check-language').value,
      kind: $('check-kind').value,
      path: $('check-path').value,
    });
    showTools(result ? [result] : []);
    status(result ? 'Executable recognized.' : 'Executable was not recognized.');
  });
$('preview').onclick = () =>
  action(async () => {
    ensureClean();
    const result = await request('previewMigration');
    $('migration').textContent = JSON.stringify(result.patch, null, 2);
    $('migrate').hidden = Object.keys(result.patch).length === 0;
    status(
      $('migrate').hidden
        ? 'No settings need importing.'
        : 'Review the import, then choose Apply import.',
    );
  });
$('migrate').onclick = () =>
  action(async () => {
    ensureClean();
    render(await request('migrate'));
    $('migrate').hidden = true;
    status('Legacy settings imported.');
  });
action(reload);
</script></body></html>`;
}
