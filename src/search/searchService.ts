import { Clip } from '../types/index.js';

export class SearchService {
  // クリップを検索・フィルタリング
  static searchClips(
    clips: Clip[],
    query: string,
    filters?: {
      type?: string;
      tags?: string[];
      dateFrom?: number;
      dateTo?: number;
      notebookFileName?: string; // 追加：ファイル名フィルター
    }
  ): Clip[] {
    let results = [...clips];

     // テキスト検索
     if (query) {
       const lowerQuery = query.toLowerCase();
       results = results.filter((clip: Clip) => {
         const titleMatch = clip.title?.toLowerCase().includes(lowerQuery);
         const memoMatch = clip.memo?.toLowerCase().includes(lowerQuery);
         const tagMatch = clip.tags.some((tag: string) => tag.toLowerCase().includes(lowerQuery));
         const codeMatch = clip.codeSnippet?.toLowerCase().includes(lowerQuery);
         // コンテンツのテキスト検索
         let contentMatch = false;
         if (clip.content) {
           if ('textContent' in clip.content && clip.content.textContent) {
             contentMatch = clip.content.textContent.toLowerCase().includes(lowerQuery);
           } else if ('htmlContent' in clip.content && clip.content.htmlContent) {
             contentMatch = clip.content.htmlContent.toLowerCase().includes(lowerQuery);
           }
         }
         return titleMatch || memoMatch || tagMatch || codeMatch || contentMatch;
       });
     }

    // タイプフィルター
    if (filters?.type) {
      results = results.filter((clip: Clip) => clip.type === filters.type);
    }

    // タグフィルター
    if (filters?.tags && filters.tags.length > 0) {
      results = results.filter((clip: Clip) =>
        filters.tags!.some((tag: string) => clip.tags.includes(tag))
      );
    }

    // 日付範囲フィルター
    if (filters?.dateFrom) {
      results = results.filter((clip: Clip) => clip.timestamp >= filters.dateFrom!);
    }
    if (filters?.dateTo) {
      results = results.filter((clip: Clip) => clip.timestamp <= filters.dateTo!);
    }

    // ファイル名フィルター（notebookUriからファイル名を抽出してマッチ）
    if (filters?.notebookFileName) {
      const lowerFileName = filters.notebookFileName.toLowerCase();
      results = results.filter((clip: Clip) => {
        if (!clip.source?.notebookUri) return false;
        try {
          const uri = clip.source.notebookUri;
          // URIからファイル名を抽出
          const fileName = uri.split('/').pop()?.toLowerCase() || '';
          return fileName.includes(lowerFileName);
        } catch {
          return false;
        }
      });
    }

    return results;
  }

  // タグの一覧を取得
  static getAllTags(clips: Clip[]): string[] {
    const tagSet = new Set<string>();
    clips.forEach((clip: Clip) => {
      clip.tags.forEach((tag: string) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }

  // ピン留めされたクリップを取得
  static getPinnedClips(clips: Clip[]): Clip[] {
    return clips.filter((clip: Clip) => clip.pinned);
  }

  // 最近のクリップを取得（指定された数）
  static getRecentClips(clips: Clip[], count: number = 10): Clip[] {
    return [...clips]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, count);
  }
}