/** クリップタイプ */
export type ClipType = 'image' | 'html' | 'dataframe' | 'text';

/** クリップソース情報 */
export interface ClipSource {
  notebookUri: string;
  cellId?: string;
  cellIndex?: number;
  codeHash?: string;
  executionCount?: number;
}

/** クリップメタデータ */
export interface ClipMetadata {
  fileSize?: number;
  dimensions?: ImageDimensions;
}

/** 画像サイズ */
export interface ImageDimensions {
  width: number;
  height: number;
}

/** クリップコンテンツ */
export interface ClipContent {
  imagePath?: string;
  imageWebviewUri?: string;
  htmlContent?: string;
  textContent?: string;
  mimeType?: string;
}

/** クリップ */
export interface Clip {
  id: string;
  timestamp: number;
  type: ClipType;
  title?: string;
  memo?: string;
  tags: string[];
  source: ClipSource;
  content: ClipContent;
  codeSnippet?: string;
  pinned: boolean;
  order: number;
  metadata: ClipMetadata;
}

/** デッキ設定 */
export interface DeckSettings {
  autoSave: boolean;
  maxClips: number;
  imageQuality: number;
}

/** デッキ */
export interface Deck {
  version: string;
  lastUpdated: number;
  clips: Clip[];
  settings: DeckSettings;
}

/** ノートブックセル */
export interface NotebookCell {
  id: string;
  outputs?: NotebookCellOutput[];
  executionCount?: number;
  document: {
    uri: string;
  };
}

/** ノートブックセル出力 */
export interface NotebookCellOutput {
  items: NotebookCellOutputItem[];
}

/** ノートブックセル出力アイテム */
export interface NotebookCellOutputItem {
  mime: string;
  data: Uint8Array | string;
}

/** Webviewメッセージ型 */
export type WebviewMessageType =
  | 'deckUpdate'
  | 'clipSaved'
  | 'error'
  | 'clipActiveCell'
  | 'requestDeck'
  | 'filterDeck'
  | 'exportMarkdown'
  | 'deleteClip'
  | 'togglePin'
  | 'jumpToCell'
  | 'reorderClips'
  | 'openImage'
  | 'openClip'
  | 'reorderRecentClips'
  | 'updateClip';
// Additional webview message payload keys are defined by individual handlers.

/** Webviewメッセージ */
export interface WebviewMessage {
  type: WebviewMessageType;
  [key: string]: unknown;
}

/** 検索フィルター */
export interface SearchFilters {
  type?: ClipType;
  tags?: string[];
  dateFrom?: number;
  dateTo?: number;
  notebookFileName?: string;
}
