import { useThree } from '@react-three/fiber/webgpu';
import { useLayoutEffect } from 'react';

/** Keep the drawing buffer at most this many pixels wide, so retina and 4K outputs render like 1080p. */
export function ResolutionCap({ width }: { width: number }) {
  const size = useThree((state) => state.size);
  const setDpr = useThree((state) => state.setDpr);
  useLayoutEffect(() => {
    setDpr(Math.min(window.devicePixelRatio, width / size.width));
  }, [size.width, width, setDpr]);
  return null;
}
