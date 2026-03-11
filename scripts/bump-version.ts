import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Constants
const changelogPath = 'CHANGELOG.md';
const packagesDir = 'packages';
const commitLogPattern = /^([a-z]+)(\([a-zA-Z-]+\))?:\s*(.+)$/;
const changelogHeader =
  '# Change Log\n\nAll notable changes to the "cph-ng" extension will be documented in this file.\n\n';
const die = (message: string): never => {
  console.error(`❌ ${message}`);
  process.exit(1);
};

// Parse arguments
const args = process.argv.slice(2);
const bumpType = args.find((arg) => ['patch', 'minor', 'major'].includes(arg)) as
  | 'patch'
  | 'minor'
  | 'major'
  | undefined;

if (!bumpType) {
  console.error('Usage: pnpm bump <patch|minor|major>');
  process.exit(1);
}

const isPreRelease = bumpType === 'patch';
const releaseType = isPreRelease ? 'Pre-release' : 'Release';

// Find configuration files
const findPackageJsons = (): string[] => {
  const results: string[] = [];
  for (const name of readdirSync(packagesDir)) {
    const pkgPath = join(packagesDir, name, 'package.json');
    if (existsSync(pkgPath)) results.push(pkgPath);
  }
  return results;
};

const packageJsonPaths = findPackageJsons();
if (packageJsonPaths.length === 0) die('No package.json files found');

console.log(`📦 Found ${packageJsonPaths.length} packages:`);
packageJsonPaths.forEach((p) => {
  console.log(`  - ${p}`);
});

// Read version numbers
const packages = packageJsonPaths.map((p) => {
  const pkg = JSON.parse(readFileSync(p, 'utf-8'));
  return { path: p, version: pkg.version || '0.0.0' };
});

// Check version consistency
const versions = [...new Set(packages.map((p) => p.version))];

if (versions.length > 1) {
  console.log('\n⚠️  Version mismatch detected:\n');
  packages.forEach((p) => {
    console.log(`  ${p.version.padEnd(10)} ${p.path}`);
  });
  die('All packages must have the same version.');
}

// Get current latest version
const compareVersions = (a: string, b: string): number => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
};

const currentVersion = versions.sort(compareVersions).pop();
if (!currentVersion) die('Unable to determine current version');
const [major, minor, patch] = currentVersion.split('.').map(Number);

// Compute new version
let newVersion: string = '0.0.0';
if (bumpType === 'major') newVersion = `${major + 1}.0.0`;
else if (bumpType === 'minor') newVersion = `${major}.${minor + 1}.0`;
else if (bumpType === 'patch') newVersion = `${major}.${minor}.${patch + 1}`;
console.log(`\n🔖 ${releaseType}: ${currentVersion} -> ${newVersion}`);

// Dump version numbers
for (const pkgPath of packageJsonPaths) {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  pkg.version = newVersion;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
}

// Generate CHANGELOG
const getLastReleaseTag = (): string => {
  const tags = execSync('git tag --list "v*" --sort=-v:refname', {
    encoding: 'utf-8',
  })
    .trim()
    .split('\n')
    .filter(Boolean);
  for (const tag of tags) {
    const match = tag.match(/^v(\d+)\.(\d+)\.(\d+)$/);
    if (match && match[3] === '0') return tag;
  }
  return tags[0] || '';
};

const getLastTag = (): string => {
  return execSync('git describe --tags --abbrev=0 2>/dev/null', {
    encoding: 'utf-8',
  }).trim();
};

const lastTag = isPreRelease ? getLastTag() : getLastReleaseTag();
const commitRange = lastTag ? `${lastTag}..HEAD` : 'HEAD';
const commits = execSync(`git log ${commitRange} --format=%s`, {
  encoding: 'utf-8',
})
  .trim()
  .split('\n')
  .filter((line) => !line.startsWith('chore: dump version to '))
  .map((line) => {
    const match = line.match(commitLogPattern);
    if (!match) return null;
    const [, type, scope, subject] = match;
    const linked = subject.replace(
      /#(\d+)/g,
      '[#$1](https://github.com/langningchen/cph-ng/issues/$1)',
    );
    return scope ? `- **${type}**${scope}: ${linked}` : `- **${type}**: ${linked}`;
  })
  .filter(Boolean);

if (commits.length === 0) {
  console.log('  ⚠️  No commits found since last release');
  console.log('  ℹ️  Please update CHANGELOG.md manually');
} else {
  const existingChangelog = readFileSync(changelogPath, 'utf-8');
  if (!existingChangelog.startsWith(changelogHeader)) die('CHANGELOG.md header mismatch');
  const oldVersions = existingChangelog.slice(changelogHeader.length);

  let updatedChangelog: string;

  if (isPreRelease) {
    const newContent = `## ${newVersion}\n\n${commits.join('\n')}`;
    updatedChangelog = `${changelogHeader}${newContent}\n\n${oldVersions}`;
  } else {
    const firstPreRelease = `${major}.${minor}.1`;
    const lastPreRelease = currentVersion;
    const lastReleaseVersion = lastTag.replace('v', '');
    if (!lastReleaseVersion) die('No previous release tag found, cannot link to last release');

    const newContent = `## ${newVersion}\n\nAggregated from prereleases ${firstPreRelease}~${lastPreRelease}.\n\n${commits.join('\n')}\n\n<details>\n<summary>Pre-release history (${firstPreRelease}~${lastPreRelease})</summary>`;
    const releasePattern = new RegExp(`(## ${lastReleaseVersion.replace(/\./g, '\\.')})`);
    const modifiedOldVersions = oldVersions.replace(releasePattern, `</details>\n\n$1`);
    updatedChangelog = `${changelogHeader}${newContent}\n\n${modifiedOldVersions}`;
  }

  writeFileSync(changelogPath, updatedChangelog.trimEnd());
}

console.log(`\n✅ Done! ${releaseType}: ${newVersion}`);
console.log(`\n📝 Next steps:`);
console.log(`  1. Review and edit CHANGELOG.md`);
console.log(`  2. git add -A`);
console.log(`  3. git commit -m "chore: dump version to ${newVersion}"`);
console.log(`  4. git push`);
