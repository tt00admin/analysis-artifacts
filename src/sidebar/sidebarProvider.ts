import * as vscode from 'vscode';
import { StorageService } from '../storage/storageService.js';
import { ClipboardService } from '../clipboard/clipboardService.js';
import { NotebookAdapter } from '../notebook/notebookAdapter.js';
import { MarimoAdapter } from '../notebook/marimoAdapter.js';
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
  startIndex?: number;
  endIndex?: number;
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

    switch (message.type) {
      case 'clipActiveCell':
        await this.clipboardService.clipActiveCell();
        this._refreshDeck();
        break;
      case 'requestDeck':
        await this._sendDeck();
        break;
      case 'filterDeck':
        await this._sendFilteredDeck(message);
        break;
      case 'exportMarkdown':
        await this._exportMarkdown();
        break;
      case 'deleteClip':
        if (message.clipId) {
          await this._deleteClip(message.clipId);
        }
        break;
      case 'togglePin':
        if (message.clipId) {
          await this._togglePin(message.clipId);
          this._refreshDeck();
        }
        break;
      case 'jumpToCell':
        if (message.notebookUri && message.cellId) {
          await this._jumpToCell(message.notebookUri, message.cellId);
        }
        break;
      case 'reorderClips':
        if (message.startIndex !== undefined && message.endIndex !== undefined) {
          await this._reorderClips(message.startIndex, message.endIndex);
          this._refreshDeck();
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
        if (message.clipType && message.startIndex !== undefined && message.endIndex !== undefined) {
          await this._reorderRecentClips(message.clipType, message.startIndex, message.endIndex);
          this._refreshDeck();
        }
        break;
      case 'updateClip':
        if (message.clipId) {
          await this._updateClip(message.clipId, message.updates ?? {});
          this._refreshDeck();
        }
        break;
    }
  }

  private async _sendDeck(): Promise<void> {
    if (!this._view) {
      return;
    }
    const deck = await this.storageService.loadDeck();
    const webview = this._view.webview;
    const convertedClips = this.webviewHelpers.convertClipsForWebview(deck.clips, webview);
    const convertedDeck = { ...deck, clips: convertedClips };
    this._view.webview.postMessage({ type: 'deckUpdate', deck: convertedDeck });
  }

  private async _sendFilteredDeck(message: WebviewMessage): Promise<void> {
    if (!this._view) {
      return;
    }
    const deck = await this.storageService.loadDeck();
    const filters: SearchFilters = {
      type: message.clipType as Clip['type'] | undefined,
      dateFrom: message.dateFrom,
      dateTo: message.dateTo,
      notebookFileName: message.notebookFileName
    };
    const filteredClips = this.searchService.searchClips(deck.clips, message.query || '', filters);

    const webview = this._view.webview;
    const convertedClips = this.webviewHelpers.convertClipsForWebview(filteredClips, webview);
    const convertedDeck = { ...deck, clips: convertedClips };
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
        await MarkdownGenerator.generateMarkdown(deck.clips, outputUri.fsPath);
        vscode.window.showInformationMessage(`Markdown exported: ${outputUri.fsPath}`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Export failed: ${error}`);
    }
  }

  private async _deleteClip(clipId: string): Promise<void> {
    const deck = await this.storageService.loadDeck();
    const clip = deck.clips.find((c: Clip) => c.id === clipId);
    if (clip) {
      await this.storageService.deleteClip(clip);
    }
    this._refreshDeck();
  }

  private async _refreshDeck(): Promise<void> {
    await this._sendDeck();
  }

  private async _togglePin(clipId: string): Promise<void> {
    const deck = await this.storageService.loadDeck();
    const clip = deck.clips.find((c: Clip) => c.id === clipId);
    if (clip) {
      clip.pinned = !clip.pinned;
      await this.storageService.saveDeck(deck);
    }
  }

  private async _updateClip(clipId: string, updates: { title?: string; memo?: string; tags?: string[] }): Promise<void> {
    const deck = await this.storageService.loadDeck();
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
      await this.storageService.saveDeck(deck);
    }
  }

  private async _reorderClips(startIndex: number, endIndex: number): Promise<void> {
    try {
      const deck = await this.storageService.loadDeck();
      const originalClips = [...deck.clips];
      const newClips = DnDService.reorderClips(deck.clips, startIndex, endIndex);
      
      // パラメータが無効な場合、元のclipsを返すため保存しない
      if (newClips === originalClips) {
        console.log('Reorder of pinned clips skipped: invalid indices or no change');
        return;
      }
      
      deck.clips = newClips;
      await this.storageService.saveDeck(deck);
      console.log(`Reordered pinned clips: moved from ${startIndex} to ${endIndex}`);
    } catch (error) {
      console.error('Failed to reorder pinned clips:', error);
      vscode.window.showErrorMessage(`Failed to reorder pinned clips: ${error instanceof Error ? error.message : error}. The deck state has been restored.`);
      // deckを再読み込みして、前端の状態とストレージを一致させる
      await this._refreshDeck();
    }
  }

  private async _reorderRecentClips(clipType: string, startIndex: number, endIndex: number): Promise<void> {
    try {
      const deck = await this.storageService.loadDeck();
      
      // 該当タイプの未ピン留めクリップの実際のインデックスを収集
      const targetIndices: number[] = [];
      deck.clips.forEach((clip, index) => {
        if (clip.type === clipType && !clip.pinned) {
          targetIndices.push(index);
        }
      });
      
      if (targetIndices.length === 0) {
        console.log(`No clips of type ${clipType} to reorder`);
        return;
      }
      
      // 境界値チェック
      if (startIndex < 0 || startIndex >= targetIndices.length ||
          endIndex < 0 || endIndex >= targetIndices.length) {
        console.error('Invalid reorder indices for recent clips:', { startIndex, endIndex, length: targetIndices.length });
        return;
      }
      
      // 実際のインデックスを取得
      const actualStartIndex = targetIndices[startIndex];
      const actualEndIndex = targetIndices[endIndex];
      
      // クリップを移動
      const [movedClip] = deck.clips.splice(actualStartIndex, 1);
      
      // ターゲットインデックスを調整（元の開始インデックスが終了インデックスより小さい場合、削除によりインデックスがずれる）
      let adjustedEndIndex = actualEndIndex;
      if (actualStartIndex < actualEndIndex) {
        adjustedEndIndex -= 1;
      }
      
      deck.clips.splice(adjustedEndIndex, 0, movedClip);
      
      // 該当タイプの未ピン留めクリップのorderのみ更新
      let order = 0;
      deck.clips.forEach((clip) => {
        if (clip.type === clipType && !clip.pinned) {
          clip.order = order++;
        }
      });
      
      await this.storageService.saveDeck(deck);
      console.log(`Reordered recent clips of type ${clipType}: moved from ${startIndex} to ${endIndex}`);
    } catch (error) {
      console.error('Failed to reorder recent clips:', error);
      vscode.window.showErrorMessage(`Failed to reorder clips: ${error}`);
    }
  }

  private async _jumpToCell(notebookUri: string, cellId: string): Promise<void> {
    try {
      const uri = vscode.Uri.parse(notebookUri);
      const document = await vscode.workspace.openTextDocument(uri);
      if (document.languageId === 'python' &&
          (document.getText().includes('import marimo') || document.getText().includes('from marimo'))) {
        const marimoAdapter = new MarimoAdapter();
        await marimoAdapter.jumpToCell(notebookUri, cellId);
      } else {
        const notebookAdapter = new NotebookAdapter();
        await notebookAdapter.jumpToCell(notebookUri, cellId);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to jump to cell: ${error}`);
    }
  }
}
