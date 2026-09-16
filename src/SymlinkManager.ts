import { App, getFrontMatterInfo, Notice, parseYaml, TAbstractFile, TFile, TFolder } from 'obsidian';

export const MAX_REDIRECTS = 20;

function targetFrom(frontmatter: unknown): string | null {
  if (!frontmatter || typeof frontmatter !== 'object') return null;
  const value: unknown = (frontmatter as Record<string, unknown>).symlink;
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function isVaultPath(path: string): boolean {
  return !path.startsWith('/') && !path.includes('\\') &&
    !/^[a-z][a-z\d+.-]*:/i.test(path) &&
    path.split('/').every(part => part !== '' && part !== '.' && part !== '..');
}

export class SymlinkManager {
  // TFile paths stay current even if another move precedes a queued write.
  private readonly targets = new Map<TFile, string>();
  private readonly links = new Map<string, Set<TFile>>();
  private pending: Promise<void> = Promise.resolve();
  private stopped = false;

  constructor(private readonly app: App) {}

  stop(): void {
    this.stopped = true;
  }

  report(action: string, error: unknown): void {
    console.error(`Symlink Notes: ${action}`, error);
    new Notice(`Symlink Notes: ${action}. ${error instanceof Error ? error.message : String(error)}`);
  }

  // Serialize index changes and rename writes so rapid moves use the preceding update.
  enqueue(action: () => Promise<void>, description: string): Promise<void> {
    this.pending = this.pending.then(async () => {
      if (!this.stopped) await action();
    }).catch((error: unknown) => this.report(description, error));
    return this.pending;
  }

  async whenIdle(): Promise<void> {
    await this.pending;
  }

  async getTargetPath(file: TFile): Promise<string | null> {
    if (file.extension !== 'md') return null;
    // The metadata cache may still describe the previous content after a write.
    // Use Obsidian's cached read and YAML APIs for navigation and atomic-write checks.
    const content = await this.app.vault.cachedRead(file);
    const info = getFrontMatterInfo(content);
    if (!info.exists) return null;
    try {
      return targetFrom(parseYaml(info.frontmatter));
    } catch {
      return null; // Malformed YAML remains an editable ordinary note.
    }
  }

  async resolveTarget(source: TFile): Promise<TFile | null> {
    await this.whenIdle();
    let file = source;
    const visited = new Set<string>();
    for (let depth = 0; ; depth++) {
      if (this.stopped) return null;
      if (visited.has(file.path)) {
        new Notice('Circular symlink detected.');
        return null;
      }
      visited.add(file.path);
      const path = await this.getTargetPath(file);
      if (path === null) return file;
      if (depth >= MAX_REDIRECTS) {
        new Notice(`Symlink chain exceeds ${MAX_REDIRECTS} redirects.`);
        return null;
      }
      if (!isVaultPath(path)) {
        new Notice(`Invalid symlink target (use a vault-relative path):\n${path}`);
        return null;
      }
      const target = this.app.vault.getAbstractFileByPath(path);
      if (!target) {
        new Notice(`Symlink target not found:\n${path}`);
        return null;
      }
      if (!(target instanceof TFile) || target.extension !== 'md') {
        new Notice(`Symlink target is not a Markdown note:\n${path}`);
        return null;
      }
      file = target;
    }
  }

  async createSymlink(target: TFile, destination: TFolder): Promise<void> {
    if (target.extension !== 'md' || this.app.vault.getAbstractFileByPath(target.path) !== target) {
      throw new Error('The target note no longer exists.');
    }
    if (this.app.vault.getAbstractFileByPath(destination.path) !== destination) {
      throw new Error('The destination folder no longer exists.');
    }
    const path = destination.isRoot() ? target.name : `${destination.path}/${target.name}`;
    if (this.app.vault.getAbstractFileByPath(path)) {
      new Notice(`Cannot create symlink: destination already exists:\n${path}`);
      return;
    }
    // JSON string literals are valid YAML scalars, including colons, quotes and '#'.
    const file = await this.app.vault.create(path, `---\nsymlink: ${JSON.stringify(target.path)}\n---\n`);
    this.setTarget(file, target.path);
    new Notice(`Symlink created in ${destination.isRoot() ? 'vault root' : destination.path}`);
  }

  private setTarget(file: TFile, target: string | null): void {
    const previous = this.targets.get(file);
    if (previous !== undefined) {
      const incoming = this.links.get(previous);
      incoming?.delete(file);
      if (incoming?.size === 0) this.links.delete(previous);
      this.targets.delete(file);
    }
    if (target !== null) {
      this.targets.set(file, target);
      const incoming = this.links.get(target) ?? new Set<TFile>();
      incoming.add(file);
      this.links.set(target, incoming);
    }
  }

  async refresh(file: TFile): Promise<void> {
    if (this.app.vault.getAbstractFileByPath(file.path) !== file) return;
    const target = await this.getTargetPath(file);
    if (this.app.vault.getAbstractFileByPath(file.path) === file) this.setTarget(file, target);
  }

  async rebuildIndex(): Promise<void> {
    this.targets.clear();
    this.links.clear();
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (this.stopped) return;
      const cache = this.app.metadataCache.getFileCache(file);
      if (cache) this.setTarget(file, targetFrom(cache.frontmatter));
      else await this.refresh(file);
    }
  }

  remove(file: TAbstractFile): void {
    for (const link of this.targets.keys()) {
      if (link === file || (file instanceof TFolder && link.path.startsWith(`${file.path}/`))) {
        this.setTarget(link, null);
      }
    }
  }

  async handleRename(oldPath: string, newPath: string, folder: boolean): Promise<void> {
    const movedPath = (path: string): string =>
      path === oldPath || (folder && path.startsWith(`${oldPath}/`))
        ? newPath + path.slice(oldPath.length) : path;

    // A folder move may emit only one event, so include all descendant targets.
    const affected = folder
      ? [...this.links].filter(([target]) => movedPath(target) !== target)
      : [[oldPath, this.links.get(oldPath) ?? new Set<TFile>()] as const];
    for (const [oldTarget, paths] of affected) {
      for (const link of [...paths]) {
        if (this.stopped) return;
        if (this.app.vault.getAbstractFileByPath(link.path) !== link || link.extension !== 'md') continue;
        try {
          // Re-check on disk; do not overwrite a target the user edited since indexing.
          if (await this.getTargetPath(link) === oldTarget) {
            await this.app.fileManager.processFrontMatter(link, (frontmatter: Record<string, unknown>) => {
              if (targetFrom(frontmatter) === oldTarget) frontmatter.symlink = movedPath(oldTarget);
            });
          }
          await this.refresh(link);
        } catch (error: unknown) {
          this.report(`Could not update symlink ${link.path}`, error);
        }
      }
    }
  }

  onFileChanged(file: TAbstractFile): void {
    if (file instanceof TFile) {
      void this.enqueue(() => this.refresh(file), `Could not index ${file.path}`);
    }
  }
}
