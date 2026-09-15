import './index.css';
import { Composition } from 'remotion';
import { Promo } from './Composition';

export const RemotionRoot = () => {
  return (
    <Composition
      id="Promo"
      component={Promo}
      durationInFrames={1080}
      fps={60}
      width={1920}
      height={1286}
    />
  );
};
