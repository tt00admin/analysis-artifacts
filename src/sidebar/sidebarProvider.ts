import { escapeHtml } from '../utils/htmlEscape.js';
import * as vscode from 'vscode';
import { StorageService } from '../storage/storageService.js';
import { ClipboardService } from '../clipboard/clipboardService.js';
import { NotebookAdapter } from '../notebook/notebookAdapter.js';
import { MarimoAdapter } from '../notebook/marimoAdapter.js';
import { SearchService } from '../search/searchService.js';
import { DnDService } from '../sidebar/components/dndService.js';
import { MarkdownGenerator } from '../export/markdownGenerator.js';
import { Clip, SearchFilters } from '../types/index.js';

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

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly storageService: StorageService,
    private readonly clipboardService: ClipboardService
  ) {}

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

      const html = this._getHtmlForWebview(webviewView.webview);
      console.log('DataDeck: Webview HTML generated, length:', html.length);
      webviewView.webview.html = html;
      console.log('DataDeck: Webview HTML set successfully');

      webviewView.webview.onDidReceiveMessage(async (message) => {
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
            await this._deleteClip(message.clipId);
            break;
          case 'togglePin':
            await this._togglePin(message.clipId);
            this._refreshDeck();
            break;
          case 'jumpToCell':
            await this._jumpToCell(message.notebookUri, message.cellId);
            break;
          case 'reorderClips':
            await this._reorderClips(message.startIndex, message.endIndex);
            this._refreshDeck();
            break;
          case 'openImage':
            await this._openImageInNewWindow(message.clip);
            break;
          case 'openClip':
            await this._openClip(message.clip);
            break;
          case 'reorderRecentClips':
            await this._reorderRecentClips(message.clipType, message.startIndex, message.endIndex);
            this._refreshDeck();
            break;
          case 'updateClip':
            await this._updateClip(message.clipId, message.updates);
            this._refreshDeck();
            break;
        }
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

  private async _sendDeck() {
    if (!this._view) {
      return;
    }
    const deck = await this.storageService.loadDeck();
    const webview = this._view.webview;
    const convertedClips = this._convertClipsForWebview(deck.clips, webview);
    const convertedDeck = { ...deck, clips: convertedClips };
    this._view.webview.postMessage({ type: 'deckUpdate', deck: convertedDeck });
  }

  private async _sendFilteredDeck(message: WebviewMessage) {
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
    const filteredClips = SearchService.searchClips(deck.clips, message.query || '', filters);

    const webview = this._view.webview;
    const convertedClips = this._convertClipsForWebview(filteredClips, webview);
    const convertedDeck = { ...deck, clips: convertedClips };
    this._view.webview.postMessage({ type: 'deckUpdate', deck: convertedDeck });
  }

  private _convertClipsForWebview(clips: Clip[], webview: vscode.Webview): Clip[] {
    return clips.map((clip: Clip) => {
      if (clip.type === 'image' && clip.content.imagePath) {
        try {
          const fileUri = this.storageService.getImageUri(clip.content.imagePath);
          const webviewUri = webview.asWebviewUri(fileUri);
          return {
            ...clip,
            content: { ...clip.content, imageWebviewUri: webviewUri.toString() }
          };
        } catch {
          return clip;
        }
      }
      return clip;
    });
  }

  private async _exportMarkdown() {
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

  private async _deleteClip(clipId: string) {
    const deck = await this.storageService.loadDeck();
    const clip = deck.clips.find((c: Clip) => c.id === clipId);
    if (clip) {
      await this.storageService.deleteClip(clip);
    }
    this._refreshDeck();
  }

  private async _refreshDeck() {
    await this._sendDeck();
  }

  private async _togglePin(clipId: string) {
    const deck = await this.storageService.loadDeck();
    const clip = deck.clips.find((c: Clip) => c.id === clipId);
    if (clip) {
      clip.pinned = !clip.pinned;
      await this.storageService.saveDeck(deck);
    }
  }

  private async _updateClip(clipId: string, updates: { title?: string; memo?: string; tags?: string[] }) {
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

  private async _reorderClips(startIndex: number, endIndex: number) {
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

  private async _reorderRecentClips(clipType: string, startIndex: number, endIndex: number) {
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
    return Promise.resolve();
  }

  private async _openImageInNewWindow(clip: Clip) {
    if (!clip || clip.type !== 'image' || !clip.content.imagePath) {
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'imagePreview',
      clip.title || 'Image Preview',
      vscode.ViewColumn.Beside,
      {
        enableScripts: false,
        retainContextWhenHidden: true,
        localResourceRoots: [
          this.storageService.getStorageUri(),
          this._extensionUri
        ]
      }
    );

    let imageUri: vscode.Uri;
    try {
      imageUri = this.storageService.getImageUri(clip.content.imagePath);
    } catch (error) {
      console.error('Failed to get image URI:', error);
      imageUri = vscode.Uri.parse(clip.content.imagePath);
    }

    panel.webview.html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${escapeHtml(clip.title || 'Image Preview')}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            background-color: #1e1e1e;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            overflow: hidden;
          }
          .image-container {
            max-width: 100%;
            max-height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
          }
          img {
            max-width: 100%;
            max-height: 100vh;
            object-fit: contain;
            border-radius: 4px;
          }
        </style>
      </head>
      <body>
        <div class="image-container">
          <img src="${panel.webview.asWebviewUri(imageUri)}" alt="${escapeHtml(clip.title || 'Image')}">
        </div>
      </body>
      </html>
    `;

    panel.onDidDispose(() => {
      // Cleanup if needed
    });
  }

  private async _openClip(clip: Clip) {
    if (!clip) {
      console.log('Expand: No clip provided for expansion');
      return;
    }
    console.log(`Expand: Attempting to open clip ${clip.id} (type: ${clip.type}, title: ${clip.title || 'untitled'})`);
    switch (clip.type) {
      case 'image':
        console.log('Expand: Opening image clip');
        await this._openImageInNewWindow(clip);
        break;
      case 'html':
        console.log('Expand: Opening HTML clip');
        await this._openHtmlClip(clip);
        break;
      case 'dataframe':
      case 'text':
        console.log('Expand: Opening text/dataframe clip');
        await this._openTextClip(clip);
        break;
      default:
        const errorMsg = `Unsupported clip type for expansion: ${clip.type}`;
        console.error(errorMsg);
        vscode.window.showErrorMessage(errorMsg);
    }
  }

  private async _openHtmlClip(clip: Clip) {
    const panel = vscode.window.createWebviewPanel(
      'clipPreview',
      clip.title || 'HTML Preview',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this._extensionUri]
      }
    );

    panel.webview.html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${escapeHtml(clip.title || 'HTML Preview')}</title>
        <style>
          body { margin: 0; padding: 16px; background-color: #1e1e1e; color: #d4d4d4; }
          .content { max-width: 100%; overflow: auto; }
        </style>
      </head>
      <body>
        <div class="content">${clip.content.htmlContent || ''}</div>
      </body>
      </html>
    `;
  }

  private async _openTextClip(clip: Clip) {
    const panel = vscode.window.createWebviewPanel(
      'clipPreview',
      clip.title || 'Text Preview',
      vscode.ViewColumn.Beside,
      {
        enableScripts: false,
        retainContextWhenHidden: true
      }
    );

    const content = clip.content.textContent || clip.content.htmlContent || 'No content';
    panel.webview.html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${escapeHtml(clip.title || 'Text Preview')}</title>
        <style>
          body { margin: 0; padding: 16px; background-color: #1e1e1e; color: #d4d4d4; font-family: monospace; }
          pre { white-space: pre-wrap; word-wrap: break-word; }
        </style>
      </head>
      <body>
        <pre>${escapeHtml(content)}</pre>
      </body>
      </html>
    `;
  }


  private _getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'assets', 'main.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'assets', 'main.css')
    );
    const codiconsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'codicon.css')
    );

    const nonce = getNonce();
    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource}; img-src ${webview.cspSource} https: data:; script-src 'nonce-${nonce}' ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline';">
        <link href="${codiconsUri}" rel="stylesheet">
        <link href="${styleUri}" rel="stylesheet">
        <title>DataDeck</title>
      </head>
      <body>
        <div id="root"></div>
        <script nonce="${nonce}" src="${scriptUri}"></script>
      </body>
      </html>`;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
