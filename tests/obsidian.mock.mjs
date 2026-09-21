import { parse, stringify } from 'yaml';

export const notices = [];
export class Notice {
  constructor(message) { notices.push(message); }
}
export class TAbstractFile {
  constructor(path) { this.path = path; }
  get name() { return this.path.split('/').at(-1); }
}
export class TFile extends TAbstractFile {
  get extension() { return this.name.split('.').at(-1); }
}
export class TFolder extends TAbstractFile {
  isRoot() { return this.path === '/'; }
}
export class MarkdownView {
  constructor(file) { this.file = file; }
  getMode() { return 'source'; }
}
export class Plugin {
  constructor(app) { this.app = app; this.events = []; this.commands = []; }
  registerEvent(event) { this.events.push(event); }
  addCommand(command) { this.commands.push(command); }
}
export class FuzzySuggestModal {
  constructor(app) { this.app = app; }
  setPlaceholder(value) { this.placeholder = value; }
  open() { this.app.modal = this; }
}
export function getFrontMatterInfo(content) {
  const match = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
  return { exists: Boolean(match), frontmatter: match?.[1] ?? '', contentStart: match?.[0].length ?? 0 };
}
export const parseYaml = parse;

class Events {
  callbacks = new Map();
  on(name, callback) {
    const callbacks = this.callbacks.get(name) ?? [];
    callbacks.push(callback);
    this.callbacks.set(name, callbacks);
    return { owner: this, name, callback };
  }
  trigger(name, ...args) {
    for (const callback of this.callbacks.get(name) ?? []) callback(...args);
  }
}

export function fixture() {
  notices.length = 0;
  const files = new Map();
  const contents = new Map();
  const writes = [];
  const root = new TFolder('/');
  files.set('/', root);
  const vault = Object.assign(new Events(), {
    getRoot: () => root,
    getAllLoadedFiles: () => [...files.values()],
    getMarkdownFiles: () => [...files.values()].filter(file => file instanceof TFile && file.extension === 'md'),
    getAbstractFileByPath: path => files.get(path) ?? null,
    cachedRead: async file => {
      if (!contents.has(file)) throw new Error('File missing');
      return contents.get(file);
    },
    create: async (path, content) => {
      if (files.has(path)) throw new Error('File already exists');
      return add(path, content);
    },
  });
  const metadataCache = Object.assign(new Events(), {
    getFileCache: file => {
      try { return { frontmatter: parseYaml(getFrontMatterInfo(contents.get(file)).frontmatter) }; }
      catch { return {}; }
    },
  });
  const fileManager = {
    processFrontMatter: async (file, update) => {
      const original = contents.get(file);
      const info = getFrontMatterInfo(original);
      const frontmatter = parseYaml(info.frontmatter) ?? {};
      update(frontmatter);
      writes.push(file.path);
      contents.set(file, `---\n${stringify(frontmatter)}---\n${original.slice(info.contentStart)}`);
      vault.trigger('modify', file);
    },
  };
  const leaves = [];
  const workspace = Object.assign(new Events(), {
    getLeavesOfType: () => leaves,
    getActiveFile: () => workspace.activeLeaf?.view.file ?? null,
    onLayoutReady: callback => { workspace.ready = callback; },
  });
  const app = { vault, metadataCache, fileManager, workspace };
  function add(path, content = '') {
    const file = new TFile(path);
    files.set(path, file);
    contents.set(file, content);
    vault.trigger('create', file);
    return file;
  }
  function folder(path) {
    const file = new TFolder(path);
    files.set(path, file);
    return file;
  }
  function rename(file, path) {
    const oldPath = file.path;
    for (const [entry, value] of [...files]) {
      if (entry === oldPath || (file instanceof TFolder && entry.startsWith(oldPath + '/'))) {
        files.delete(entry);
        value.path = path + entry.slice(oldPath.length);
        files.set(value.path, value);
      }
    }
    vault.trigger('rename', file, oldPath);
    return oldPath;
  }
  function remove(file) {
    files.delete(file.path);
    contents.delete(file);
    vault.trigger('delete', file);
  }
  function edit(file, content) {
    contents.set(file, content);
    vault.trigger('modify', file);
    metadataCache.trigger('changed', file);
  }
  function leaf(file, active = true) {
    const value = {
      view: new MarkdownView(file),
      opened: [],
      openFile: async (target, options) => {
        value.opened.push({ target, options });
        value.view.file = target;
        workspace.trigger('file-open', target);
      },
    };
    leaves.push(value);
    if (active) workspace.activeLeaf = value;
    return value;
  }
  return { app, add, folder, rename, remove, edit, leaf, contents, files, writes, leaves };
}
