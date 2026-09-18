import React, { useEffect, useRef } from 'react';

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Adjust coordinates if overflowing viewport
  const menuWidth = 190;
  const menuHeight = items.length * 36 + 16;
  const adjX = Math.min(x, window.innerWidth - menuWidth - 10);
  const adjY = Math.min(y, window.innerHeight - menuHeight - 10);

  return (
    <div
      ref={menuRef}
      className="glass-panel animate-scale-up"
      style={{
        position: 'fixed',
        left: adjX,
        top: adjY,
        width: `${menuWidth}px`,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-medium)',
        borderRadius: '10px',
        boxShadow: '0 12px 30px rgba(0, 0, 0, 0.65)',
        padding: '6px',
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, idx) => (
        <button
          key={idx}
          type="button"
          disabled={item.disabled}
          onClick={() => {
            onClose();
            item.onClick();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
            padding: '7px 10px',
            border: 'none',
            borderRadius: '6px',
            background: 'transparent',
            color: item.danger ? '#ef4444' : 'var(--text-primary)',
            fontSize: '0.8rem',
            fontWeight: 500,
            cursor: item.disabled ? 'not-allowed' : 'pointer',
            opacity: item.disabled ? 0.4 : 1,
            textAlign: 'left',
            transition: 'background 0.1s ease',
          }}
          onMouseEnter={(e) => {
            if (!item.disabled) e.currentTarget.style.background = 'var(--bg-card-hover)';
          }}
          onMouseLeave={(e) => {
            if (!item.disabled) e.currentTarget.style.background = 'transparent';
          }}
        >
          {item.icon && <span style={{ display: 'flex', alignItems: 'center' }}>{item.icon}</span>}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
};
