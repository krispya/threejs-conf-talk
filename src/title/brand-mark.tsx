import { useActiveScreen } from '../timeline/hooks.js';

/** The opening sequence's branding slides away as the warp portal opens and returns for the send off. */
export function BrandMark() {
  const { data } = useActiveScreen();
  const hidden = !!data && ((!data.titleVisible && !data.closingVisible) || data.warpVisible);

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
      <path
        d="M43.75 28.75h27.5v27.5h-12.5v-15h-15z M28.75 43.75h12.5v12.5h-12.5z M43.75 43.75h12.5v12.5h-12.5z M43.75 58.75h12.5v12.5h-12.5z"
        fill="#ffffff"
      />
    </svg>
  );
}
