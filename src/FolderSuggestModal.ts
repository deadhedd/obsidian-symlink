import { App, FuzzySuggestModal, TFolder } from 'obsidian';

export class FolderSuggestModal extends FuzzySuggestModal<TFolder> {
  constructor(app: App, private readonly choose: (folder: TFolder) => void) {
    super(app);
    this.setPlaceholder('Choose a folder for the symlink');
  }

  getItems(): TFolder[] {
    return [this.app.vault.getRoot(), ...this.app.vault.getAllLoadedFiles()
      .filter((file): file is TFolder => file instanceof TFolder && !file.isRoot())
      .sort((a, b) => a.path.localeCompare(b.path))];
  }

  getItemText(folder: TFolder): string {
    return folder.isRoot() ? '/ (vault root)' : folder.path;
  }

  onChooseItem(folder: TFolder): void {
    this.choose(folder);
  }
}
