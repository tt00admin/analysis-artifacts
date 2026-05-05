import * as vscode from 'vscode';
import { StorageService } from '../storage/storageService.js';
import { Clip } from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';
import { NotebookAdapter } from '../notebook/notebookAdapter.js';
import { MarimoAdapter } from '../notebook/marimoAdapter.js';
import { INotebookAdapter } from '../notebook/notebookAdapter.js';
import { escapeHtml } from '../utils/htmlEscape.js';

export class ClipboardService {
  private notebookAdapter: INotebookAdapter;
  private marimoAdapter: INotebookAdapter;

  constructor(
    private context: vscode.ExtensionContext,
    private storageService: StorageService
  ) {
    this.notebookAdapter = new NotebookAdapter();
    this.marimoAdapter = new MarimoAdapter();
  }

  async clipActiveCell(cell?: vscode.NotebookCell): Promise<string | undefined> {
    // まず標準のノートブックエディタをチェック
    let activeCell = cell ?? this.notebookAdapter.getActiveCell();
    let activeAdapter: INotebookAdapter = this.notebookAdapter;

    // 標準ノートブックでない場合、marimoをチェック
    if (!cell && !activeCell) {
      activeCell = this.marimoAdapter.getActiveCell();
      activeAdapter = this.marimoAdapter;
    }

    if (!activeCell) {
      vscode.window.showErrorMessage('No active notebook cell found. Please select a cell in a notebook or marimo file.');
      return;
    }

    const clip = await this.captureOutput(activeCell, activeAdapter);
    if (!clip) {
      // デバッグ情報を収集
      const outputs = activeCell.outputs;
      const mimeTypes: string[] = [];
      const dataTypes: string[] = [];
      if (outputs) {
        for (const output of outputs) {
          for (const item of output.items) {
            mimeTypes.push(item.mime);
            dataTypes.push(typeof item.data);
          }
        }
      }
      const errorMsg = `Failed to capture cell output.\nMIME types: ${mimeTypes.join(', ') || 'none'}\nData types: ${dataTypes.join(', ') || 'none'}\nCheck Developer Tools Console for details.`;
      vscode.window.showErrorMessage(errorMsg);
      return;
    }

    clip.codeSnippet = this.associateCode(activeCell);

    // タイトル入力
    const title = await vscode.window.showInputBox({
      prompt: 'クリップのタイトルを入力してください（任意）',
      placeHolder: 'タイトルなし'
    });
    clip.title = title || '';

    // メモ入力
    const memo = await vscode.window.showInputBox({
      prompt: 'クリップのメモを入力してください（任意）',
      placeHolder: 'メモなし'
    });
    clip.memo = memo || '';

    // タグ入力
    const tagsInput = await vscode.window.showInputBox({
      prompt: 'タグをカンマ区切りで入力してください（任意）',
      placeHolder: 'tag1, tag2, tag3'
    });
    clip.tags = tagsInput
      ? tagsInput.split(',').map((t: string) => t.trim()).filter((t: string) => t)
      : [];

    const deck = await this.storageService.loadDeck();
    deck.clips.push(clip);
    await this.storageService.saveDeck(deck);

    vscode.window.showInformationMessage(`Clip saved: ${clip.id.slice(0, 8)}`);
    return clip.id;
  }

