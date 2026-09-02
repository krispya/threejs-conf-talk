import { LetterRenderer } from './renderers/letter-renderer.js';
import { PackageRenderer } from './renderers/package-renderer.js';

export function Renderers() {
  return (
    <>
      <LetterRenderer />
      <PackageRenderer />
    </>
  );
}
