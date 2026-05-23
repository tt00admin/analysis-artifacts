import * as vscode from 'vscode';
import { StorageService } from '../storage/storageService.js';
import { ClipboardService } from '../clipboard/clipboardService.js';
import { NotebookAdapter } from '../notebook/notebookAdapter.js';
import { SearchService } from '../search/searchService.js';
import { DnDService } from '../sidebar/components/dndService.js';
import { MarkdownGenerator } from '../export/markdownGenerator.js';
import { Clip, SearchFilters } from '../types/index.js';
import { WebviewHelpers } from './webviewHelpers.js';
import { ContentPanelService } from './contentPanelService.js';

/** Webviewから受信するメッセージの型 */
interface WebviewMessage {
  type: string;
  clipId?: string;
  query?: string;
  clipType?: string;
  dateFrom?: number;
  dateTo?: number;
  notebookFileName?: string;
  tags?: string[];
  startIndex?: number;
  endIndex?: number;
  targetClipId?: string;
  clipIds?: string[];
  pinned?: boolean;
  clip?: Clip;
  updates?: { title?: string; memo?: string; tags?: string[] };
  notebookUri?: string;
  cellId?: string;
}

export class SidebarProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private readonly webviewHelpers: WebviewHelpers;
  private readonly contentPanelService: ContentPanelService;
  private readonly searchService: SearchService;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly storageService: StorageService,
    private readonly clipboardService: ClipboardService
  ) {
    this.webviewHelpers = new WebviewHelpers(storageService);
    this.contentPanelService = new ContentPanelService(storageService);
    this.searchService = new SearchService();
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    try {
      console.log('DataDeck: Resolving webview view...');
      this._view = webviewView;

      webviewView.webview.options = {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this._extensionUri, 'out', 'webview'),
          this.storageService.getStorageUri(),
          this._extensionUri
        ]
      };

      const html = this.webviewHelpers.getHtmlForWebview(webviewView.webview, this._extensionUri);
      console.log('DataDeck: Webview HTML generated, length:', html.length);
      webviewView.webview.html = html;
      console.log('DataDeck: Webview HTML set successfully');

      webviewView.webview.onDidReceiveMessage(async (message) => {
        await this._handleMessage(message);
      });

      webviewView.onDidChangeVisibility(async () => {
        if (webviewView.visible) {
          await this._sendDeck();
        }
      });

      console.log('DataDeck: Webview view resolved successfully');
    } catch (error) {
      console.error('DataDeck: Error in resolveWebviewView:', error);
      throw error;
    }
  }

  private async _handleMessage(message: WebviewMessage): Promise<void> {
    if (!this._view) {
      return;
    }

    try {
      switch (message.type) {
        case 'clipActiveCell':
          await this.clipboardService.clipActiveCell(undefined, { pinned: message.pinned });
          this.refreshDeck();
          break;
        case 'requestDeck':
          await this._sendDeck();
          break;
        case 'filterDeck':
          await this._sendFilteredDeck(message);
          break;
        case 'exportMarkdown':
          if (message.clipIds && message.clipIds.length > 0) {
            await this._exportSelectedMarkdown(message.clipIds);
          } else {
            await this._exportMarkdown();
          }
          break;
        case 'deleteClip':
          if (message.clipId) {
            await this._deleteClip(message.clipId);
          }
          break;
        case 'togglePin':
          if (message.clipId) {
            await this._togglePin(message.clipId);
            this.refreshDeck();
          }
          break;
        case 'jumpToCell':
          if (message.notebookUri) {
            await this._jumpToCell(message.notebookUri, message.cellId, message.clip?.source.cellIndex, message.clip?.source.codeHash);
          }
          break;
        case 'reorderClips':
          if (message.clipId && message.targetClipId) {
            await this._reorderClips(message.clipId, message.targetClipId);
            this.refreshDeck();
          }
          break;
        case 'openImage':
          if (message.clip) {
            await this.contentPanelService.openClip(message.clip);
          }
          break;
        case 'openClip':
          if (message.clip) {
            await this.contentPanelService.openClip(message.clip);
          }
          break;
        case 'reorderRecentClips':
          if (message.clipType && message.clipId && message.targetClipId) {
            await this._reorderRecentClips(message.clipType, message.clipId, message.targetClipId);
            this.refreshDeck();
          }
          break;
        case 'updateClip':
          if (message.clipId) {
            await this._updateClip(message.clipId, message.updates ?? {});
            this.refreshDeck();
          }
          break;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`DataDeck operation failed: ${errorMessage}`);
      this._view.webview.postMessage({ type: 'error', message: errorMessage });
      await this.refreshDeck();
    }
  }

  private async _sendDeck(): Promise<void> {
    if (!this._view) {
      return;
    }
    const deck = await this.storageService.loadDeck();
    const webview = this._view.webview;
    const convertedClips = this.webviewHelpers.convertClipsForWebview(deck.clips, webview);
    const convertedDeck = { ...deck, clips: convertedClips, allTags: this.searchService.getAllTags(deck.clips), clipState: this.getClipState() };
    this._view.webview.postMessage({ type: 'deckUpdate', deck: convertedDeck });
  }

  private async _sendFilteredDeck(message: WebviewMessage): Promise<void> {
    if (!this._view) {
      return;
    }
    const deck = await this.storageService.loadDeck();
    const filters: SearchFilters = {
      type: message.clipType as Clip['type'] | undefined,
      tags: message.tags,
      dateFrom: message.dateFrom,
      dateTo: message.dateTo,
      notebookFileName: message.notebookFileName
    };
    const filteredClips = this.searchService.searchClips(deck.clips, message.query || '', filters);

    const webview = this._view.webview;
    const convertedClips = this.webviewHelpers.convertClipsForWebview(filteredClips, webview);
    const convertedDeck = { ...deck, clips: convertedClips, allTags: this.searchService.getAllTags(deck.clips), clipState: this.getClipState() };
    this._view.webview.postMessage({ type: 'deckUpdate', deck: convertedDeck });
  }

  private async _exportMarkdown(): Promise<void> {
    try {
      const deck = await this.storageService.loadDeck();
      if (deck.clips.length === 0) {
        vscode.window.showInformationMessage('No clips to export');
        return;
      }
      const outputUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file('datadeck-export.md'),
        filters: { 'Markdown': ['md'] }
      });
      if (outputUri) {
        await MarkdownGenerator.generateMarkdown(deck.clips, outputUri.fsPath, {
          copyImageAssets: true,
          resolveImagePath: (imagePath) => this.storageService.getImageFsPath(imagePath)
        });
        vscode.window.showInformationMessage(`Markdown exported: ${outputUri.fsPath}`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Export failed: ${error}`);
    }
  }

  private async _exportSelectedMarkdown(clipIds: string[]): Promise<void> {
    try {
      const deck = await this.storageService.loadDeck();
      const selected = deck.clips.filter((clip) => clipIds.includes(clip.id));
      if (selected.length === 0) {
        vscode.window.showInformationMessage('No selected clips to export');
        return;
      }
      const outputUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file('datadeck-export.md'),
        filters: { 'Markdown': ['md'] }
      });
      if (outputUri) {
        await MarkdownGenerator.generateMarkdown(selected, outputUri.fsPath, {
          copyImageAssets: true,
          resolveImagePath: (imagePath) => this.storageService.getImageFsPath(imagePath)
        });
        vscode.window.showInformationMessage(`Markdown exported: ${outputUri.fsPath}`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Export failed: ${error}`);
    }
  }

  private async _deleteClip(clipId: string): Promise<void> {
    await this.storageService.updateDeck(async (deck) => {
      const clip = deck.clips.find((c: Clip) => c.id === clipId);
      if (!clip) {
        return;
      }
      deck.clips = deck.clips.filter((c: Clip) => c.id !== clipId);
      if (clip.content.imagePath) {
        await this.storageService.deleteImage(clip.content.imagePath);
      }
    });
    this.refreshDeck();
  }

  public async refreshDeck(): Promise<void> {
    await this._sendDeck();
  }

  private async _togglePin(clipId: string): Promise<void> {
    await this.storageService.updateDeck((deck) => {
      const clip = deck.clips.find((c: Clip) => c.id === clipId);
      if (clip) {
        clip.pinned = !clip.pinned;
        clip.order = clip.pinned
          ? this.nextPinnedOrder(deck.clips)
          : Date.now();
      }
    });
  }

  private async _updateClip(clipId: string, updates: { title?: string; memo?: string; tags?: string[] }): Promise<void> {
    await this.storageService.updateDeck((deck) => {
      const clip = deck.clips.find((c: Clip) => c.id === clipId);
      if (clip) {
        if (updates.title !== undefined) {
          clip.title = updates.title;
        }
        if (updates.memo !== undefined) {
          clip.memo = updates.memo;
        }
        if (updates.tags !== undefined) {
          clip.tags = updates.tags;
        }
      }
    });
  }

  private async _reorderClips(clipId: string, targetClipId: string): Promise<void> {
    try {
      await this.storageService.updateDeck((deck) => {
        deck.clips = DnDService.reorderPinnedClipsById(deck.clips, clipId, targetClipId);
      });
      console.log(`Reordered pinned clip: moved ${clipId} before ${targetClipId}`);
    } catch (error) {
      console.error('Failed to reorder pinned clips:', error);
      vscode.window.showErrorMessage(`Failed to reorder pinned clips: ${error instanceof Error ? error.message : error}. The deck state has been restored.`);
      // deckを再読み込みして、前端の状態とストレージを一致させる
      await this.refreshDeck();
    }
  }

  private async _reorderRecentClips(clipType: string, clipId: string, targetClipId: string): Promise<void> {
    try {
      await this.storageService.updateDeck((deck) => {
        deck.clips = DnDService.reorderRecentClipsById(deck.clips, clipType, clipId, targetClipId);
      });
      console.log(`Reordered recent clip of type ${clipType}: moved ${clipId} before ${targetClipId}`);
    } catch (error) {
      console.error('Failed to reorder recent clips:', error);
      vscode.window.showErrorMessage(`Failed to reorder clips: ${error}`);
    }
  }

  private nextPinnedOrder(clips: Clip[]): number {
    const orders = clips.filter((clip) => clip.pinned).map((clip) => clip.order ?? 0);
    return orders.length > 0 ? Math.max(...orders) + 1 : 0;
  }

  private async _jumpToCell(notebookUri: string, cellId?: string, cellIndex?: number, codeHash?: string): Promise<void> {
    try {
      const notebookAdapter = new NotebookAdapter();
      await notebookAdapter.jumpToCell(notebookUri, cellId, cellIndex, codeHash);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to jump to cell: ${error}`);
    }
  }

  private getClipState(): { canClip: boolean; reason?: string } {
    const notebookAdapter = new NotebookAdapter();
    return notebookAdapter.canClipActiveCell();
  }
}
