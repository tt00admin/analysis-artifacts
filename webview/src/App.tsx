import React, { useState, useEffect, useCallback } from 'react';
import Deck from './components/Deck';
import { Clip } from '../../src/types';

// VS Code APIの型定義
declare global {
  interface Window {
    acquireVsCodeApi?: () => {
      postMessage: (message: any) => void;
    };
    vscode: {
      postMessage: (message: any) => void;
    } | undefined;
  }
}

function App() {
  const [deck, setDeck] = useState<{ clips: Clip[]; allTags?: string[]; lastUpdated?: number; clipState?: { canClip: boolean; reason?: string } } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterTag, setFilterTag] = useState<string>('');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [filterFileName, setFilterFileName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);
  const [pinOnSave, setPinOnSave] = useState(false);

  useEffect(() => {
    // VS Code APIを取得
    const vscode = window.acquireVsCodeApi?.();
    if (vscode) {
      window.vscode = vscode;
    }

    // メッセージリスナー
    const handler = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'deckUpdate') {
        setDeck(message.deck);
        setErrorMessage('');
      }
      if (message.type === 'error') {
        setErrorMessage(message.message || 'DataDeck operation failed.');
      }
    };
    window.addEventListener('message', handler);

    // 初期デッキ要求
    if (window.vscode) {
      window.vscode.postMessage({ type: 'requestDeck' });
    }

    return () => window.removeEventListener('message', handler);
  }, []);

  // フィルター条件変更時に拡張機能に通知
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!window.vscode) {
        return;
      }
      window.vscode.postMessage({
        type: 'filterDeck',
        query: searchQuery,
        clipType: filterType || undefined,
        tags: filterTag ? [filterTag] : undefined,
        dateFrom: filterDateFrom ? new Date(filterDateFrom).getTime() : undefined,
        dateTo: filterDateTo ? new Date(filterDateTo).getTime() : undefined,
        notebookFileName: filterFileName || undefined
      });
    }, 200);
    return () => window.clearTimeout(timeout);
  }, [searchQuery, filterType, filterTag, filterDateFrom, filterDateTo, filterFileName]);

  const handleClip = useCallback(() => {
    if (window.vscode) {
      window.vscode.postMessage({ type: 'clipActiveCell', pinned: pinOnSave });
    }
  }, [pinOnSave]);

  const handleReload = useCallback(() => {
    if (window.vscode) {
      window.vscode.postMessage({ type: 'requestDeck' });
    }
  }, []);

  const handleDelete = useCallback((clipId: string) => {
    const confirmed = window.confirm('Delete this clip? This cannot be undone.');
    if (!confirmed) {
      return;
    }
    if (window.vscode) {
      window.vscode.postMessage({ type: 'deleteClip', clipId });
    }
  }, []);

  const handleTogglePin = useCallback((clipId: string) => {
    if (window.vscode) {
      window.vscode.postMessage({ type: 'togglePin', clipId });
    }
  }, []);

  const handleExport = useCallback(() => {
    if (window.vscode) {
      window.vscode.postMessage({ type: 'exportMarkdown', clipIds: selectedClipIds });
    }
  }, [selectedClipIds]);

  const handleReorder = useCallback((clipId: string, targetClipId: string) => {
    if (window.vscode) {
      window.vscode.postMessage({ type: 'reorderClips', clipId, targetClipId });
    }
  }, []);

  const handleReorderRecent = useCallback((type: string, clipId: string, targetClipId: string) => {
    if (window.vscode) {
      window.vscode.postMessage({ type: 'reorderRecentClips', clipType: type, clipId, targetClipId });
    }
  }, []);

  const handleOpenImage = useCallback((clip: Clip) => {
    if (window.vscode) {
      window.vscode.postMessage({ type: 'openImage', clip });
    }
  }, []);

  const handleOpenClip = useCallback((clip: Clip) => {
    if (window.vscode) {
      window.vscode.postMessage({ type: 'openClip', clip });
    }
  }, []);

  const handleUpdateClip = useCallback((clipId: string, updates: { title?: string; memo?: string; tags?: string[] }) => {
    if (window.vscode) {
      window.vscode.postMessage({ type: 'updateClip', clipId, updates });
    }
  }, []);

  const handleResetFilters = useCallback(() => {
    setSearchQuery('');
    setFilterType('');
    setFilterTag('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterFileName('');
  }, []);

  const handleSelectClip = useCallback((clipId: string, selected: boolean) => {
    setSelectedClipIds((current) => {
      if (selected) {
        return current.includes(clipId) ? current : [...current, clipId];
      }
      return current.filter((id) => id !== clipId);
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedClipIds([]);
  }, []);

  if (!deck) {
    return <div className="loading-state">Loading DataDeck...</div>;
  }

  const totalClips = deck.clips.length;
  const pinnedCount = deck.clips.filter((clip) => clip.pinned).length;
  const hasActiveFilters = Boolean(searchQuery || filterType || filterTag || filterDateFrom || filterDateTo || filterFileName);

  return (
    <div className="app">
      <div className="deck-summary">
        <span>{totalClips} clips</span>
        <span>{pinnedCount} pinned</span>
        {selectedClipIds.length > 0 && <span>{selectedClipIds.length} selected</span>}
        {hasActiveFilters && <span>filtered</span>}
      </div>
      {errorMessage && (
        <div className="error-state" role="alert">
          {errorMessage}
        </div>
      )}
      {/* 1段目：ノートブックファイル名フィルター、日付範囲フィルター */}
      <div className="top-section">
        <div className="notebook-filter">
          <input
            type="text"
            placeholder="Notebook file name"
            value={filterFileName}
            onChange={(e) => setFilterFileName(e.target.value)}
            aria-label="Filter by notebook file name"
          />
        </div>
        <div className="date-range">
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            aria-label="Filter from date"
          />
          <span>~</span>
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            aria-label="Filter to date"
          />
        </div>

      </div>

      {/* 2段目：検索、タイプ、アイコンボタン */}
      <div className="bottom-section">
        <div className="action-row">
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search clips"
          />
          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value)}
            aria-label="Filter by type"
          >
            <option value="">All Types</option>
            <option value="image">Image</option>
            <option value="html">HTML</option>
            <option value="dataframe">DataFrame</option>
            <option value="text">Text</option>
          </select>
          <select
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            aria-label="Filter by tag"
          >
            <option value="">All Tags</option>
            {(deck.allTags ?? []).map((tag) => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
          <button
            className="icon-button"
            onClick={handleClip}
            title={deck.clipState?.reason || 'Add Clip'}
            disabled={deck.clipState?.canClip === false}
          >
            <i className="codicon codicon-add"></i>
          </button>
          <label className="pin-on-save" title="Pin new clips">
            <input
              type="checkbox"
              checked={pinOnSave}
              onChange={(event) => setPinOnSave(event.target.checked)}
            />
            <span className="codicon codicon-pin"></span>
          </label>
          <button className="icon-button" onClick={handleExport} title="Export Markdown">
            <i className="codicon codicon-export"></i>
          </button>
          <button className="icon-button" onClick={handleClearSelection} title="Clear Selection" disabled={selectedClipIds.length === 0}>
            <i className="codicon codicon-close-all"></i>
          </button>
          <button className="primary-button" onClick={handleReload} title="Reload Deck">
            <i className="codicon codicon-refresh"></i>
          </button>
          <button className="icon-button" onClick={handleResetFilters} title="Reset Filters" disabled={!hasActiveFilters}>
            <i className="codicon codicon-clear-all"></i>
          </button>

        </div>
      </div>

      <Deck
        clips={deck?.clips || []}
        onDelete={handleDelete}
        onTogglePin={handleTogglePin}
        onReorder={handleReorder}
        onOpenImage={handleOpenImage}
        onOpenClip={handleOpenClip}
        onReorderRecent={handleReorderRecent}
        onUpdateClip={handleUpdateClip}
        selectedClipIds={selectedClipIds}
        onSelectClip={handleSelectClip}
      />
    </div>
  );
}

export default App;
