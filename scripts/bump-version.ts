import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

// Constants
const changelogPath = 'CHANGELOG.md';
const packagesDir = 'packages';
const releaseConfigPath = '.cph-ng-release.json';
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
const isPreRelease = args.includes('--pre-release') || args.includes('-p');
const isForce = args.includes('--force') || args.includes('-f');

if (!bumpType) {
  console.error('Usage: pnpm bump <patch|minor|major> [--pre-release|-p] [--force|-f]');
  console.error('  --pre-release, -p: Mark as pre-release version');
  console.error('  --force, -f: Skip working tree check');
  process.exit(1);
}

const releaseType = isPreRelease ? 'Pre-release' : 'Release';

// Ensure work tree clean
if (!isForce) {
  const status = execSync('git status --porcelain', { encoding: 'utf-8' }).trim();
  if (status.length > 0)
    die('Working tree is not clean. Please commit or stash your changes first.');
}

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

// Read release config
interface ReleaseConfig {
  version: string;
  preRelease: boolean;
  previousVersion: string;
}

const releaseConfig = JSON.parse(readFileSync(releaseConfigPath, 'utf-8')) as ReleaseConfig;

// Read version numbers from all sources (packages + release config)
const packages = packageJsonPaths.map((p) => {
  const pkg = JSON.parse(readFileSync(p, 'utf-8'));
  return { path: p, version: pkg.version || '0.0.0' };
});

// Check version consistency
const versionSources = [
  ...packages.map((p) => ({ path: p.path, version: p.version })),
  { path: releaseConfigPath, version: releaseConfig.version },
];
const versions = [...new Set(versionSources.map((s) => s.version))];
if (versions.length > 1) {
  console.log('\n⚠️  Version mismatch detected:\n');
  versionSources.forEach((s) => {
    console.log(`  ${s.version.padEnd(10)} ${s.path}`);
  });
  die('All files must have the same version.');
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
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
}

// Update release config
const newReleaseConfig: ReleaseConfig = {
  version: newVersion,
  preRelease: isPreRelease,
  previousVersion: releaseConfig.preRelease ? releaseConfig.previousVersion : newVersion,
};
writeFileSync(releaseConfigPath, `${JSON.stringify(newReleaseConfig, null, 2)}\n`);

// Generate CHANGELOG
const commits = execSync(`git log v${releaseConfig.previousVersion}..HEAD --format=%s`, {
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

  if (isPreRelease || releaseConfig.previousVersion === releaseConfig.version) {
    const newContent = `## ${newVersion}\n\n${commits.join('\n')}`;
    updatedChangelog = `${changelogHeader}${newContent}\n\n${oldVersions}`;
  } else {
    const preReleaseBegin = releaseConfig.previousVersion;
    const preReleaseEnd = currentVersion;
    const lastReleaseVersion = releaseConfig.previousVersion;
    if (!lastReleaseVersion) die('No previous release tag found, cannot link to last release');

    const newContent = `## ${newVersion}\n\nAggregated from prereleases ${preReleaseBegin}~${preReleaseEnd}.\n\n${commits.join('\n')}\n\n<details>\n<summary>Pre-release history (${preReleaseEnd}~${preReleaseEnd})</summary>`;
    const lastVersion = oldVersions.indexOf(`## ${lastReleaseVersion}`);
    if (lastVersion === -1) die('Last release version not found in CHANGELOG.md');
    const modifiedOldVersions = `${oldVersions.slice(0, lastVersion)}</details>\n\n${oldVersions.slice(lastVersion)}`;
    updatedChangelog = `${changelogHeader}${newContent}\n\n${modifiedOldVersions}`;
  }

  writeFileSync(changelogPath, `${updatedChangelog.trimEnd()}\n`);
}

const commitAndExit = (version: string) => {
  console.log(`\n🚀 Committing changes...`);
  execSync(`git checkout -b chore/version-dump-${version}`);
  execSync('git add -A', { stdio: 'inherit' });
  execSync(`git commit -m "chore: dump version to ${version}"`, { stdio: 'inherit' });
  console.log(`\n✅ Successfully committed version ${version}.`);
};

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

if (isPreRelease) {
  commitAndExit(newVersion);
  rl.close();
} else {
  console.log(`\n📝 Please review and manually update CHANGELOG.md if needed.`);
  rl.question('\nPress ENTER to commit the changes...', () => {
    commitAndExit(newVersion);
    rl.close();
  });
}
