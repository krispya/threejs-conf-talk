import { trait } from 'koota';

export const Position = trait({ x: 0, y: 0, z: 0 });
export const Rotation = trait({ x: 0, y: 0, z: 0 });
export const Size = trait({ radius: 1 });
export const IsHidden = trait();
// The view keeps the entity mounted and active from its entrance until its exit finishes
export const IsPresent = trait();
