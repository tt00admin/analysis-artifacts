import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Deck, Clip } from '../types/index.js';
import { DEFAULT_SETTINGS, DECK_VERSION } from '../utils/constants.js';
import { migrateDeck } from './migration.js';

export class StorageService {
  private storagePath: string;
  private clipsJsonPath: string;
  private imagesPath: string;
  private updateQueue: Promise<unknown> = Promise.resolve();

  constructor(private context: vscode.ExtensionContext) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      this.storagePath = path.join(workspaceFolder.uri.fsPath, '.vscode', 'datadeck');
      this.clipsJsonPath = path.join(this.storagePath, 'clips.json');
      this.imagesPath = path.join(this.storagePath, 'images');
    } else {
      this.storagePath = context.globalStorageUri.fsPath;
      this.clipsJsonPath = '';
      this.imagesPath = path.join(this.storagePath, 'images');
      this.clipsJsonPath = path.join(this.storagePath, 'clips.json');
      console.warn('No workspace folder found. DataDeck will use global extension storage.');
    }
  }

  getStorageUri(): vscode.Uri {
    return vscode.Uri.file(this.storagePath);
  }

  getImageUri(imagePath: string): vscode.Uri {
    return vscode.Uri.file(path.isAbsolute(imagePath) ? imagePath : path.join(this.storagePath, imagePath));
  }

  getImageFsPath(imagePath: string): string {
    return path.isAbsolute(imagePath) ? imagePath : path.join(this.storagePath, imagePath);
  }

  private createInitialDeck(): Deck {
    return {
      version: DECK_VERSION,
      lastUpdated: Date.now(),
      clips: [],
      settings: { ...DEFAULT_SETTINGS }
    };
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.storagePath, { recursive: true });
    await fs.mkdir(this.imagesPath, { recursive: true });
    try {
      await fs.access(this.clipsJsonPath);
    } catch {
      await this.saveDeck(this.createInitialDeck());
    }
  }

  async loadDeck(): Promise<Deck> {
    await this.initialize();
    try {
      const data = await fs.readFile(this.clipsJsonPath, 'utf-8');
      const deck = JSON.parse(data) as Deck;
      return this.normalizeDeck(await migrateDeck(deck));
    } catch (error) {
      if (this.isNotFoundError(error)) {
        const initialDeck = this.createInitialDeck();
        await this.saveDeck(initialDeck);
        return initialDeck;
      }

      if (error instanceof SyntaxError) {
        const recoveredDeck = this.createInitialDeck();
        await this.backupCorruptDeck();
        await this.saveDeck(recoveredDeck);
        vscode.window.showWarningMessage('DataDeck storage was corrupt and has been reset. A backup of the corrupt file was kept in .vscode/datadeck/.');
        return recoveredDeck;
      }

      throw error;
    }
  }

  async saveDeck(deck: Deck): Promise<void> {
    await fs.mkdir(this.storagePath, { recursive: true });
    await fs.mkdir(this.imagesPath, { recursive: true });
    deck.lastUpdated = Date.now();
    const tmpPath = `${this.clipsJsonPath}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(this.normalizeDeck(deck), null, 2), 'utf-8');
    await fs.rename(tmpPath, this.clipsJsonPath);
  }

  async updateDeck(mutator: (deck: Deck) => void | Promise<void>): Promise<Deck> {
    const operation = this.updateQueue.then(async () => {
      const deck = await this.loadDeck();
      await mutator(deck);
      await this.enforceMaxClips(deck);
      await this.saveDeck(deck);
      return deck;
    });

    this.updateQueue = operation.catch(() => undefined);
    return operation;
  }

  async saveImage(base64Data: string, filename: string): Promise<string> {
    await fs.mkdir(this.imagesPath, { recursive: true });
    const imagePath = path.join(this.imagesPath, filename);
    const buffer = Buffer.from(base64Data, 'base64');
    await fs.writeFile(imagePath, buffer);
    return path.relative(this.storagePath, imagePath);
  }

  async getFileSize(relativePath: string): Promise<number | undefined> {
    try {
      const stat = await fs.stat(path.join(this.storagePath, relativePath));
      return stat.size;
    } catch {
      return undefined;
    }
  }

  async deleteImage(relativePath: string): Promise<void> {
    const fullPath = path.join(this.storagePath, relativePath);
    try {
      await fs.unlink(fullPath);
    } catch (error) {
      console.error('Failed to delete image:', error);
    }
  }

  async deleteClip(clip: Clip): Promise<void> {
    await this.updateDeck((deck) => {
      deck.clips = deck.clips.filter((c: Clip) => c.id !== clip.id);
    });
    if (clip.content.imagePath) {
      await this.deleteImage(clip.content.imagePath);
    }
  }

  async clearDeck(deleteImages = true): Promise<void> {
    const deck = await this.loadDeck();
    const imagePaths = deck.clips
      .map((clip) => clip.content.imagePath)
      .filter((imagePath): imagePath is string => Boolean(imagePath));

    await this.updateDeck((currentDeck) => {
      currentDeck.clips = [];
    });

    if (deleteImages) {
      await Promise.all(imagePaths.map((imagePath) => this.deleteImage(imagePath)));
      await this.deleteOrphanedImages();
    }
  }

  async deleteOrphanedImages(): Promise<void> {
    const deck = await this.loadDeck();
    const referenced = new Set(
      deck.clips
        .map((clip) => clip.content.imagePath)
        .filter((imagePath): imagePath is string => Boolean(imagePath))
        .map((imagePath) => path.normalize(imagePath))
    );

    let entries: string[] = [];
    try {
      entries = await fs.readdir(this.imagesPath);
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return;
      }
      throw error;
    }

    await Promise.all(entries.map(async (entry) => {
      const relativePath = path.normalize(path.join('images', entry));
      if (!referenced.has(relativePath)) {
        await this.deleteImage(relativePath);
      }
    }));
  }

  private async enforceMaxClips(deck: Deck): Promise<void> {
    const maxClips = deck.settings?.maxClips ?? DEFAULT_SETTINGS.maxClips;
    if (maxClips <= 0 || deck.clips.length <= maxClips) {
      return;
    }

    const overflow = deck.clips.length - maxClips;
    const removable = [...deck.clips]
      .filter((clip) => !clip.pinned)
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(0, overflow);

    if (removable.length === 0) {
      return;
    }

    const removableIds = new Set(removable.map((clip) => clip.id));
    deck.clips = deck.clips.filter((clip) => !removableIds.has(clip.id));
    await Promise.all(removable.map((clip) => clip.content.imagePath ? this.deleteImage(clip.content.imagePath) : undefined));
  }

  private normalizeDeck(deck: Deck): Deck {
    return {
      version: deck.version || DECK_VERSION,
      lastUpdated: deck.lastUpdated || Date.now(),
      clips: Array.isArray(deck.clips) ? deck.clips.map((clip) => ({
        ...clip,
        tags: Array.isArray(clip.tags) ? clip.tags : [],
        pinned: Boolean(clip.pinned),
        order: clip.order ?? clip.timestamp ?? Date.now(),
        metadata: clip.metadata ?? {},
        content: clip.content ?? {},
        source: clip.source ?? { notebookUri: '' }
      })) : [],
      settings: {
        ...DEFAULT_SETTINGS,
        ...(deck.settings ?? {})
      }
    };
  }

  private async backupCorruptDeck(): Promise<void> {
    try {
      const backupPath = path.join(this.storagePath, `clips.corrupt.${Date.now()}.json`);
      await fs.rename(this.clipsJsonPath, backupPath);
    } catch (error) {
      if (!this.isNotFoundError(error)) {
        console.error('Failed to back up corrupt DataDeck storage:', error);
      }
    }
  }

  private isNotFoundError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT';
  }
}
