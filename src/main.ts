import { MarkdownView, Plugin, TFile, TFolder, WorkspaceLeaf } from 'obsidian';
import { FolderSuggestModal } from './FolderSuggestModal';
import { SymlinkManager } from './SymlinkManager';

export default class SymlinkNotesPlugin extends Plugin {
  private manager!: SymlinkManager;
  private unloaded = false;
  private readonly opening = new WeakMap<WorkspaceLeaf, TFile>();
  private readonly checked = new WeakMap<WorkspaceLeaf, TFile>();

  onload(): void {
    this.manager = new SymlinkManager(this.app);
    const { vault, metadataCache, workspace } = this.app;

    this.registerEvent(workspace.on('file-open', file => {
      for (const leaf of workspace.getLeavesOfType('markdown')) {
        if (leaf.view instanceof MarkdownView && leaf.view.file === file) {
          this.checked.delete(leaf);
          this.checkLeaf(leaf);
        }
      }
    }));
    this.registerEvent(workspace.on('active-leaf-change', leaf => {
      if (leaf) this.checkLeaf(leaf);
    }));
    this.registerEvent(workspace.on('layout-change', () => this.checkOpenLeaves()));
    workspace.onLayoutReady(() => {
      if (this.unloaded) return;
      void this.manager.enqueue(() => this.manager.rebuildIndex(), 'Could not build symlink index');

      this.registerEvent(vault.on('create', file => this.manager.onFileChanged(file)));
      this.registerEvent(vault.on('modify', file => this.manager.onFileChanged(file)));
      this.registerEvent(metadataCache.on('changed', file => this.manager.onFileChanged(file)));
      this.registerEvent(vault.on('delete', file => {
        void this.manager.enqueue(async () => this.manager.remove(file), 'Could not remove symlink from index');
      }));
      this.registerEvent(vault.on('rename', (file, oldPath) => {
        // Capture the new path before another rename mutates the same TFile object.
        const newPath = file.path;
        const folder = file instanceof TFolder;
        void this.manager.enqueue(() => this.manager.handleRename(oldPath, newPath, folder), 'Could not update renamed targets');
        if (!folder) this.manager.onFileChanged(file);
      }));

      this.checkOpenLeaves();
    });

    this.addCommand({
      id: 'create-symlink-to-current-note',
      name: 'Create symlink to active note',
      checkCallback: checking => {
        const file = workspace.getActiveFile();
        if (!file || file.extension !== 'md') return false;
        if (!checking) new FolderSuggestModal(this.app, folder => {
          void this.manager.enqueue(() => this.manager.createSymlink(file, folder), 'Could not create symlink');
        }).open();
        return true;
      },
    });
  }

  onunload(): void {
    this.unloaded = true;
    this.manager.stop();
  }

  private checkOpenLeaves(): void {
    for (const leaf of this.app.workspace.getLeavesOfType('markdown')) this.checkLeaf(leaf);
  }

  private checkLeaf(leaf: WorkspaceLeaf): void {
    const view = leaf.view;
    if (this.unloaded || !(view instanceof MarkdownView) || !view.file) return;
    const source = view.file;
    if (this.opening.get(leaf) === source || this.checked.get(leaf) === source) return;
    this.checked.set(leaf, source);
    this.opening.set(leaf, source);
    void this.redirect(leaf, view, source);
  }

  private async redirect(leaf: WorkspaceLeaf, view: MarkdownView, source: TFile): Promise<void> {
    try {
      const target = await this.manager.resolveTarget(source);
      // Resolution is asynchronous: never replace a note the user navigated to meanwhile.
      if (this.unloaded || leaf.view !== view || view.file !== source ||
          !this.app.workspace.getLeavesOfType('markdown').includes(leaf)) return;
      if (target && target !== source) {
        await leaf.openFile(target, { active: false, state: { mode: view.getMode() } });
      }
    } catch (error: unknown) {
      this.manager.report(`Could not open symlink ${source.path}`, error);
    } finally {
      if (this.opening.get(leaf) === source) this.opening.delete(leaf);
    }
  }
}
