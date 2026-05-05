import { SearchService } from '../search/searchService.js';
import { Clip } from '../types/index.js';

describe('SearchService', () => {
  let searchService: SearchService;
  
  beforeEach(() => {
    searchService = new SearchService();
  });

  const mockClips: Clip[] = [
    {
      id: '1',
      type: 'text',
      timestamp: 1000,
      title: 'Test Clip',
      content: { textContent: 'Hello World', mimeType: 'text/plain' },
      source: { notebookUri: 'test.ipynb', cellId: 'cell1' },
      pinned: false,
      order: 1000,
      tags: ['test', 'example'],
      metadata: {}
    },
    {
      id: '2',
      type: 'image',
      timestamp: 2000,
      content: { imagePath: 'test.png', mimeType: 'image/png' },
      source: { notebookUri: 'test.ipynb', cellId: 'cell2' },
      pinned: true,
      order: 2000,
      tags: ['image'],
      metadata: {}
    }
  ];

  test('searchClips should filter by text query', () => {
    const results = searchService.searchClips(mockClips, 'Hello');
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('1');
  });

  test('searchClips should filter by type', () => {
    const results = searchService.searchClips(mockClips, '', { type: 'image' });
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('2');
  });

  test('searchClips should filter by tags', () => {
    const results = searchService.searchClips(mockClips, '', { tags: ['image'] });
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('2');
  });

  test('getPinnedClips should return only pinned clips', () => {
    const results = searchService.getPinnedClips(mockClips);
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('2');
  });

  test('getRecentClips should return clips sorted by timestamp', () => {
    const results = searchService.getRecentClips(mockClips, 1);
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('2'); // より新しいタイムスタンプ
  });
});