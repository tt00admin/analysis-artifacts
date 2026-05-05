import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Deck, Clip } from '../types/index.js';

export class StorageService {
  private storagePath: string;
  private clipsJsonPath: string;
  private imagesPath: string;

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

  async initialize(): Promise<void> {
    await fs.mkdir(this.storagePath, { recursive: true });
    await fs.mkdir(this.imagesPath, { recursive: true });
    try {
      await fs.access(this.clipsJsonPath);
    } catch {
      const initialDeck: Deck = {
        version: '1.0.0',
        lastUpdated: Date.now(),
        clips: [],
        settings: {
          autoSave: true,
          maxClips: 100,
          imageQuality: 85
        }
      };
      await this.saveDeck(initialDeck);
    }
  }

  async loadDeck(): Promise<Deck> {
    try {
      const data = await fs.readFile(this.clipsJsonPath, 'utf-8');
      return JSON.parse(data) as Deck;
    } catch {
      await this.initialize();
      return this.loadDeck();
    }
  }

  async saveDeck(deck: Deck): Promise<void> {
    deck.lastUpdated = Date.now();
    await fs.writeFile(this.clipsJsonPath, JSON.stringify(deck, null, 2), 'utf-8');
  }

  async saveImage(base64Data: string, filename: string): Promise<string> {
    const imagePath = path.join(this.imagesPath, filename);
    const buffer = Buffer.from(base64Data, 'base64');
    await fs.writeFile(imagePath, buffer);
    return path.relative(this.storagePath, imagePath);
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
    const deck = await this.loadDeck();
    deck.clips = deck.clips.filter((c: Clip) => c.id !== clip.id);
    if (clip.content.imagePath) {
      await this.deleteImage(clip.content.imagePath);
    }
    await this.saveDeck(deck);
  }
}
