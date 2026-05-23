import * as vscode from 'vscode';
import { Clip } from '../types/index.js';
import { StorageService } from '../storage/storageService.js';

/**
 * Webview関連のヘルパーメソッド
 */
export class WebviewHelpers {
  constructor(private storageService: StorageService) {}

  /**
   * クリップをWebview用にURI変換
   */
  convertClipsForWebview(clips: Clip[], webview: vscode.Webview): Clip[] {
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

  /**
   * WebviewのHTMLを取得
   */
  getHtmlForWebview(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'out', 'webview', 'assets', 'main.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'out', 'webview', 'assets', 'main.css')
    );
    const codiconsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'out', 'webview', 'codicon.css')
    );

    const nonce = generateNonce();
    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource}; img-src ${webview.cspSource} https: data:; script-src 'nonce-${nonce}' ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline';">
        <link href="${codiconsUri}" rel="stylesheet">
        <link href="${styleUri}" rel="stylesheet">
        <title>Analysis-Artifacts</title>
      </head>
      <body>
        <div id="root"></div>
        <script nonce="${nonce}" src="${scriptUri}"></script>
      </body>
      </html>`;
  }
}

/**
 * nonce生成
 */
function generateNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}