import { Audio, Video } from '@remotion/media';
import { TransitionSeries } from '@remotion/transitions';
import { AbsoluteFill, staticFile } from 'remotion';

export function Promo() {
  return (
    <AbsoluteFill style={{ backgroundColor: '#000000' }}>
      <Audio src={staticFile('promo-beat.wav')} volume={0.8} />
      <TransitionSeries>
        <TransitionSeries.Sequence name="Robot entrance · red eyes" durationInFrames={90}>
          <Video
            objectFit="cover"
            src={staticFile('source.mp4')}
            trimBefore={1260}
            playbackRate={1.5}
            muted
          />
        </TransitionSeries.Sequence>
        <TransitionSeries.Sequence name="Warp launch · tunnel" durationInFrames={90}>
          <Video objectFit="cover" src={staticFile('source.mp4')} trimBefore={1530} muted />
        </TransitionSeries.Sequence>
        <TransitionSeries.Sequence name="Portal dive · PMNDRS reveal" durationInFrames={120}>
          <Video
            objectFit="cover"
            src={staticFile('source.mp4')}
            trimBefore={1620}
            playbackRate={0.95}
            muted
          />
        </TransitionSeries.Sequence>
        <TransitionSeries.Sequence name="Hello · the PMNDRS mark" durationInFrames={90}>
          <Video
            objectFit="cover"
            src={staticFile('later-scenes.mp4')}
            trimBefore={1638}
            playbackRate={0.65}
            muted
          />
        </TransitionSeries.Sequence>
        <TransitionSeries.Sequence name="Community · showreel wall" durationInFrames={120}>
          <Video
            objectFit="cover"
            src={staticFile('later-scenes.mp4')}
            trimBefore={2520}
            playbackRate={1.125}
            muted
          />
        </TransitionSeries.Sequence>
        <TransitionSeries.Sequence name="Principles shatter into the mark" durationInFrames={120}>
          <Video
            objectFit="cover"
            src={staticFile('later-scenes.mp4')}
            trimBefore={4410}
            playbackRate={1.5}
            muted
          />
        </TransitionSeries.Sequence>
        <TransitionSeries.Sequence name="Black hole · collapse and escape" durationInFrames={180}>
          <Video objectFit="cover" src={staticFile('later-scenes.mp4')} trimBefore={5310} muted />
        </TransitionSeries.Sequence>
        <TransitionSeries.Sequence name="Stone portal · arrival" durationInFrames={150}>
          <Video objectFit="cover" src={staticFile('later-scenes.mp4')} trimBefore={5850} muted />
        </TransitionSeries.Sequence>
        <TransitionSeries.Sequence name="Stone portal · Glyph finale" durationInFrames={120}>
          <Video
            objectFit="cover"
            src={staticFile('later-scenes.mp4')}
            trimBefore={6126}
            playbackRate={0.5}
            muted
          />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
}
