import * as vscode from 'vscode';
import * as path from 'path';
import { SidebarProvider } from './sidebar/sidebarProvider.js';
import { StorageService } from './storage/storageService.js';
import { ClipboardService } from './clipboard/clipboardService.js';
import { MarkdownGenerator } from './export/markdownGenerator.js';

export function activate(context: vscode.ExtensionContext) {
  console.log('Analysis-Artifacts extension activating...');
  
  try {
    const storageService = new StorageService(context);
    const clipboardService = new ClipboardService(context, storageService);
    const sidebarProvider = new SidebarProvider(context.extensionUri, storageService, clipboardService);

    checkGitignoreRecommendation();

    const disposable = vscode.window.registerWebviewViewProvider('analysis-artifacts.sidebar', sidebarProvider);
    context.subscriptions.push(disposable);
    console.log('Analysis-Artifacts: WebviewViewProvider registered successfully');

    const clipOutputCommand = vscode.commands.registerCommand('analysis-artifacts.clipOutput', async (cell?: vscode.NotebookCell) => {
      await clipboardService.clipActiveCell(cell);
      await sidebarProvider.refreshDeck();
    });

    const exportMarkdownCommand = vscode.commands.registerCommand('analysis-artifacts.exportMarkdown', async () => {
      try {
        const deck = await storageService.loadDeck();
        if (deck.clips.length === 0) {
          vscode.window.showInformationMessage('There are no clips to export.');
          return;
        }
        const outputUri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file('analysis-artifacts-export.md'),
          filters: { 'Markdown': ['md'] }
        });
        if (outputUri) {
          await MarkdownGenerator.generateMarkdown(deck.clips, outputUri.fsPath, {
            copyImageAssets: true,
            resolveImagePath: (imagePath) => storageService.getImageFsPath(imagePath)
          });
          vscode.window.showInformationMessage(`Markdown exported: ${outputUri.fsPath}`);
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Export failed: ${error}`);
      }
    });

    const clearDeckCommand = vscode.commands.registerCommand('analysis-artifacts.clearDeck', async () => {
      const confirm = await vscode.window.showWarningMessage(
        'Delete all Analysis-Artifacts clips and stored image assets? This action cannot be undone.',
        { modal: true },
        'Delete'
      );
      if (confirm !== 'Delete') {
        return;
      }
      await storageService.clearDeck(true);
      await sidebarProvider.refreshDeck();
      vscode.window.showInformationMessage('All clips were deleted.');
    });

    context.subscriptions.push(clipOutputCommand, exportMarkdownCommand, clearDeckCommand);
    
  } catch (error) {
    console.error('Analysis-Artifacts activation error:', error);
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
    const gitignoreExists = await vscode.workspace.fs.stat(gitignoreUri).then(() => true, () => false);
    let gitignoreContent = '';

    if (gitignoreExists) {
      const data = await vscode.workspace.fs.readFile(gitignoreUri);
      gitignoreContent = Buffer.from(data).toString('utf8');
    }

    if (!gitignoreContent.includes('.vscode/analysis-artifacts/')) {
      const action = await vscode.window.showInformationMessage(
        'Add ".vscode/analysis-artifacts/" to .gitignore so saved Analysis-Artifacts data is not committed?',
        'Add Now',
        'Later'
      );

      if (action === 'Add Now') {
        const newLine = '.vscode/analysis-artifacts/\n';
        const newContent = gitignoreExists ? gitignoreContent + newLine : newLine;
        await vscode.workspace.fs.writeFile(gitignoreUri, Buffer.from(newContent, 'utf8'));
        vscode.window.showInformationMessage('.gitignore was updated.');
      }
    }
  } catch (error) {
    // Ignore workspace file access issues.
  }
}

export function deactivate() {}
