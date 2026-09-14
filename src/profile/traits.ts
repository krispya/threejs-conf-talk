import { trait } from 'koota';

export const Profile = trait({ login: '', avatar: '', index: 0 });
export const ProfileFocus = trait({
  value: 0,
  from: 0,
  to: 0,
  slot: -1,
  count: 0,
  scale: 1,
  scaleFrom: 1,
  fromTeam: false,
  // How far a portrait has dropped behind the newcomers, from 0 in front to 1 receded
  recede: 0,
  recedeFrom: 0,
  recedeTo: 0,
  wanderX: 0,
  wanderY: 0,
  wanderFromX: 0,
  wanderFromY: 0,
  wanderOpacity: 1,
  wanderFromOpacity: 1,
});
