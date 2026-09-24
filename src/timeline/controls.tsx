import { useActions } from 'koota/react';
import { useEffect } from 'react';
import { actions } from '../actions.js';

export function TimelineControls() {
  const { next, previous, toggleSound } = useActions(actions);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey)
        return;
      if (
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable || event.target.closest('input, textarea, select, button, a'))
      )
        return;

      if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.code === 'Space') {
        event.preventDefault();
        next();
      } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault();
        previous();
      } else if (event.key === 'm' || event.key === 'M') {
        toggleSound();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [next, previous, toggleSound]);

  return null;
}
