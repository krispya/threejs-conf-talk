import { useQueryFirst, useTarget, useTrait } from 'koota/react';
import { ActiveScreen, Screen, Timeline } from '../sim/index.js';

/** The opening sequence's branding slides away as the warp portal opens. */
export function BrandMark() {
  const timeline = useQueryFirst(Timeline);
  const screen = useTarget(timeline, ActiveScreen);
  const data = useTrait(screen, Screen);
  const hidden = !!data && (!data.titleVisible || data.warpVisible);

  return (
    <svg
      className="brand-mark"
      data-hidden={hidden}
      data-warp={data?.warpVisible ?? false}
      viewBox="0 0 100 100"
      role="img"
      aria-label="PMNDRS"
      aria-hidden={hidden}
    >
      <rect width="100" height="100" fill="#000000" />
      <rect x="41.5" y="29.5" width="27" height="41" fill="#ffffff" />
      <rect x="27" y="41.5" width="31" height="30" fill="#000000" />
      <path
        d="M28.75 43.75h12.5v12.5h-12.5z M43.75 43.75h12.5v12.5h-12.5z M43.75 58.75h12.5v12.5h-12.5z"
        fill="#ffffff"
      />
    </svg>
  );
}
