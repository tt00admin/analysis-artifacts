import * as vscode from 'vscode';
import * as path from 'path';
import { SidebarProvider } from './sidebar/sidebarProvider.js';
import { StorageService } from './storage/storageService.js';
import { ClipboardService } from './clipboard/clipboardService.js';
import { MarkdownGenerator } from './export/markdownGenerator.js';

export function activate(context: vscode.ExtensionContext) {
  console.log('DataDeck extension activating...');
  
  try {
    // サービス初期化
    const storageService = new StorageService(context);
    const clipboardService = new ClipboardService(context, storageService);
    const sidebarProvider = new SidebarProvider(context.extensionUri, storageService, clipboardService);

    // .gitignore推奨設定のチェック
    checkGitignoreRecommendation();

    // WebviewProvider登録
    const disposable = vscode.window.registerWebviewViewProvider('datadeck.sidebar', sidebarProvider);
    context.subscriptions.push(disposable);
    console.log('DataDeck: WebviewViewProvider registered successfully');

    // コマンド登録
    const clipOutputCommand = vscode.commands.registerCommand('datadeck.clipOutput', async (cell?: vscode.NotebookCell) => {
      await clipboardService.clipActiveCell(cell);
      await sidebarProvider.refreshDeck();
    });

    const exportMarkdownCommand = vscode.commands.registerCommand('datadeck.exportMarkdown', async () => {
      try {
        const deck = await storageService.loadDeck();
        if (deck.clips.length === 0) {
          vscode.window.showInformationMessage('エクスポートするクリップがありません');
          return;
        }
        const outputUri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file('datadeck-export.md'),
          filters: { 'Markdown': ['md'] }
        });
        if (outputUri) {
          await MarkdownGenerator.generateMarkdown(deck.clips, outputUri.fsPath);
          vscode.window.showInformationMessage(`Markdownをエクスポートしました: ${outputUri.fsPath}`);
        }
      } catch (error) {
        vscode.window.showErrorMessage(`エクスポートに失敗しました: ${error}`);
      }
    });

    const clearDeckCommand = vscode.commands.registerCommand('datadeck.clearDeck', async () => {
      const deck = await storageService.loadDeck();
      deck.clips = [];
      await storageService.saveDeck(deck);
      vscode.window.showInformationMessage('すべてのクリップを削除しました');
    });

    context.subscriptions.push(clipOutputCommand, exportMarkdownCommand, clearDeckCommand);
    
  } catch (error) {
    console.error('DataDeck activation error:', error);
    throw error;
  }
}

async function checkGitignoreRecommendation() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return;
  }

  const rootUri = workspaceFolders[0].uri;
  const gitignoreUri = vscode.Uri.joinPath(rootUri, '.gitignore');

  try {
    // .gitignoreの存在チェック
    const gitignoreExists = await vscode.workspace.fs.stat(gitignoreUri).then(() => true, () => false);
    let gitignoreContent = '';

    if (gitignoreExists) {
      const data = await vscode.workspace.fs.readFile(gitignoreUri);
      gitignoreContent = Buffer.from(data).toString('utf8');
    }

    // .vscode/datadeck/が含まれているかチェック
    if (!gitignoreContent.includes('.vscode/datadeck/')) {
      const action = await vscode.window.showInformationMessage(
        'DataDeckの保存データをGitから除外するため、.gitignoreに「.vscode/datadeck/」を追加することを推奨します。',
        '今すぐ追加',
        '後で'
      );

      if (action === '今すぐ追加') {
        const newLine = '.vscode/datadeck/\n';
        const newContent = gitignoreExists ? gitignoreContent + newLine : newLine;
        await vscode.workspace.fs.writeFile(gitignoreUri, Buffer.from(newContent, 'utf8'));
        vscode.window.showInformationMessage('.gitignoreを更新しました。');
      }
    }
  } catch (error) {
    // エラーは無視（ファイルアクセス権限等）
  }
}

export function deactivate() {}
