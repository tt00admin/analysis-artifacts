import * as vscode from 'vscode';
import { INotebookAdapter } from './notebookAdapter.js';

/**
 * Marimoファイル用のNotebookAdapter実装
 * marimoはPythonファイルとして扱われるため、標準のNotebookAdapterとは異なります
 */
export class MarimoAdapter implements INotebookAdapter {
  getActiveCell(): vscode.NotebookCell | undefined {
    // marimoはPythonファイルとして扱われるため、アクティブなエディタから取得
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      return undefined;
    }

    const document = activeEditor.document;
    if (document.languageId !== 'python') {
      return undefined;
    }

    // marimoファイルかどうかを確認（簡易チェック）
    const text = document.getText();
    if (!text.includes('import marimo') && !text.includes('from marimo')) {
      return undefined;
    }

    // 現在の選択範囲またはカーソル位置の行を取得
    const selection = activeEditor.selection;
    const line = selection.active.line;

    // 簡易的に現在の行を含む「セル」を特定
    // 実際のmarimo統合では、marimoのAST解析が必要ですが、ここではファイル全体を1セルとして扱います
    return this.createMockCell(document, line);
  }

  getCellOutput(_cell: vscode.NotebookCell): vscode.NotebookCellOutput | undefined {
    // marimoの場合、出力は別途取得する必要がある
    // 現在は未実装
    return undefined;
  }

  getCellCode(cell: vscode.NotebookCell): string | undefined {
    return cell.document?.getText();
  }

  async jumpToCell(notebookUri: string, _cellId: string): Promise<void> {
    try {
      const uri = vscode.Uri.parse(notebookUri);
      const document = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(document);

      // marimoのセルIDに基づいて該当箇所にジャンプ
      // 実際の実装では、marimoのセル定義を解析して該当行に移動
      vscode.window.showInformationMessage('Marimo adapter: Jump to cell not fully implemented yet');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to jump to marimo cell: ${error}`);
    }
  }

  private createMockCell(document: vscode.TextDocument, _line: number): vscode.NotebookCell {
    // marimoは標準のNotebookCellを提供しないため、モックオブジェクトを作成
    // これはmarimoファイル内での作業時に限る
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockNotebook: any = {
      uri: document.uri,
      notebookType: 'marimo',
      version: '1.0.0',
      isDirty: false,
      isUntitled: false,
      metadata: {},
      cells: [],
      getCells: () => [],
      cellAt: () => this.createMinimalCell(document, 0),
      appendCell: () => this.createMinimalCell(document, 0),
      deleteCell: () => {},
      insertCell: () => this.createMinimalCell(document, 0),
      moveCell: () => {},
    };

    return {
      document,
      notebook: mockNotebook,
      index: 0,
      kind: vscode.NotebookCellKind.Code,
      outputs: [],
      executionSummary: undefined,
      metadata: {}
    };
  }

  private createMinimalCell(document: vscode.TextDocument, index: number): vscode.NotebookCell {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockNotebook: any = {
      uri: document.uri,
    };
    return {
      document,
      notebook: mockNotebook,
      index,
      kind: vscode.NotebookCellKind.Code,
      outputs: [],
      executionSummary: undefined,
      metadata: {}
    };
  }
}