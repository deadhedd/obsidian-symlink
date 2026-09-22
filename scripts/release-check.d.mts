export const ARTIFACT_FILES: readonly ['main.js', 'manifest.json'];
export const repositoryRoot: string;

export interface ReleaseMetadata {
  version: string;
  manifestPath: string;
  packagePath: string;
  minAppVersion: string;
}

export interface ReleaseReport {
  version: string;
  hashes: {
    'main.js': string;
    'manifest.json': string;
  };
  text: string;
}

export interface ReleaseCheckOptions {
  root?: string;
  runCheck?: (root: string) => void;
  log?: (text: string) => void;
}

export function validateMetadata(root: string): ReleaseMetadata;
export function validateReleaseDirectory(releasePath: string): void;
export function publishRelease(root: string, metadata: ReleaseMetadata): ReleaseReport;
export function runReleaseCheck(options?: ReleaseCheckOptions): ReleaseReport;
