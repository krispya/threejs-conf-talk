import { useActions } from 'koota/react';
import { useEffect } from 'react';
import { actions } from './actions.js';
import { screens } from './timeline/screens.js';

export function Startup() {
  const { createTimeline, startTimeline, destroyTimeline } = useActions(actions);

  useEffect(() => {
    const timeline = createTimeline(screens);
    startTimeline(timeline);
    return () => destroyTimeline(timeline);
  }, [createTimeline, startTimeline, destroyTimeline]);

  return null;
}
