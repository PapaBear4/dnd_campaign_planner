import React, { useRef, useState, useCallback, useEffect } from 'react';

interface UseTapestryPanOptions {
  canvasScrollRef: React.RefObject<HTMLDivElement | null>;
  disabled?: boolean;
}

export function useTapestryPan({ canvasScrollRef, disabled = false }: UseTapestryPanOptions) {
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  const isMouseDownRef = useRef(false);
  const isPanningRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  const hasDraggedRef = useRef(false);
  const spacePressedRef = useRef(false);

  // Helper to determine if an element is interactive and should handle its own click/drag
  const isInteractiveTarget = useCallback((target: HTMLElement | null): boolean => {
    if (!target) return false;

    // Standard HTML interactive elements
    if (target.closest('button, input, select, textarea, a, [role="button"]')) {
      return true;
    }

    // Encounter cards (draggable cards with their own card drag/click logic)
    if (target.closest('.tapestry-encounter-card')) {
      return true;
    }

    // Milestone sync receiver cards
    if (target.closest('.tapestry-milestone-sync-card')) {
      return true;
    }

    // Quest reordering drag handles
    if (target.closest('.quest-drag-handle, [data-drag-handle="true"]')) {
      return true;
    }

    // Left sticky column quest header cards
    if (target.closest('.tapestry-quest-header-card')) {
      return true;
    }

    // Top session header cards & arc banner cards
    if (target.closest('.tapestry-session-header-card, .tapestry-arc-banner-card')) {
      return true;
    }

    // Any modal, popup, or context menu
    if (target.closest('.modal, .context-menu, [data-no-pan="true"]')) {
      return true;
    }

    return false;
  }, []);

  // Listen for Spacebar key to allow Space+Drag canvas panning
  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing inside text fields
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      const isEditable = document.activeElement?.getAttribute('contenteditable') === 'true';
      if (activeTag === 'input' || activeTag === 'textarea' || isEditable) {
        return;
      }

      if (e.code === 'Space' && !spacePressedRef.current) {
        spacePressedRef.current = true;
        setIsSpacePressed(true);
        // Prevent default spacebar scrolling
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spacePressedRef.current = false;
        setIsSpacePressed(false);
      }
    };

    const handleBlur = () => {
      spacePressedRef.current = false;
      setIsSpacePressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [disabled]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;

      const isLeftClick = e.button === 0;
      const isMiddleClick = e.button === 1;

      // Only respond to left-click or middle-click
      if (!isLeftClick && !isMiddleClick) return;

      const target = e.target as HTMLElement;

      // When left-clicking, if not holding space, ignore clicks on interactive elements
      if (isLeftClick && !spacePressedRef.current && isInteractiveTarget(target)) {
        return;
      }

      // Middle-click prevents the browser's autoscroll circle icon
      if (isMiddleClick || spacePressedRef.current) {
        e.preventDefault();
      }

      const container = canvasScrollRef.current;
      if (!container) return;

      isMouseDownRef.current = true;
      isPanningRef.current = false;
      hasDraggedRef.current = false;

      startPosRef.current = {
        x: e.clientX,
        y: e.clientY,
        scrollLeft: container.scrollLeft,
        scrollTop: container.scrollTop,
      };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isMouseDownRef.current) return;

        const dx = moveEvent.clientX - startPosRef.current.x;
        const dy = moveEvent.clientY - startPosRef.current.y;

        // Apply a drag threshold (3px) so simple clicks aren't captured as drags
        if (!isPanningRef.current) {
          if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            isPanningRef.current = true;
            hasDraggedRef.current = true;
            setIsPanning(true);
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'grabbing';
          }
        }

        if (isPanningRef.current && canvasScrollRef.current) {
          canvasScrollRef.current.scrollLeft = startPosRef.current.scrollLeft - dx;
          canvasScrollRef.current.scrollTop = startPosRef.current.scrollTop - dy;
        }
      };

      const handleMouseUp = () => {
        isMouseDownRef.current = false;
        const didDrag = hasDraggedRef.current;

        if (isPanningRef.current) {
          isPanningRef.current = false;
          setIsPanning(false);
        }

        document.body.style.userSelect = '';
        document.body.style.cursor = '';

        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);

        // If a drag actually occurred, swallow the subsequent click event to avoid accidental triggers
        if (didDrag) {
          const captureClick = (clickEvent: MouseEvent) => {
            clickEvent.stopPropagation();
            clickEvent.preventDefault();
            window.removeEventListener('click', captureClick, true);
          };
          window.addEventListener('click', captureClick, true);
          setTimeout(() => {
            window.removeEventListener('click', captureClick, true);
          }, 50);
        }
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [canvasScrollRef, disabled, isInteractiveTarget]
  );

  // Clean up any stray body styles if component unmounts while panning
  useEffect(() => {
    return () => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, []);

  return {
    isPanning,
    isSpacePressed,
    handleMouseDown,
  };
}
