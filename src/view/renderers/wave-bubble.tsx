import { useEffect, useMemo, type Ref } from 'react';
import { CanvasTexture, Shape, SRGBColorSpace, type Group, type Node } from 'three/webgpu';
import { brand, ramp } from '../../theme.js';

export function WaveBubble({ opacity, handRef }: { opacity: Node<'float'>; handRef: Ref<Group> }) {
  const shadowOpacity = useMemo(() => opacity.mul(0.16), [opacity]);
  const shape = useMemo(() => {
    const shape = new Shape();
    shape.moveTo(-0.3, -0.43);
    shape.lineTo(-0.42, -0.7);
    shape.quadraticCurveTo(-0.12, -0.64, 0.04, -0.43);
    shape.lineTo(0.3, -0.43);
    shape.quadraticCurveTo(0.55, -0.43, 0.55, -0.18);
    shape.lineTo(0.55, 0.18);
    shape.quadraticCurveTo(0.55, 0.43, 0.3, 0.43);
    shape.lineTo(-0.3, 0.43);
    shape.quadraticCurveTo(-0.55, 0.43, -0.55, 0.18);
    shape.lineTo(-0.55, -0.18);
    shape.quadraticCurveTo(-0.55, -0.43, -0.3, -0.43);
    shape.closePath();
    return shape;
  }, []);
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const context = canvas.getContext('2d')!;
    context.font = '180px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('👋', 128, 138);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <>
      <mesh position={[0.035, -0.045, -0.02]}>
        <shapeGeometry args={[shape, 20]} />
        <meshBasicNodeMaterial
          color={brand.dark}
          opacityNode={shadowOpacity}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh>
        <shapeGeometry args={[shape, 20]} />
        <meshBasicNodeMaterial
          color={ramp['light-25']}
          opacityNode={opacity}
          transparent
          toneMapped={false}
        />
      </mesh>
      <group ref={handRef} position={[0, -0.06, 0.02]}>
        <mesh position={[0, 0.06, 0]}>
          <planeGeometry args={[0.78, 0.78]} />
          <meshBasicNodeMaterial
            map={texture}
            opacityNode={opacity}
            transparent
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>
    </>
  );
}
