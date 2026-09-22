import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';

export const ARTIFACT_FILES = ['main.js', 'manifest.json'];

const invocationPath = process.argv[1] ?? '';
const isMain = invocationPath.endsWith('release-check.mjs');
export const repositoryRoot = isMain ? resolve(dirname(invocationPath), '..') : resolve(process.cwd());

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Could not read JSON from ${path}: ${error.message}`);
  }
};

const requiredString = (value, field, path) => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${path} must contain a non empty string for ${field}`);
  }
  return value;
};

export function validateMetadata(root) {
  const packagePath = resolve(root, 'package.json');
  const manifestPath = resolve(root, 'manifest.json');
  const versionsPath = resolve(root, 'versions.json');
  const packageJson = readJson(packagePath);
  const manifest = readJson(manifestPath);
  const versions = readJson(versionsPath);
  const packageName = requiredString(packageJson.name, 'name', packagePath);
  const packageVersion = requiredString(packageJson.version, 'version', packagePath);
  const manifestId = requiredString(manifest.id, 'id', manifestPath);
  const manifestVersion = requiredString(manifest.version, 'version', manifestPath);
  const minAppVersion = requiredString(manifest.minAppVersion, 'minAppVersion', manifestPath);

  if (packageName !== manifestId) {
    throw new Error(`package.json name ${packageName} does not match manifest.json id ${manifestId}`);
  }
  if (packageVersion !== manifestVersion) {
    throw new Error(`package.json version ${packageVersion} does not match manifest.json version ${manifestVersion}`);
  }
  if (versions[packageVersion] !== minAppVersion) {
    throw new Error(`versions.json entry for ${packageVersion} does not match manifest.json minAppVersion ${minAppVersion}`);
  }

  return { version: packageVersion, manifestPath, packagePath, minAppVersion };
}

export function validateReleaseDirectory(releasePath) {
  if (!existsSync(releasePath)) return;

  if (!lstatSync(releasePath).isDirectory()) {
    throw new Error(`Release output path is not a directory: ${releasePath}`);
  }

  for (const entry of readdirSync(releasePath, { withFileTypes: true })) {
    if (!ARTIFACT_FILES.includes(entry.name)) {
      throw new Error(`Unexpected path in release output: ${entry.name}`);
    }
    if (!entry.isFile()) {
      throw new Error(`Release artifact path is not a regular file: ${entry.name}`);
    }
  }
}

const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

export function publishRelease(root, metadata) {
  const releasePath = resolve(root, 'release');
  const mainPath = resolve(root, 'main.js');
  if (!existsSync(mainPath) || !lstatSync(mainPath).isFile()) {
    throw new Error(`Production output is missing: ${mainPath}`);
  }

  mkdirSync(releasePath, { recursive: true });
  copyFileSync(mainPath, resolve(releasePath, 'main.js'));
  copyFileSync(metadata.manifestPath, resolve(releasePath, 'manifest.json'));
  validateReleaseDirectory(releasePath);

  const hashes = {
    'main.js': sha256(resolve(releasePath, 'main.js')),
    'manifest.json': sha256(resolve(releasePath, 'manifest.json')),
  };
  const text = [
    `Release version: ${metadata.version}`,
    'Artifact files:',
    ...ARTIFACT_FILES.map(file => `  ${file}`),
    'SHA-256:',
    ...ARTIFACT_FILES.map(file => `  ${file}: ${hashes[file]}`),
    'Output directory: release/',
  ].join('\n');

  return { version: metadata.version, hashes, text };
}

const runCanonicalCheck = root => {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  execFileSync(npm, ['run', 'check'], { cwd: root, stdio: 'inherit' });
};

export function runReleaseCheck({
  root = repositoryRoot,
  runCheck = runCanonicalCheck,
  log = console.log,
} = {}) {
  const releasePath = resolve(root, 'release');
  validateReleaseDirectory(releasePath);
  runCheck(root);
  const metadata = validateMetadata(root);
  const report = publishRelease(root, metadata);
  log(report.text);
  return report;
}

if (isMain) {
  if (process.argv.length > 2) {
    console.error('release:check does not accept arguments');
    process.exitCode = 1;
  } else {
    try {
      runReleaseCheck();
    } catch (error) {
      console.error(`Release check failed: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
