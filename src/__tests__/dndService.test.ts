import { DnDService } from '../sidebar/components/dndService.js';
import { Clip } from '../types/index.js';

// 模拟Clip对象生成函数
function createMockClip(id: string, pinned: boolean, order: number, type: string = 'text'): Clip {
  return {
    id,
    timestamp: Date.now(),
    type: type as any,
    title: `Clip ${id}`,
    tags: [],
    source: { notebookUri: 'test-uri' },
    content: { textContent: 'test' },
    pinned,
    order,
    metadata: {}
  } as Clip;
}

describe('DnDService.reorderClips', () => {
  // テスト1: pinned clipsがない場合、元の配列を返す
  test('should return original clips when no pinned clips exist', () => {
    const clips = [
      createMockClip('1', false, 0),
      createMockClip('2', false, 1),
    ];
    const result = DnDService.reorderClips(clips, 0, 1);
    expect(result).toBe(clips); // 元の配列を返す（変更なし）
  });

  // テスト2: pinned clipsがあり有効なインデックスで正しく移動
  test('should reorder pinned clips correctly with valid indices', () => {
    const clips = [
      createMockClip('p1', true, 0),
      createMockClip('p2', true, 1),
      createMockClip('p3', true, 2),
      createMockClip('u1', false, 3),
    ];
    // 将p1（index 0）移动到index 2
    const result = DnDService.reorderClips(clips, 0, 2);
    
    // pinned clipsの順序を確認
    const pinnedResult = result.filter(c => c.pinned);
    expect(pinnedResult[0].id).toBe('p2');
    expect(pinnedResult[1].id).toBe('p3');
    expect(pinnedResult[2].id).toBe('p1');
    
    // orderが更新されたか確認
    expect(pinnedResult[0].order).toBe(0);
    expect(pinnedResult[1].order).toBe(1);
    expect(pinnedResult[2].order).toBe(2);
    
    // unpinned clipsが変更されていないか確認
    const unpinnedResult = result.filter(c => !c.pinned);
    expect(unpinnedResult[0].id).toBe('u1');
    expect(unpinnedResult[0].order).toBe(3); // orderは元のまま保持されるべき
  });

  // テスト3: startIndexが無効（負数）の場合、元の配列を返す
  test('should return original clips when startIndex is negative', () => {
    const clips = [
      createMockClip('p1', true, 0),
      createMockClip('p2', true, 1),
    ];
    const result = DnDService.reorderClips(clips, -1, 1);
    expect(result).toBe(clips);
  });

  // テスト4: endIndexが無効（範囲外）の場合、元の配列を返す
  test('should return original clips when endIndex is out of range', () => {
    const clips = [
      createMockClip('p1', true, 0),
      createMockClip('p2', true, 1),
    ];
    const result = DnDService.reorderClips(clips, 0, 2); // endIndex=2は範囲外（pinned clipsは2つ、インデックス0-1）
    expect(result).toBe(clips);
  });

  // テスト5: 最初の位置に移動
  test('should move clip to first position', () => {
    const clips = [
      createMockClip('p1', true, 0),
      createMockClip('p2', true, 1),
      createMockClip('p3', true, 2),
    ];
    const result = DnDService.reorderClips(clips, 2, 0); // p3を最初の位置に移動する
    
    const pinnedResult = result.filter(c => c.pinned);
    expect(pinnedResult[0].id).toBe('p3');
    expect(pinnedResult[1].id).toBe('p1');
    expect(pinnedResult[2].id).toBe('p2');
  });

  // 测试6: 混合pinned和unpinned，确保unpinned的order不变
  test('should not modify order of unpinned clips', () => {
    const clips = [
      createMockClip('p1', true, 0),
      createMockClip('u1', false, 1),
      createMockClip('p2', true, 2),
      createMockClip('u2', false, 3),
    ];
    const originalU1Order = clips[1].order;
    const originalU2Order = clips[3].order;
    
    const result = DnDService.reorderClips(clips, 0, 1); // p1をp2の位置に移動する
    
    const u1 = result.find(c => c.id === 'u1');
    const u2 = result.find(c => c.id === 'u2');
    expect(u1?.order).toBe(originalU1Order);
    expect(u2?.order).toBe(originalU2Order);
  });
});

