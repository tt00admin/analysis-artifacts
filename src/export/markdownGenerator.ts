import { Clip } from '../types/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';

interface MarkdownOptions {
  resolveImagePath?: (imagePath: string) => string;
  copyImageAssets?: boolean;
}

export class MarkdownGenerator {
  // クリップをMarkdown形式に変換
  static async generateMarkdown(clips: Clip[], outputPath?: string, options: MarkdownOptions = {}): Promise<string> {
    let markdown = '# DataDeck Export\n\n';
    markdown += `Exported at: ${new Date().toLocaleString()}\n\n`;
    markdown += `---\n\n`;

    // ピン留めされたクリップを先に表示
    const pinnedClips = clips.filter((clip: Clip) => clip.pinned);
    const otherClips = clips.filter((clip: Clip) => !clip.pinned);

    if (pinnedClips.length > 0) {
      markdown += '## Pinned Clips\n\n';
      for (const clip of pinnedClips) {
        markdown += await this.clipToMarkdown(clip, outputPath, options);
      }
    }

    if (otherClips.length > 0) {
      markdown += '## Recent Clips\n\n';
      for (const clip of otherClips) {
        markdown += await this.clipToMarkdown(clip, outputPath, options);
      }
    }

    // ファイルに保存（オプション）
    if (outputPath) {
      await fs.writeFile(outputPath, markdown, 'utf-8');
    }

    return markdown;
  }

  private static async clipToMarkdown(clip: Clip, outputPath?: string, options: MarkdownOptions = {}): Promise<string> {
    let section = '';

    // タイトル
    if (clip.title) {
      section += `### ${clip.title}\n\n`;
    } else {
      section += `### Clip (${clip.type})\n\n`;
    }

    // メタデータ
    section += `**Type:** ${clip.type}  \n`;
    section += `**Time:** ${new Date(clip.timestamp).toLocaleString()}  \n`;
    if (clip.tags.length > 0) {
      section += `**Tags:** ${clip.tags.map((tag: string) => `\`${tag}\``).join(', ')}  \n`;
    }
    section += '\n';

    // メモ
    if (clip.memo) {
      section += `**Memo:**\n${clip.memo}\n\n`;
    }

    // コンテンツ
    section += '#### Content\n\n';
    switch (clip.type) {
      case 'image':
        if (clip.content.imagePath) {
          const imagePath = await this.prepareImagePath(clip, outputPath, options);
          section += `![${this.escapeMarkdownAlt(clip.title || 'image')}](${imagePath})\n\n`;
        }
        break;
      case 'html':
        if (clip.content.htmlContent) {
          section += `<details>\n<summary>HTML Content</summary>\n\n${clip.content.htmlContent}\n\n</details>\n\n`;
        }
        break;
      case 'dataframe':
      case 'text':
        if (clip.content.textContent) {
          section += '```\n' + clip.content.textContent + '\n```\n\n';
        }
        break;
    }

    // コードスニペット
    if (clip.codeSnippet) {
      section += '#### Code\n\n';
      section += '```python\n' + clip.codeSnippet + '\n```\n\n';
    }

    // ソース情報
    section += '#### Source\n\n';
    section += `Notebook: ${clip.source.notebookUri}\n`;
    if (clip.source.executionCount) {
      section += `Execution Count: ${clip.source.executionCount}\n`;
    }
    section += '\n---\n\n';

    return section;
  }

  // 選択されたクリップのみをエクスポート
  static async exportSelected(clipIds: string[], allClips: Clip[], outputPath: string): Promise<void> {
    const selectedClips = allClips.filter((clip: Clip) => clipIds.includes(clip.id));
    await this.generateMarkdown(selectedClips, outputPath);
  }

  private static async prepareImagePath(clip: Clip, outputPath?: string, options: MarkdownOptions = {}): Promise<string> {
    const imagePath = clip.content.imagePath;
    if (!imagePath) {
      return '';
    }

    if (!outputPath || !options.copyImageAssets || !options.resolveImagePath) {
      return imagePath.split(path.sep).join('/');
    }

    const sourcePath = options.resolveImagePath(imagePath);
    const outputDir = path.dirname(outputPath);
    const assetsDirName = `${path.basename(outputPath, path.extname(outputPath))}-assets`;
    const assetsDir = path.join(outputDir, assetsDirName);
    await fs.mkdir(assetsDir, { recursive: true });

    const ext = path.extname(sourcePath) || path.extname(imagePath) || '.png';
    const fileName = `${clip.id}${ext}`;
    const targetPath = path.join(assetsDir, fileName);
    await fs.copyFile(sourcePath, targetPath);
    return path.posix.join(assetsDirName, fileName);
  }

  private static escapeMarkdownAlt(value: string): string {
    return value.replace(/[\[\]]/g, '');
  }
}
