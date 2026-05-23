import React, { useCallback, useRef, useState, useEffect } from 'react';
import ClipCard from './ClipCard';
import { Clip } from '../../../src/types';

interface DeckProps {
  clips: Clip[];
  onDelete: (clipId: string) => void;
  onTogglePin: (clipId: string) => void;
  onReorder?: (clipId: string, targetClipId: string) => void;
  onOpenImage?: (clip: Clip) => void;
  onOpenClip?: (clip: Clip) => void;
  onReorderRecent?: (type: string, clipId: string, targetClipId: string) => void;
  onUpdateClip?: (clipId: string, updates: { title?: string; memo?: string; tags?: string[] }) => void;
  selectedClipIds?: string[];
  onSelectClip?: (clipId: string, selected: boolean) => void;
}

function Deck({ clips, onDelete, onTogglePin, onReorder, onOpenImage, onOpenClip, onReorderRecent, onUpdateClip, selectedClipIds = [], onSelectClip }: DeckProps) {
  const sortedClips = [...clips].sort((a, b) => (a.order ?? a.timestamp) - (b.order ?? b.timestamp));
  const pinnedClips = sortedClips.filter(clip => clip.pinned);
  const recentClips = sortedClips
    .filter(clip => !clip.pinned)
    .sort((a, b) => b.timestamp - a.timestamp);
  
  // For pinned clips drag-and-drop
  const dragItem = useRef<string | null>(null);
  const dragOverItem = useRef<string | null>(null);
  
  // For auto-scrolling carousel to left on new clip
  const carouselRefs = useRef<Record<string, HTMLDivElement | null>>({});
  
  // Scroll carousel to left when clips change (new clip added)
  useEffect(() => {
    Object.values(carouselRefs.current).forEach((carousel) => {
      if (carousel) {
        carousel.scrollLeft = 0;
      }
    });
  }, [clips]);

  const isInteractiveElement = (event: React.DragEvent) => {
    return Boolean((event.target as HTMLElement).closest('button, input, textarea, select, label, .clip-actions'));
  };

  const handleDragStart = useCallback((event: React.DragEvent, clipId: string) => {
    if (isInteractiveElement(event)) {
      event.preventDefault();
      return;
    }
    dragItem.current = clipId;
  }, []);

  const handleDragEnter = useCallback((clipId: string) => {
    dragOverItem.current = clipId;
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragItem.current !== null && dragOverItem.current !== null && onReorder) {
      onReorder(dragItem.current, dragOverItem.current);
    }
    dragItem.current = null;
    dragOverItem.current = null;
  }, [onReorder]);

  // For carousel items drag-and-drop
  const [carouselDragState, setCarouselDragState] = useState<{
    type: string;
    dragId: string | null;
    overId: string | null;
  }>({ type: '', dragId: null, overId: null });

  const handleCarouselDragStart = useCallback((event: React.DragEvent, type: string, clipId: string) => {
    if (isInteractiveElement(event)) {
      event.preventDefault();
      return;
    }
    setCarouselDragState({ type, dragId: clipId, overId: null });
  }, []);

  const handleCarouselDragEnter = useCallback((type: string, clipId: string) => {
    setCarouselDragState(prev => {
      // Keep the original type from dragStart, but update overIndex
      return { ...prev, overId: clipId };
    });
  }, []);

  const handleCarouselDragEnd = useCallback(() => {
    if (carouselDragState.dragId !== null && carouselDragState.overId !== null && onReorderRecent) {
      onReorderRecent(carouselDragState.type, carouselDragState.dragId, carouselDragState.overId);
    }
    setCarouselDragState({ type: '', dragId: null, overId: null });
  }, [carouselDragState, onReorderRecent]);

  const renderClipList = (clipList: Clip[], isPinned: boolean = false) => {
    if (isPinned) {
      return (
        <section className="deck-section pinned-section">
          <div className="section-header">
            <div>
              <h2>Pinned</h2>
              <p>Keep key outputs visible.</p>
            </div>
            <span className="count-badge">{clipList.length}</span>
          </div>
          {clipList.length === 0 && (
            <div className="empty-state">
              Pin important clips to keep them here.
            </div>
          )}
          {clipList.map((clip) => {
            return (
              <div
                key={clip.id}
                draggable
                onDragStart={(event) => handleDragStart(event, clip.id)}
                onDragEnter={() => handleDragEnter(clip.id)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => e.preventDefault()}
                style={{ cursor: 'grab' }}
              >
                <ClipCard
                  clip={clip}
                  onDelete={onDelete}
                  onTogglePin={onTogglePin}
                  onOpenImage={onOpenImage}
                  onOpenClip={onOpenClip}
                  onUpdateClip={onUpdateClip}
                  selected={selectedClipIds.includes(clip.id)}
                  onSelect={onSelectClip}
                />
              </div>
            );
          })}
        </section>
      );
    } else {
      const groupedByType = clipList.reduce((acc, clip) => {
        const type = clip.type;
        if (!acc[type]) acc[type] = [];
        acc[type].push(clip);
        return acc;
      }, {} as Record<string, Clip[]>);

      const typeLabels: Record<string, string> = {
        image: 'Image',
        html: 'HTML',
        dataframe: 'DataFrame',
        text: 'Text',
      };

      return (
        <section className="deck-section recent-section">
          <div className="section-header">
            <div>
              <h2>Recent Clips</h2>
              <p>Saved outputs in timeline order.</p>
            </div>
            <span className="count-badge">{clipList.length}</span>
          </div>
          {clipList.length === 0 && (
            <div className="empty-state">
              Add a notebook cell output to start the deck.
            </div>
          )}
          {Object.entries(groupedByType).map(([type, typeClips]) => (
            <div key={type} className="carousel-section">
              <h3 className="carousel-type-header">{typeLabels[type] || type} ({typeClips.length})</h3>
              <div className="carousel" ref={(el) => { carouselRefs.current[type] = el; }}>
                {typeClips.map((clip) => (
                  <div
                    key={clip.id}
                    className="carousel-item"
                    draggable
                    onDragStart={(event) => handleCarouselDragStart(event, type, clip.id)}
                    onDragEnter={() => handleCarouselDragEnter(type, clip.id)}
                    onDragEnd={() => handleCarouselDragEnd()}
                    onDragOver={(e) => e.preventDefault()}
                    style={{ cursor: 'grab' }}
                  >
                    <ClipCard
                      clip={clip}
                      onDelete={onDelete}
                      onTogglePin={onTogglePin}
                      onOpenImage={onOpenImage}
                      onOpenClip={onOpenClip}
                      onUpdateClip={onUpdateClip}
                      selected={selectedClipIds.includes(clip.id)}
                      onSelect={onSelectClip}
                      isCarousel={true}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      );
    }
  };

  return (
    <div className="deck">
      {renderClipList(pinnedClips, true)}
      {renderClipList(recentClips)}
    </div>
  );
}

export default Deck;