describe('DnDService.reorderRecentClips', () => {
  // テスト1: 特定のタイプのRecentクリップを正しく並び替え
  test('should reorder recent clips of specific type correctly', () => {
    const clips = [
      createMockClip('p1', true, 0, 'text'),
      createMockClip('img1', false, 1, 'image'),
      createMockClip('img2', false, 2, 'image'),
      createMockClip('img3', false, 3, 'image'),
      createMockClip('text1', false, 4, 'text'),
    ];
    // img2（index 1）をimg3（index 3）の位置に移動
    const result = DnDService.reorderRecentClips(clips, 'image', 1, 2);
    
    // imageタイプのみ並び替えられる
    const imageClips = result.filter(c => c.type === 'image' && !c.pinned);
    expect(imageClips[0].id).toBe('img1');
    expect(imageClips[1].id).toBe('img3');
    expect(imageClips[2].id).toBe('img2');
    
    // orderが更新されたか確認
    expect(imageClips[0].order).toBe(0);
    expect(imageClips[1].order).toBe(1);
    expect(imageClips[2].order).toBe(2);
    
    // pinned clipsが変更されていないか確認
    const pinnedResult = result.filter(c => c.pinned);
    expect(pinnedResult[0].id).toBe('p1');
  });

  // テスト2: 無効なインデックスの場合、元の配列を返す
  test('should return original clips when indices are invalid', () => {
    const clips = [
      createMockClip('img1', false, 0, 'image'),
      createMockClip('img2', false, 1, 'image'),
    ];
    const result = DnDService.reorderRecentClips(clips, 'image', -1, 1);
    expect(result).toBe(clips);
  });

  // テスト3: 指定タイプにクリップがない場合、元の配列を返す
  test('should return original clips when no clips of specified type exist', () => {
    const clips = [
      createMockClip('p1', true, 0, 'text'),
      createMockClip('text1', false, 1, 'text'),
    ];
    const result = DnDService.reorderRecentClips(clips, 'image', 0, 1);
    expect(result).toBe(clips);
  });

  // テスト4: 最初の位置に移動
  test('should move clip to first position', () => {
    const clips = [
      createMockClip('p1', true, 0, 'text'),
      createMockClip('img1', false, 1, 'image'),
      createMockClip('img2', false, 2, 'image'),
      createMockClip('img3', false, 3, 'image'),
    ];
    const result = DnDService.reorderRecentClips(clips, 'image', 2, 0);
    
    const imageClips = result.filter(c => c.type === 'image' && !c.pinned);
    expect(imageClips[0].id).toBe('img3');
    expect(imageClips[1].id).toBe('img1');
    expect(imageClips[2].id).toBe('img2');
  });

  test('should reorder pinned clips by id', () => {
    const clips = [
      createMockClip('p1', true, 0),
      createMockClip('p2', true, 1),
      createMockClip('u1', false, 2),
    ];

    const result = DnDService.reorderPinnedClipsById(clips, 'p2', 'p1');
    const pinnedResult = result.filter(c => c.pinned);

    expect(pinnedResult.map(c => c.id)).toEqual(['p2', 'p1']);
    expect(result.find(c => c.id === 'u1')).toBeDefined();
  });

  test('should reorder recent clips by id without dropping other types', () => {
    const clips = [
      createMockClip('p1', true, 0, 'text'),
      createMockClip('img1', false, 1, 'image'),
      createMockClip('img2', false, 2, 'image'),
      createMockClip('text1', false, 3, 'text'),
    ];

    const result = DnDService.reorderRecentClipsById(clips, 'image', 'img2', 'img1');
    const imageClips = result.filter(c => c.type === 'image' && !c.pinned);

    expect(imageClips.map(c => c.id)).toEqual(['img2', 'img1']);
    expect(result.find(c => c.id === 'text1')).toBeDefined();
    expect(result.find(c => c.id === 'p1')).toBeDefined();
  });
});
