import { Deck, Clip } from '../../types/index.js';
import { StorageService } from '../../storage/storageService.js';

export class DnDService {
  // クリップの順序を更新
  // ピン留めクリップの順序を更新（ピン留めクリップのみを対象とする）
  static reorderClips(clips: Clip[], startIndex: number, endIndex: number): Clip[] {
    // ピン留めクリップと未ピン留めクリップを分離
    const pinnedClips = clips.filter(clip => clip.pinned);
    const unpinnedClips = clips.filter(clip => !clip.pinned);
    
    // 境界値チェック
    if (startIndex < 0 || startIndex >= pinnedClips.length ||
        endIndex < 0 || endIndex >= pinnedClips.length) {
      console.error('Invalid reorder indices for pinned clips:', { startIndex, endIndex, length: pinnedClips.length });
      return clips;
    }
    
    // ピン留めクリップ内での並び替え
    const result = Array.from(pinnedClips);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);

    // ピン留めクリップのorderのみ更新（0から連番）
    const updatedPinned = result.map((clip, index) => ({
      ...clip,
      order: index
    }));

    // 未ピン留めクリップはorderを保持したまま結合
    // ピン留めクリップを先頭に、未ピン留めクリップを末尾に配置
    return [...updatedPinned, ...unpinnedClips];
  }

  // ピン留め状態の変更
  static togglePin(clips: Clip[], clipId: string): Clip[] {
    return clips.map((clip: Clip) =>
       clip.id === clipId ? { ...clip, pinned: !clip.pinned } : clip
    );
  }

  // クリップの削除
  static deleteClip(clips: Clip[], clipId: string): Clip[] {
    return clips.filter((clip: Clip) => clip.id !== clipId);
  }

  // デッキの保存（ストレージサービスを使用）
  static async saveDeck(deck: Deck, storageService: StorageService): Promise<void> {
    deck.lastUpdated = Date.now();
    await storageService.saveDeck(deck);
  }
}