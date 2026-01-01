// Copyright (C) 2026 Langning Chen
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

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import ignore from 'ignore';
import {
  createSourceFile,
  forEachChild,
  isCallExpression,
  isIdentifier,
  isNoSubstitutionTemplateLiteral,
  isPropertyAccessExpression,
  isStringLiteral,
  ScriptTarget,
} from 'typescript';

const CONFIGS = [
  {
    title: 'Extension Configuration',
    getKeys: () => {
      const keys = new Set();
      const visit = (obj) => {
        if (typeof obj === 'string') {
          if (obj.startsWith('%') && obj.endsWith('%')) {
            keys.add(obj.slice(1, -1));
          }
        } else if (Array.isArray(obj)) {
          obj.forEach((item) => {
            visit(item);
          });
        } else if (typeof obj === 'object' && obj !== null) {
          for (const value of Object.values(obj)) {
            visit(value);
          }
        }
      };
      visit(loadJsonFile('package.json'));
      return keys;
    },
    files: ['package.nls.json', 'package.nls.zh.json'],
  },
  {
    title: 'Extension Runtime',
    getKeys: () => extractKeys('src', ['ts', 'js', 'tsx', 'jsx'], ['webview']),
    files: ['l10n/bundle.l10n.zh-cn.json'],
  },
  {
    title: 'Webview',
    getKeys: () => extractKeys(join('src', 'webview', 'src'), ['tsx', 'ts']),
    files: ['src/webview/src/l10n/en.json', 'src/webview/src/l10n/zh.json'],
  },
];

function loadJsonFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load ${filePath}: ${error.message}`);
  }
}

function findFilesRecursively(dir, exts, excludes) {
  const files = [];
  const ig = ignore();
  ig.add(excludes);
  ig.add(readFileSync('.gitignore', 'utf8'));
  const visit = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (ig.ignores(path)) continue;
      const stat = statSync(path);
      if (stat.isDirectory()) visit(path);
      if (stat.isFile()) exts.includes(extname(path).slice(1)) && files.push(path);
    }
  };
  existsSync(dir) && visit(dir);
  return files;
}

function extractKeys(dir, exts, excludes = []) {
  const keys = new Set();
  const files = findFilesRecursively(dir, exts, excludes);
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    const src = createSourceFile(file, content, ScriptTarget.Latest, true);
    const visit = (node) => {
      if (isCallExpression(node) && isTranslationCall(node.expression)) {
        const args = node.arguments;
        if (args.length > 0) {
          const firstArg = args[0];
          if (isStringLiteral(firstArg) || isNoSubstitutionTemplateLiteral(firstArg))
            keys.add(firstArg.text);
        }
      }
      forEachChild(node, visit);
    };
    visit(src);
  }
  return keys;
}

function isTranslationCall(expression) {
  if (isPropertyAccessExpression(expression)) return expression.name.text === 't';
  if (isIdentifier(expression)) return expression.text === 't';
  return false;
}

function checkTranslations(config) {
  let hasErrors = false;
  const requiredKeys = config.getKeys();
  for (const file of config.files) {
    const data = loadJsonFile(file);
    const keys = new Set(Object.keys(data));

    const missingKeys = [...requiredKeys].filter((key) => !keys.has(key));
    if (missingKeys.length > 0) {
      hasErrors = true;
      console.log(`Missing keys in ${file}:`);
      missingKeys.forEach((key) => {
        console.log(`    ${key}`);
      });
    }

    const extraKeys = [...keys].filter((key) => !requiredKeys.has(key));
    if (extraKeys.length > 0) {
      hasErrors = true;
      console.log(`Extra keys in ${file}: `);
      extraKeys.forEach((key) => {
        console.log(`    ${key}`);
      });
    }
  }
  return hasErrors;
}

let hasError = false;
for (const config of CONFIGS) {
  hasError = hasError || checkTranslations(config);
}
if (hasError) {
  process.exit(1);
}

process.exit(0);
