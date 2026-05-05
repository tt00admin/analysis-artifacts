/**
 * 画像解析サービス
 */
export class ImageAnalyzer {
  /**
   * 画像データからサイズを取得
   */
  getDimensions(imageData: Uint8Array): { width: number; height: number } | undefined {
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

  /**
   * MIMEタイプからファイル拡張子を取得
   */
  getExtension(mimeType: string): string {
    const ext = mimeType.split('/')[1] || 'png';
    return ext === 'jpeg' ? 'jpg' : ext;
  }
}