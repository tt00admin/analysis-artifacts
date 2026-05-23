import * as vscode from 'vscode';

export interface INotebookAdapter {
  getActiveCell(): vscode.NotebookCell | undefined;
  getCellOutput(cell: vscode.NotebookCell): vscode.NotebookCellOutput | undefined;
  getCellCode(cell: vscode.NotebookCell): string | undefined;
  jumpToCell(notebookUri: string, cellId?: string, cellIndex?: number, codeHash?: string): Promise<void>;
}

export class NotebookAdapter implements INotebookAdapter {
  getActiveCell(): vscode.NotebookCell | undefined {
    const activeEditor = vscode.window.activeNotebookEditor;
    if (!activeEditor) {
      return undefined;
    }
    const selection = activeEditor.selections[0];
    if (!selection) {
      return undefined;
    }
     return activeEditor.notebook.cellAt(selection.start);
  }

  getCellOutput(cell: vscode.NotebookCell): vscode.NotebookCellOutput | undefined {
    const outputs = cell.outputs;
    if (!outputs || outputs.length === 0) {
      return undefined;
    }
    return outputs[outputs.length - 1];
  }

  getCellCode(cell: vscode.NotebookCell): string | undefined {
    return cell.document?.getText();
  }

  canClipActiveCell(): { canClip: boolean; reason?: string } {
    const activeCell = this.getActiveCell();
    if (!activeCell) {
      return { canClip: false, reason: 'Select a notebook cell to add a clip.' };
    }
    if (!activeCell.outputs || activeCell.outputs.length === 0) {
      return { canClip: false, reason: 'The selected notebook cell has no output.' };
    }
    return { canClip: true };
  }

  async jumpToCell(notebookUri: string, cellId?: string, cellIndex?: number, codeHash?: string): Promise<void> {
    try {
      const uri = vscode.Uri.parse(notebookUri);
      const document = await vscode.workspace.openNotebookDocument(uri);
      const editor = await vscode.window.showNotebookDocument(document);

      const cells = document.getCells();
      let targetIndex = cellId ? cells.findIndex(cell => cell.document.uri.toString() === cellId) : -1;
      if (targetIndex < 0 && typeof cellIndex === 'number' && cellIndex >= 0 && cellIndex < cells.length) {
        targetIndex = cellIndex;
      }
      if (targetIndex < 0 && codeHash) {
        targetIndex = cells.findIndex((cell) => this.hashCode(cell.document.getText()) === codeHash);
      }

      if (targetIndex >= 0) {
        const range = new vscode.NotebookRange(targetIndex, targetIndex);
        // Use type assertion for revealRange which is part of NotebookEditor interface
        // but may not be in all vscode API versions
        const editorImpl = editor as vscode.NotebookEditor & { revealRange?(range: vscode.NotebookRange, revealType?: number): void };
        if (editorImpl.revealRange) {
          editorImpl.revealRange(range, vscode.NotebookEditorRevealType.InCenter);
        }
      } else {
        vscode.window.showWarningMessage('DataDeck could not find the original notebook cell.');
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to jump to cell: ${error}`);
    }
  }

  private hashCode(value: string): string {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
    }
    return Math.abs(hash).toString(16);
  }
}