  private async captureOutput(cell: vscode.NotebookCell, adapter: INotebookAdapter): Promise<Clip | undefined> {
    // アダプターを使用して出力を取得（marimo等の特殊なケースに対応）
    const adapterOutput = adapter.getCellOutput(cell);
    
    // 標準 Notebook では stdout と display_data が別 output になるため、全 output を評価する。
    // marimo 等で adapter からしか取得できない場合は adapter の output を fallback とする。
    const outputs = cell.outputs && cell.outputs.length > 0
      ? [...cell.outputs]
      : adapterOutput
        ? [adapterOutput]
        : [];
    
    if (outputs.length === 0) {
      return;
    }

    const clipId = uuidv4();
    const timestamp = Date.now();

    const clip: Partial<Clip> = {
      id: clipId,
      timestamp,
      source: {
        notebookUri: cell.notebook.uri.toString(),
        cellId: cell.document?.uri.toString(),
        executionCount: cell.executionSummary?.executionOrder
      },
      pinned: false,
      order: timestamp,
      tags: [],
      metadata: {}
    };

    // デバッグ用: 全出力のMIMEタイプを収集
    const allMimeTypes: string[] = [];
    for (const output of outputs) {
      for (const item of output.items) {
        allMimeTypes.push(item.mime);
      }
    }
    console.log(`All cell outputs MIME types: ${allMimeTypes.join(', ')}`);
    console.log(`Number of outputs: ${outputs.length}`);

    const candidates: Array<{ mimeType: string; data: Uint8Array; priority: number; outputIndex: number; itemIndex: number }> = [];
    for (const [outputIndex, output] of outputs.entries()) {
      if (!output.items || output.items.length === 0) {
        continue;
      }
      for (const [itemIndex, item] of output.items.entries()) {
        const data = this.normalizeOutputData(item);
        if (!data) {
          console.log(`MIME type ${item.mime}: unsupported or empty data`);
          continue;
        }
        const priority = this.getMimePriority(item.mime, data);
        if (priority > 0) {
          candidates.push({ mimeType: item.mime, data, priority, outputIndex, itemIndex });
        }
      }
    }

    const selected = candidates.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      if (b.outputIndex !== a.outputIndex) {
        return b.outputIndex - a.outputIndex;
      }
      return b.itemIndex - a.itemIndex;
    })[0];

    if (!selected) {
      return undefined;
    }

    const mimeType = selected.mimeType;
    const data = selected.data;

    if (mimeType.startsWith('image/')) {
      clip.type = 'image';
      const base64 = Buffer.from(data).toString('base64');
      const ext = mimeType.split('/')[1] || 'png';
      const filename = `${clipId}.${ext}`;
      const imagePath = await this.storageService.saveImage(base64, filename);
      clip.content = { imagePath, mimeType };
      const dimensions = this.getImageDimensions(data);
      if (dimensions) {
        clip.metadata = { ...clip.metadata, dimensions };
      }
      console.log(`Captured image: ${mimeType}`);
    } else if (mimeType === 'text/html') {
      clip.type = 'html';
      clip.content = { htmlContent: Buffer.from(data).toString('utf-8'), mimeType };
      console.log('Captured HTML');
    } else if (mimeType === 'application/vnd.dataresource+json') {
      clip.type = 'html';
      const json = Buffer.from(data).toString('utf-8');
      clip.content = { htmlContent: this.dataResourceToHtml(json), mimeType };
      console.log('Captured data resource table');
    } else if (mimeType === 'application/vnd.dataframe+json') {
      clip.type = 'dataframe';
      clip.content = { textContent: this.prettyJson(data), mimeType };
      console.log('Captured DataFrame');
    } else if (mimeType === 'application/json') {
      clip.type = 'text';
      clip.content = { textContent: this.prettyJson(data), mimeType };
      console.log(`Captured JSON as text: ${mimeType}`);
    } else {
      clip.type = 'text';
      clip.content = { textContent: Buffer.from(data).toString('utf-8'), mimeType };
      console.log(`Captured text: ${mimeType}`);
    }

    return clip.type ? clip as Clip : undefined;
  }

  private normalizeOutputData(item: vscode.NotebookCellOutputItem): Uint8Array | undefined {
    if (typeof item.data === 'string') {
      return Buffer.from(item.data, 'utf-8');
    }
    if (Buffer.isBuffer(item.data)) {
      return new Uint8Array(item.data);
    }
    if (item.data instanceof Uint8Array) {
      return item.data;
    }
    return undefined;
  }

  private getMimePriority(mimeType: string, data: Uint8Array): number {
    const text = Buffer.from(data).toString('utf-8');
    const isStdoutStderr = mimeType === 'application/vnd.code.notebook.stdout' ||
      mimeType === 'application/vnd.code.notebook.stderr' ||
      mimeType === 'application/x.notebook.stdout' ||
      mimeType === 'application/x.notebook.stderr';

    if (mimeType.startsWith('image/')) {
      return 100;
    }
    if (mimeType === 'text/html') {
      return 90;
    }
    if (mimeType === 'application/vnd.dataresource+json') {
      return 85;
    }
    if (mimeType === 'application/vnd.dataframe+json') {
      return 80;
    }
    if (mimeType === 'application/json') {
      return 50;
    }
    if (mimeType === 'text/plain') {
      return text.trim().length > 0 ? 30 : 0;
    }
    if (mimeType.startsWith('text/')) {
      return text.trim().length > 0 ? 25 : 0;
    }
    if (isStdoutStderr) {
      return text.trim().length > 0 ? 10 : 0;
    }
    return text.trim().length > 0 ? 1 : 0;
  }

  private prettyJson(data: Uint8Array): string {
    const text = Buffer.from(data).toString('utf-8');
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  }

  private dataResourceToHtml(json: string): string {
    try {
      const parsed = JSON.parse(json);
      const fields = parsed.schema?.fields ?? [];
      const rows = Array.isArray(parsed.data) ? parsed.data : [];
      const fieldNames = fields
        .map((field: { name?: string }) => field.name)
        .filter((name: string | undefined): name is string => typeof name === 'string' && name !== 'index');
      const columns: string[] = fieldNames.length > 0
        ? fieldNames
        : Object.keys(rows[0] ?? {}).filter((name) => name !== 'index');

      if (columns.length === 0) {
        return `<pre>${escapeHtml(JSON.stringify(parsed, null, 2))}</pre>`;
      }

      const header = columns.map((column: string) => `<th>${escapeHtml(column)}</th>`).join('');
      const body = rows.map((row: Record<string, unknown>) => {
        const cells = columns.map((column: string) => `<td>${escapeHtml(String(row[column] ?? ''))}</td>`).join('');
        return `<tr>${cells}</tr>`;
      }).join('');

      return `<table class="datadeck-table"><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
    } catch {
      return `<pre>${escapeHtml(json)}</pre>`;
    }
  }


  private associateCode(cell: vscode.NotebookCell): string | undefined {
    return cell.document?.getText();
  }

  private getImageDimensions(imageData: Uint8Array): { width: number; height: number } | undefined {
    try {
      // PNG: bytes 16-23 contain width and height (big-endian)
      if (imageData.length > 24 && imageData[0] === 0x89 && imageData[1] === 0x50 &&
          imageData[2] === 0x4E && imageData[3] === 0x47) {
        const width = (imageData[16] << 24) | (imageData[17] << 16) | (imageData[18] << 8) | imageData[19];
        const height = (imageData[20] << 24) | (imageData[21] << 16) | (imageData[22] << 8) | imageData[23];
        return { width, height };
      }
      // JPEG: Look for SOF0 (0xFFC0) segment
      if (imageData.length > 4 && imageData[0] === 0xFF && imageData[1] === 0xD8) {
        let i = 2;
        while (i < imageData.length - 9) {
          if (imageData[i] === 0xFF && (imageData[i + 1] === 0xC0 || imageData[i + 1] === 0xC2)) {
            const height = (imageData[i + 5] << 8) | imageData[i + 6];
            const width = (imageData[i + 7] << 8) | imageData[i + 8];
            return { width, height };
          }
          const segmentLen = (imageData[i + 2] << 8) | imageData[i + 3];
          i += 2 + segmentLen;
        }
      }
    } catch (e) {
      // Ignore dimension parsing errors
    }
    return undefined;
  }
}
