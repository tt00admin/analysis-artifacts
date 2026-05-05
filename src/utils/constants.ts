/**
 * アプリケーション全体の定数定義
 */

/** デッキのバージョン */
export const DECK_VERSION = '1.0.0';

/** デフォルト設定 */
export const DEFAULT_SETTINGS = {
  autoSave: true,
  maxClips: 100,
  imageQuality: 85,
};

/** ストレージパス */
export const STORAGE_DIR = '.vscode/datadeck';
export const CLIPS_FILENAME = 'clips.json';
export const IMAGES_DIR = 'images';

/** クリップタイプの定義 */
export const CLIP_TYPES = ['image', 'html', 'dataframe', 'text'] as const;
export type ClipType = (typeof CLIP_TYPES)[number];

/** MIMEタイプの優先度 */
export const MIME_PRIORITIES = {
  IMAGE: 100,
  HTML: 90,
  DATA_RESOURCE: 85,
  DATAFRAME: 80,
  JSON: 50,
  TEXT_PLAIN: 30,
  TEXT_OTHER: 25,
  STDOUT_STDERR: 10,
  UNKNOWN: 1,
} as const;

/** サポートされているMIMEタイプ */
export const SUPPORTED_MIME_TYPES = {
  IMAGE_PREFIX: 'image/',
  TEXT_HTML: 'text/html',
  APPLICATION_VND_DATARESOURCE: 'application/vnd.dataresource+json',
  APPLICATION_VND_DATAFRAME: 'application/vnd.dataframe+json',
  APPLICATION_JSON: 'application/json',
  TEXT_PLAIN: 'text/plain',
  TEXT_PREFIX: 'text/',
  STDOUT_V1: 'application/vnd.code.notebook.stdout',
  STDERR_V1: 'application/vnd.code.notebook.stderr',
  STDOUT_V2: 'application/x.notebook.stdout',
  STDERR_V2: 'application/x.notebook.stderr',
} as const;

/** ファイル拡張子からMIMEタイプへのマッピング */
export const EXTENSION_TO_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};

/** コマンドID */
export const COMMANDS = {
  CLIP_OUTPUT: 'datadeck.clipOutput',
  EXPORT_MARKDOWN: 'datadeck.exportMarkdown',
  CLEAR_DECK: 'datadeck.clearDeck',
} as const;

/** Webviewメッセージタイプ */
export const MESSAGE_TYPES = {
  DECK_UPDATE: 'deckUpdate',
  CLIP_SAVED: 'clipSaved',
  ERROR: 'error',
  CLIP_ACTIVE_CELL: 'clipActiveCell',
  REQUEST_DECK: 'requestDeck',
  FILTER_DECK: 'filterDeck',
  EXPORT_MARKDOWN: 'exportMarkdown',
  DELETE_CLIP: 'deleteClip',
  TOGGLE_PIN: 'togglePin',
  JUMP_TO_CELL: 'jumpToCell',
  REORDER_CLIPS: 'reorderClips',
  OPEN_IMAGE: 'openImage',
  OPEN_CLIP: 'openClip',
  REORDER_RECENT_CLIPS: 'reorderRecentClips',
  UPDATE_CLIP: 'updateClip',
} as const;