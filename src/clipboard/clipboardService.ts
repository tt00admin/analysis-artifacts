import * as vscode from 'vscode';
import { StorageService } from '../storage/storageService.js';
import { Clip } from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';
import { NotebookAdapter } from '../notebook/notebookAdapter.js';
import { INotebookAdapter } from '../notebook/notebookAdapter.js';
import { MimeTypeDetector } from './mimeTypeDetector.js';
import { ImageAnalyzer } from './imageAnalyzer.js';
import { HtmlGenerator } from './htmlGenerator.js';

export class ClipboardService {
  private notebookAdapter: INotebookAdapter;
  private mimeTypeDetector: MimeTypeDetector;
  private imageAnalyzer: ImageAnalyzer;
  private htmlGenerator: HtmlGenerator;

  constructor(
    private context: vscode.ExtensionContext,
    private storageService: StorageService
  ) {
    this.notebookAdapter = new NotebookAdapter();
    this.mimeTypeDetector = new MimeTypeDetector();
    this.imageAnalyzer = new ImageAnalyzer();
    this.htmlGenerator = new HtmlGenerator();
  }

  async clipActiveCell(cell?: vscode.NotebookCell, options: { pinned?: boolean } = {}): Promise<string | undefined> {
    // まず標準のノートブックエディタをチェック
    let activeCell = cell ?? this.notebookAdapter.getActiveCell();
    let activeAdapter: INotebookAdapter = this.notebookAdapter;

    if (!activeCell) {
      vscode.window.showErrorMessage('No active notebook cell found. Please select a cell in a Jupyter notebook.');
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
    clip.source.cellIndex = activeCell.index;
    clip.source.codeHash = clip.codeSnippet ? this.hashCode(clip.codeSnippet) : undefined;

    clip.title = '';
    clip.memo = '';
    clip.tags = [];
    clip.pinned = Boolean(options.pinned);
    if (clip.pinned) {
      clip.order = 0;
    }

    await this.storageService.updateDeck((deck) => {
      deck.clips.push(clip);
    });

    vscode.window.showInformationMessage(`Clip saved: ${clip.id.slice(0, 8)}. Use Edit in Analysis-Artifacts to add a title, memo, or tags.`);
    return clip.id;
  }

  private async captureOutput(cell: vscode.NotebookCell, adapter: INotebookAdapter): Promise<Clip | undefined> {
    // Notebook APIから出力を取得
    const adapterOutput = adapter.getCellOutput(cell);
    
    // 標準 Notebook では stdout と display_data が別 output になるため、全 output を評価する。
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

    const candidates: Array<{ mimeType: string; data: Uint8Array; outputIndex: number; itemIndex: number }> = [];
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
        const priority = this.mimeTypeDetector.getPriority(item.mime, data);
        if (priority > 0) {
          candidates.push({ mimeType: item.mime, data, outputIndex, itemIndex });
        }
      }
    }

    const selected = this.mimeTypeDetector.selectBestCandidate(candidates);

    if (!selected) {
      return undefined;
    }

    const mimeType = selected.mimeType;
    const data = selected.data;

    if (mimeType.startsWith('image/')) {
      clip.type = 'image';
      const base64 = Buffer.from(data).toString('base64');
      const ext = this.imageAnalyzer.getExtension(mimeType);
      const filename = `${clipId}.${ext}`;
      const imagePath = await this.storageService.saveImage(base64, filename);
      clip.content = { imagePath, mimeType };
      const dimensions = this.imageAnalyzer.getDimensions(data);
      const fileSize = await this.storageService.getFileSize(imagePath);
      if (fileSize !== undefined) {
        clip.metadata = { ...clip.metadata, fileSize };
      }
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
      clip.content = { htmlContent: this.htmlGenerator.dataResourceToHtml(json), mimeType };
      console.log('Captured data resource table');
    } else if (mimeType === 'application/vnd.dataframe+json') {
      clip.type = 'dataframe';
      clip.content = { textContent: this.htmlGenerator.prettyJson(data), mimeType };
      console.log('Captured DataFrame');
    } else if (mimeType === 'application/json') {
      clip.type = 'text';
      clip.content = { textContent: this.htmlGenerator.prettyJson(data), mimeType };
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

  private associateCode(cell: vscode.NotebookCell): string | undefined {
    return cell.document?.getText();
  }

  private hashCode(value: string): string {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
    }
    return Math.abs(hash).toString(16);
  }
}
