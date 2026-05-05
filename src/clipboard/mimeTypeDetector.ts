/**
 * MIMEタイプ検出・優先度判定サービス
 */
export class MimeTypeDetector {
  /**
   * MIMEタイプの優先度を取得
   * 優先度が高いほど先に選択される
   */
  getPriority(mimeType: string, data: Uint8Array): number {
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

  /**
   * 出力データからMIMEタイプに基づいて最も適切な候補を選択
   */
  selectBestCandidate<T extends { mimeType: string; data: Uint8Array; outputIndex: number; itemIndex: number }>(
    candidates: T[]
  ): T | undefined {
    const selected = candidates.sort((a, b) => {
      const priorityA = this.getPriority(a.mimeType, a.data);
      const priorityB = this.getPriority(b.mimeType, b.data);
      if (priorityB !== priorityA) {
        return priorityB - priorityA;
      }
      if (b.outputIndex !== a.outputIndex) {
        return b.outputIndex - a.outputIndex;
      }
      return b.itemIndex - a.itemIndex;
    })[0];

    return selected;
  }
}