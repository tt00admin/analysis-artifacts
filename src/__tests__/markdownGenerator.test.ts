import { MarkdownGenerator } from '../export/markdownGenerator.js';
import { Clip } from '../types/index.js';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

function createImageClip(imagePath: string): Clip {
  return {
    id: 'clip-image',
    timestamp: 1000,
    type: 'image',
    title: 'Plot',
    tags: [],
    source: { notebookUri: 'file:///test.ipynb' },
    content: { imagePath, mimeType: 'image/png' },
    pinned: false,
    order: 1000,
    metadata: {}
  };
}

describe('MarkdownGenerator', () => {
  test('copies image assets next to exported markdown', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'analysis-artifacts-md-'));
    const sourceImage = path.join(tmpDir, 'source.png');
    const outputPath = path.join(tmpDir, 'report.md');
    await fs.writeFile(sourceImage, Buffer.from([1, 2, 3]));

    const markdown = await MarkdownGenerator.generateMarkdown(
      [createImageClip('images/source.png')],
      outputPath,
      {
        copyImageAssets: true,
        resolveImagePath: () => sourceImage
      }
    );

    const copiedImage = path.join(tmpDir, 'report-assets', 'clip-image.png');
    await expect(fs.stat(copiedImage)).resolves.toBeDefined();
    expect(markdown).toContain('report-assets/clip-image.png');
  });
});
