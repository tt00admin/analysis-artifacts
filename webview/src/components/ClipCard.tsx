import React, { useState } from 'react';
import { Clip } from '../../../src/types';
import { sanitizeHtml } from '../../../src/utils/htmlSanitizer';

// VS Code APIの型定義
declare global {
  interface Window {
    vscode: {
      postMessage: (message: any) => void;
    } | undefined;
  }
}

interface ClipCardProps {
  clip: Clip;
  onDelete: (clipId: string) => void;
  onTogglePin: (clipId: string) => void;
  onOpenImage?: (clip: Clip) => void;
  onOpenClip?: (clip: Clip) => void;
  onUpdateClip?: (clipId: string, updates: { title?: string; memo?: string; tags?: string[] }) => void;
  selected?: boolean;
  onSelect?: (clipId: string, selected: boolean) => void;
  isCarousel?: boolean;
}

function ClipCard({ clip, onDelete, onTogglePin, onOpenImage, onOpenClip, onUpdateClip, selected, onSelect, isCarousel }: ClipCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(clip.title || '');
  const [editMemo, setEditMemo] = useState(clip.memo || '');
  const [editTags, setEditTags] = useState(clip.tags?.join(', ') || '');
  const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(timestamp));
  };

  const handleEditClick = () => {
    setEditTitle(clip.title || '');
    setEditMemo(clip.memo || '');
    setEditTags(clip.tags?.join(', ') || '');
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    const tags = editTags
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
    
    onUpdateClip?.(clip.id, {
      title: editTitle.trim() || undefined,
      memo: editMemo.trim() || undefined,
      tags
    });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const renderContent = () => {
    switch (clip.type) {
      case 'image':
        if (clip.content.imageWebviewUri) {
          return (
            <div className="clip-image-container">
              <img
                src={clip.content.imageWebviewUri}
                alt={clip.title || 'clip image'}
                loading="lazy"
                style={{ maxWidth: '100%', height: 'auto' }}
              />
            </div>
          );
        }
        if (clip.content.imagePath) {
          return (
            <div className="clip-image-container">
              <img
                src={clip.content.imagePath}
                alt={clip.title || 'clip image'}
                loading="lazy"
                style={{ maxWidth: '100%', height: 'auto' }}
              />
            </div>
          );
        }
        return <div>No image</div>;
      case 'html':
        return <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(clip.content.htmlContent || '') }} />;
      case 'dataframe':
      case 'text':
        return <pre>{clip.content.textContent || clip.content.htmlContent || ''}</pre>;
      default:
        return <div>Unknown type</div>;
    }
  };

  const handleClick = () => {
    if (window.vscode && clip.source.notebookUri && clip.source.cellId) {
      window.vscode.postMessage({
        type: 'jumpToCell',
        notebookUri: clip.source.notebookUri,
        cellId: clip.source.cellId,
        clip
      });
    }
  };

  const getNotebookName = () => {
    if (!clip.source.notebookUri) {
      return '';
    }
    const decoded = decodeURIComponent(clip.source.notebookUri);
    return decoded.split('/').pop() || decoded;
  };

  const getDimensions = () => {
    const dimensions = clip.metadata?.dimensions;
    return dimensions ? `${dimensions.width}x${dimensions.height}` : '';
  };

  const getFileSize = () => {
    const fileSize = clip.metadata?.fileSize;
    if (!fileSize) {
      return '';
    }
    if (fileSize >= 1024 * 1024) {
      return `${(fileSize / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${Math.ceil(fileSize / 1024)} KB`;
  };

  if (isEditing) {
    return (
      <div className="clip-card editing" onClick={(e) => e.stopPropagation()}>
        <div className="edit-form">
          <div className="edit-field">
            <label>Name</label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Clip name"
              autoFocus
            />
          </div>
          <div className="edit-field">
            <label>Memo</label>
            <textarea
              value={editMemo}
              onChange={(e) => setEditMemo(e.target.value)}
              placeholder="Add a note..."
              rows={3}
            />
          </div>
          <div className="edit-field">
            <label>Tags (comma separated)</label>
            <input
              type="text"
              value={editTags}
              onChange={(e) => setEditTags(e.target.value)}
              placeholder="tag1, tag2, tag3"
            />
          </div>
          <div className="edit-actions">
            <button className="primary-button" onClick={handleSaveEdit}>
              Save
            </button>
            <button className="secondary-button" onClick={handleCancelEdit}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`clip-card ${clip.pinned ? 'pinned' : ''}`}>
      <div className="clip-header">
        <div className="clip-header-start">
          <span className="drag-handle" title="Drag to reorder">
            <span className="codicon codicon-gripper"></span>
          </span>
          <label className="select-clip" title="Select for export">
            <input
              type="checkbox"
              checked={Boolean(selected)}
              onChange={(event) => {
                event.stopPropagation();
                onSelect?.(clip.id, event.target.checked);
              }}
            />
          </label>
        </div>
        <div className="clip-actions">
          <button
            className="icon-button"
            onClick={(event) => {
              event.stopPropagation();
              handleClick();
            }}
            title="Jump to Source"
            disabled={!clip.source.notebookUri || !clip.source.cellId}
          >
            <span className="codicon codicon-go-to-file"></span>
          </button>
          <button
            className="icon-button"
            onClick={(event) => {
              event.stopPropagation();
              onTogglePin(clip.id);
            }}
            title={clip.pinned ? 'Unpin clip' : 'Pin clip'}
          >
            <span className={`codicon ${clip.pinned ? 'codicon-pinned' : 'codicon-pin'}`}></span>
          </button>
          <button
            className="icon-button"
            onClick={(event) => {
              event.stopPropagation();
              onOpenClip?.(clip);
            }}
            title="Expand preview"
          >
            <span className="codicon codicon-unfold"></span>
          </button>
          <details className="actions-menu clip-menu" onClick={(event) => event.stopPropagation()}>
            <summary className="icon-button" title="Clip actions" aria-label="Clip actions">
              <span className="codicon codicon-kebab-vertical"></span>
            </summary>
            <div className="menu-panel">
              <button onClick={handleEditClick}>
                <span className="codicon codicon-edit"></span>
                <span>Edit details</span>
              </button>
              <button className="danger-action" onClick={() => onDelete(clip.id)}>
                <span className="codicon codicon-trash"></span>
                <span>Delete clip</span>
              </button>
            </div>
          </details>
        </div>
      </div>
      
      {clip.title && <h4 className="clip-title">{clip.title}</h4>}
      
      <div className="clip-content">
        {renderContent()}
      </div>
      
      {clip.memo && <p className="clip-memo">{clip.memo}</p>}
      
      {(clip.tags?.length ?? 0) > 0 && (
        <div className="clip-tags">
          {clip.tags.map(tag => (
            <span key={tag} className="tag">#{tag}</span>
          ))}
        </div>
      )}
      
      <div className="clip-footer">
        <span className="clip-time">{formatDate(clip.timestamp)}</span>
        <span className="clip-source" title={clip.source.notebookUri}>
          {[getNotebookName(), getDimensions(), getFileSize()].filter(Boolean).join(' | ')}
        </span>
      </div>
    </div>
  );
}

export default ClipCard;
