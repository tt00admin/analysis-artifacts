import { Clip, SearchFilters } from '../types/index.js';

/**
 * クリップ検索サービス
 */
export class SearchService {
  /**
   * クリップを検索・フィルタリング
   */
  searchClips(
    clips: Clip[],
    query: string,
    filters?: SearchFilters
  ): Clip[] {
    let results = [...clips];

    // テキスト検索
    if (query) {
      results = this.filterByTextSearch(results, query);
    }

    // タイプフィルター
    if (filters?.type) {
      results = results.filter((clip: Clip) => clip.type === filters.type);
    }

    // タグフィルター
    if (filters?.tags && filters.tags.length > 0) {
      results = this.filterByTags(results, filters.tags);
    }

    // 日付範囲フィルター
    if (filters?.dateFrom) {
      results = results.filter((clip: Clip) => clip.timestamp >= filters.dateFrom!);
    }
    if (filters?.dateTo) {
      results = results.filter((clip: Clip) => clip.timestamp <= filters.dateTo!);
    }

    // ファイル名フィルター
    if (filters?.notebookFileName) {
      results = this.filterByNotebookFileName(results, filters.notebookFileName);
    }

    return results;
  }

  private filterByTextSearch(clips: Clip[], query: string): Clip[] {
    const lowerQuery = query.toLowerCase();
    return clips.filter((clip: Clip) => {
      const titleMatch = clip.title?.toLowerCase().includes(lowerQuery);
      const memoMatch = clip.memo?.toLowerCase().includes(lowerQuery);
      const tagMatch = clip.tags.some((tag: string) => tag.toLowerCase().includes(lowerQuery));
      const codeMatch = clip.codeSnippet?.toLowerCase().includes(lowerQuery);
      const contentMatch = this.matchContent(clip, lowerQuery);
      return titleMatch || memoMatch || tagMatch || codeMatch || contentMatch;
    });
  }

  private matchContent(clip: Clip, lowerQuery: string): boolean {
    if (!clip.content) {
      return false;
    }
    if ('textContent' in clip.content && clip.content.textContent) {
      return clip.content.textContent.toLowerCase().includes(lowerQuery);
    }
    if ('htmlContent' in clip.content && clip.content.htmlContent) {
      return clip.content.htmlContent.toLowerCase().includes(lowerQuery);
    }
    return false;
  }

  private filterByTags(clips: Clip[], tags: string[]): Clip[] {
    return clips.filter((clip: Clip) =>
      tags.some((tag: string) => clip.tags.includes(tag))
    );
  }

  private filterByNotebookFileName(clips: Clip[], notebookFileName: string): Clip[] {
    const lowerFileName = notebookFileName.toLowerCase();
    return clips.filter((clip: Clip) => {
      if (!clip.source?.notebookUri) return false;
      try {
        const uri = clip.source.notebookUri;
        const fileName = uri.split('/').pop()?.toLowerCase() || '';
        return fileName.includes(lowerFileName);
      } catch {
        return false;
      }
    });
  }

  /**
   * タグの一覧を取得
   */
  getAllTags(clips: Clip[]): string[] {
    const tagSet = new Set<string>();
    clips.forEach((clip: Clip) => {
      clip.tags.forEach((tag: string) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }

  /**
   * ピン留めされたクリップを取得
   */
  getPinnedClips(clips: Clip[]): Clip[] {
    return clips.filter((clip: Clip) => clip.pinned);
  }

  /**
   * 最近のクリップを取得（指定された数）
   */
  getRecentClips(clips: Clip[], count: number = 10): Clip[] {
    return [...clips]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, count);
  }
}