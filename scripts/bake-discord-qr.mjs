import { mkdir } from 'node:fs/promises';
import QRCode from 'qrcode';

// Bake the Poimandres Discord invite as black modules on a transparent ground, so the closing
// screen's cyan backdrop supplies the contrast and quiet zone.
const output = new URL('../public/closing/', import.meta.url);
await mkdir(output, { recursive: true });
await QRCode.toFile(new URL('discord-qr.png', output).pathname, 'https://discord.gg/poimandres', {
  errorCorrectionLevel: 'M',
  width: 1024,
  margin: 0,
  color: { dark: '#000000ff', light: '#00000000' },
});
