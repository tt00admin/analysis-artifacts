import * as vscode from 'vscode';

export interface INotebookAdapter {
  getActiveCell(): vscode.NotebookCell | undefined;
  getCellOutput(cell: vscode.NotebookCell): vscode.NotebookCellOutput | undefined;
  getCellCode(cell: vscode.NotebookCell): string | undefined;
  jumpToCell(notebookUri: string, cellId: string): Promise<void>;
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

  async jumpToCell(notebookUri: string, cellId: string): Promise<void> {
    try {
      const uri = vscode.Uri.parse(notebookUri);
      const document = await vscode.workspace.openNotebookDocument(uri);
      const editor = await vscode.window.showNotebookDocument(document);

      // Find and scroll to the cell
      const cellIndex = document.getCells().findIndex(cell => cell.document.uri.toString() === cellId);
      if (cellIndex >= 0) {
        const range = new vscode.NotebookRange(cellIndex, cellIndex);
        // Use type assertion for revealRange which is part of NotebookEditor interface
        // but may not be in all vscode API versions
        const editorImpl = editor as vscode.NotebookEditor & { revealRange?(range: vscode.NotebookRange, revealType?: number): void };
        if (editorImpl.revealRange) {
          editorImpl.revealRange(range, vscode.NotebookEditorRevealType.InCenter);
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to jump to cell: ${error}`);
    }
  }
}