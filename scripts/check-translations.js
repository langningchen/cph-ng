import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { extname, join } from 'path';

// Translation checker configurations
const CONFIGS = [
  {
    title: 'Extension Configuration',
    requiredKeysExtractor: () => {
      const requiredKeys = new Set();

      function extract(obj) {
        if (typeof obj === 'string') {
          if (obj.startsWith('%') && obj.endsWith('%')) {
            const translationKey = obj.slice(1, -1);
            requiredKeys.add(translationKey);
          }
        } else if (Array.isArray(obj)) {
          obj.forEach((item) => extract(item));
        } else if (typeof obj === 'object' && obj !== null) {
          for (const value of Object.values(obj)) {
            extract(value);
          }
        }
      }

      extract(loadJsonFile('package.json'));
      return requiredKeys;
    },
    files: ['package.nls.json', 'package.nls.zh.json'],
  },
  {
    title: 'Extension Runtime',
    requiredKeysExtractor: () =>
      extractTranslationCalls([
        {
          dir: 'src',
          exts: ['ts', 'js'],
          regex: /l10n\.t\s*\(\s*(['"])([\s\S]*?)\1/g,
        },
      ]),
    files: ['l10n/bundle.l10n.zh-cn.json'],
  },
  {
    title: 'Webview',
    requiredKeysExtractor: () =>
      extractTranslationCalls([
        {
          dir: join('src', 'webview', 'src'),
          exts: ['tsx', 'ts'],
          regex: /\bt\s*\(\s*(['"])([\s\S]*?)\1/g,
        },
      ]),
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

function findFilesRecursively(dir, extensions = []) {
  const files = [];

  function walkDir(currentDir) {
    try {
      const items = readdirSync(currentDir);

      for (const item of items) {
        const fullPath = join(currentDir, item);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          // Skip node_modules and other common directories
          if (!['node_modules', '.git', 'dist', 'out'].includes(item)) {
            walkDir(fullPath);
          }
        } else if (stat.isFile()) {
          const ext = extname(fullPath).slice(1);
          if (extensions.length === 0 || extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      // Ignore directories we can't read
    }
  }

  if (existsSync(dir)) {
    walkDir(dir);
  }

  return files;
}

function extractTranslationCalls(patterns) {
  const keys = new Set();
  for (const { dir, exts, regex } of patterns) {
    const files = findFilesRecursively(dir, exts);
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      const matches = content.match(regex);
      if (matches) {
        matches.forEach((match) => {
          const keyMatch = match.match(/(['"])([\s\S]*?)\1/);
          if (keyMatch) {
            keys.add(keyMatch[2]);
          }
        });
      }
    }
  }
  return keys;
}

function checkTranslations(config) {
  let hasErrors = false;
  const requiredKeys = config.requiredKeysExtractor();
  for (const file of config.files) {
    const data = loadJsonFile(file);
    const keys = new Set(Object.keys(data));

    const missingKeys = [...requiredKeys].filter((key) => !keys.has(key));
    if (missingKeys.length > 0) {
      hasErrors = true;
      console.log(`Missing keys in ${file}:`);
      missingKeys.forEach((key) => console.log(`    ${key}`));
    }

    const extraKeys = [...keys].filter((key) => !requiredKeys.has(key));
    if (extraKeys.length > 0) {
      hasErrors = true;
      console.log(`Extra keys in ${file}: `);
      extraKeys.forEach((key) => console.log(`    ${key}`));
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
