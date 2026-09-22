export interface MockFile {
    path: string;
    readonly name: string;
    readonly extension: string;
  }

export interface MockFolder {
    path: string;
    readonly name: string;
    isRoot(): boolean;
  }

export type MockAbstractFile = MockFile | MockFolder;

export interface MockEventRef {
    readonly owner: unknown;
    readonly name: string;
    readonly callback: unknown;
  }

export interface MockEvents {
    on(name: string, callback: (...args: never[]) => void): MockEventRef;
    trigger(name: string, ...args: unknown[]): void;
  }

export interface MockVault extends MockEvents {
    getRoot(): MockFolder;
    getAllLoadedFiles(): MockAbstractFile[];
    getMarkdownFiles(): MockFile[];
    getAbstractFileByPath(path: string): MockAbstractFile | null;
    cachedRead(file: MockFile): Promise<string>;
    create(path: string, content: string): Promise<MockFile>;
  }

export interface MockMetadataCache extends MockEvents {
    getFileCache(file: MockFile): { frontmatter: unknown } | null;
  }

export interface MockFileManager {
    processFrontMatter(
      file: MockFile,
      update: (frontmatter: Record<string, unknown>) => void,
    ): Promise<void>;
  }

export interface MockView {
    file: MockFile;
    getMode(): string;
  }

export interface MockOpenRecord {
    target: MockFile;
    options: unknown;
  }

export interface MockLeaf {
    view: MockView;
    opened: MockOpenRecord[];
    openFile(target: MockFile, options: unknown): Promise<void>;
  }

export interface MockWorkspace extends MockEvents {
    activeLeaf: MockLeaf | null;
    ready: () => void;
    getLeavesOfType(type: string): MockLeaf[];
    getActiveFile(): MockFile | null;
    onLayoutReady(callback: () => void): void;
  }

export interface MockFolderModal {
    getItems(): MockFolder[];
    onChooseItem(folder: MockFolder): void;
  }

export interface MockMap<K, V> {
  get(key: K): V | undefined;
  has(key: K): boolean;
  keys(): IterableIterator<K>;
}

export interface MockApp {
    vault: MockVault;
    metadataCache: MockMetadataCache;
    fileManager: MockFileManager;
    workspace: MockWorkspace;
    modal?: MockFolderModal | null;
  }

export interface Fixture {
    app: MockApp;
    add(path: string, content?: string): MockFile;
    folder(path: string): MockFolder;
    rename(file: MockAbstractFile, path: string): string;
    remove(file: MockAbstractFile): void;
    edit(file: MockFile, content: string): void;
    leaf(file: MockFile, active?: boolean): MockLeaf;
    contents: MockMap<MockAbstractFile, string>;
    files: MockMap<string, MockAbstractFile>;
    writes: string[];
    leaves: MockLeaf[];
  }

export const notices: string[];
export class Notice {
  constructor(message: string);
}
export function fixture(): Fixture;
export function parseYaml(source: string): Record<string, unknown>;
export function getFrontMatterInfo(content: string): {
  exists: boolean;
  frontmatter: string;
  contentStart: number;
};
