import { Clip } from '../../types/index.js';

export class DnDService {
  /**
   * クリップの順序を更新（ピン留めクリップのみを対象とする）
   */
  static reorderClips(clips: Clip[], startIndex: number, endIndex: number): Clip[] {
    // ピン留めクリップと未ピン留めクリップを分離
    const pinnedClips = clips.filter(clip => clip.pinned);
    const unpinnedClips = clips.filter(clip => !clip.pinned);
    
    // 境界値チェック
    if (startIndex < 0 || startIndex >= pinnedClips.length ||
        endIndex < 0 || endIndex >= pinnedClips.length) {
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

  static reorderPinnedClipsById(clips: Clip[], clipId: string, targetClipId: string): Clip[] {
    const pinnedClips = [...clips]
      .filter((clip) => clip.pinned)
      .sort((a, b) => (a.order ?? a.timestamp) - (b.order ?? b.timestamp));

    const startIndex = pinnedClips.findIndex((clip) => clip.id === clipId);
    const endIndex = pinnedClips.findIndex((clip) => clip.id === targetClipId);
    if (startIndex < 0 || endIndex < 0 || startIndex === endIndex) {
      return clips;
    }

    const result = Array.from(pinnedClips);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    const reorderedPinned = result.map((clip, index) => ({ ...clip, order: index }));
    const pinnedById = new Map(reorderedPinned.map((clip) => [clip.id, clip]));
    const unpinnedClips = clips.filter((clip) => !clip.pinned);

    return [
      ...reorderedPinned,
      ...unpinnedClips.map((clip) => pinnedById.get(clip.id) ?? clip)
    ];
  }

  /**
   * ピン留め状態の変更
   */
  static togglePin(clips: Clip[], clipId: string): Clip[] {
    return clips.map((clip: Clip) =>
       clip.id === clipId ? { ...clip, pinned: !clip.pinned } : clip
    );
  }

  /**
   * クリップの削除
   */
  static deleteClip(clips: Clip[], clipId: string): Clip[] {
    return clips.filter((clip: Clip) => clip.id !== clipId);
  }

  /**
   * 指定タイプのRecentクリップを並び替え
   */
  static reorderRecentClips(clips: Clip[], type: string, startIndex: number, endIndex: number): Clip[] {
    // 指定タイプの未ピン留めクリップを抽出
    const typeClips = clips.filter(clip => !clip.pinned && clip.type === type);
    const otherClips = clips.filter(clip => clip.pinned || clip.type !== type);
    
    // 境界値チェック
    if (startIndex < 0 || startIndex >= typeClips.length ||
        endIndex < 0 || endIndex >= typeClips.length) {
      return clips;
    }
    
    // タイプ内での並び替え
    const result = Array.from(typeClips);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    
    // orderを更新（0から連番）
    const updatedTypeClips = result.map((clip, index) => ({
      ...clip,
      order: index
    }));
    
    const updatedById = new Map(updatedTypeClips.map((clip) => [clip.id, clip]));
    const pinnedClips = otherClips.filter(clip => clip.pinned);
    const remainingUnpinned = otherClips.filter(clip => !clip.pinned);
    return [
      ...pinnedClips,
      ...updatedTypeClips,
      ...remainingUnpinned.map((clip) => updatedById.get(clip.id) ?? clip)
    ];
  }

  static reorderRecentClipsById(clips: Clip[], type: string, clipId: string, targetClipId: string): Clip[] {
    const typeClips = [...clips]
      .filter((clip) => !clip.pinned && clip.type === type)
      .sort((a, b) => (a.order ?? a.timestamp) - (b.order ?? b.timestamp));

    const startIndex = typeClips.findIndex((clip) => clip.id === clipId);
    const endIndex = typeClips.findIndex((clip) => clip.id === targetClipId);
    if (startIndex < 0 || endIndex < 0 || startIndex === endIndex) {
      return clips;
    }

    const result = Array.from(typeClips);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    const reorderedTypeClips = result.map((clip, index) => ({ ...clip, order: index }));
    const updatedById = new Map(reorderedTypeClips.map((clip) => [clip.id, clip]));
    const pinnedClips = clips.filter((clip) => clip.pinned);
    const otherUnpinned = clips.filter((clip) => !clip.pinned && clip.type !== type);

    return [
      ...pinnedClips,
      ...reorderedTypeClips,
      ...otherUnpinned.map((clip) => updatedById.get(clip.id) ?? clip)
    ];
  }
}
