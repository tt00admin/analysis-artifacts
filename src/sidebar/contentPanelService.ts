import * as vscode from 'vscode';
import { Clip } from '../types/index.js';
import { escapeHtml } from '../utils/htmlEscape.js';
import { sanitizeHtml } from '../utils/htmlSanitizer.js';
import { StorageService } from '../storage/storageService.js';

/**
 * コンテンツプレビュー用Webviewパネル管理
 */
export class ContentPanelService {
  constructor(private storageService: StorageService) {}

  /**
   * クリップの種類に応じて適切なパネルを開く
   */
  async openClip(clip: Clip): Promise<void> {
    if (!clip) {
      console.log('Expand: No clip provided for expansion');
      return;
    }
    console.log(`Expand: Attempting to open clip ${clip.id} (type: ${clip.type}, title: ${clip.title || 'untitled'})`);
    
    switch (clip.type) {
      case 'image':
        console.log('Expand: Opening image clip');
        await this.openImagePanel(clip);
        break;
      case 'html':
        console.log('Expand: Opening HTML clip');
        await this.openHtmlPanel(clip);
        break;
      case 'dataframe':
      case 'text':
        console.log('Expand: Opening text/dataframe clip');
        await this.openTextPanel(clip);
        break;
      default:
        const errorMsg = `Unsupported clip type for expansion: ${clip.type}`;
        console.error(errorMsg);
        vscode.window.showErrorMessage(errorMsg);
    }
  }

  /**
   * 画像プレビューを新しいウィンドウで開く
   */
  async openImagePanel(clip: Clip): Promise<void> {
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

    panel.webview.html = this.getImageHtml(clip, panel.webview, imageUri);
  }

  /**
   * HTMLプレビューを開く
   */
  async openHtmlPanel(clip: Clip): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      'clipPreview',
      clip.title || 'HTML Preview',
      vscode.ViewColumn.Beside,
      {
        enableScripts: false,
        retainContextWhenHidden: true,
      }
    );

    panel.webview.html = this.getHtmlContentHtml(clip);
  }

  /**
   * テキスト/データフレームプレビューを開く
   */
  async openTextPanel(clip: Clip): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      'clipPreview',
      clip.title || 'Text Preview',
      vscode.ViewColumn.Beside,
      {
        enableScripts: false,
        retainContextWhenHidden: true
      }
    );

    panel.webview.html = this.getTextContentHtml(clip);
  }

  private getImageHtml(clip: Clip, webview: vscode.Webview, imageUri: vscode.Uri): string {
    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; style-src 'unsafe-inline';">
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
          <img src="${webview.asWebviewUri(imageUri)}" alt="${escapeHtml(clip.title || 'Image')}">
        </div>
      </body>
      </html>`;
  }

  private getHtmlContentHtml(clip: Clip): string {
    const safeHtml = sanitizeHtml(clip.content.htmlContent || '');
    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:;">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${escapeHtml(clip.title || 'HTML Preview')}</title>
        <style>
          body { margin: 0; padding: 16px; background-color: #1e1e1e; color: #d4d4d4; }
          .content { max-width: 100%; overflow: auto; }
        </style>
      </head>
      <body>
        <div class="content">${safeHtml}</div>
      </body>
      </html>`;
  }

  private getTextContentHtml(clip: Clip): string {
    const content = clip.content.textContent || clip.content.htmlContent || 'No content';
    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
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
      </html>`;
  }
}
