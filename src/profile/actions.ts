import { IsHidden, IsPresent, Size, Position, Rotation } from '../traits.js';
import { TransitionOrigin } from '../timeline/traits.js';
import { Anchor, Float } from '../floating/traits.js';
import { createActions, type Entity } from 'koota';
import { Profile, ProfileFocus, ProfilePresence } from './traits.js';

import { profiles } from './data.js';
import { random } from 'math/random';

export const profileActions = createActions((world) => {
  const createProfile = (login: string, avatar: string, index: number, depthIndex = index) =>
    world.spawn(
      Profile({ login, avatar, index }),
      ProfileFocus,
      ProfilePresence,
      IsHidden,
      Size({ radius: 0.55 + (index % 4) * 0.07 }),
      Position,
      TransitionOrigin,
      Rotation,
      // Separate depth layers leave room for the float orbit and tilted portrait edges
      Anchor({ z: -13 - depthIndex * 0.45 }),
      Float({
        phase: index * 2.4,
        speed: 0.3 + (index % 3) * 0.08,
        amplitude: 0.16,
        tilt: 0.06,
      })
    );
  /** Toggle visibility and capture the fade the view animates from its current value. */
  const show = (entity: Entity, visible: boolean, focusing = false) => {
    if (visible) {
      entity.remove(IsHidden);
      if (!entity.has(IsPresent)) entity.add(IsPresent);
    } else entity.add(IsHidden);
    const presence = entity.get(ProfilePresence);
    if (presence) {
      entity.set(ProfilePresence, { from: presence.value, target: visible ? 1 : 0, focusing });
    }
  };
  return {
    setProfilePresentation: ({
      profilesVisible,
      focusedProfile,
      surroundingProfiles,
      recedingProfiles,
      continuingDeparture,
      fromTeam,
    }: {
      profilesVisible: boolean;
      focusedProfile: string;
      surroundingProfiles: readonly string[];
      recedingProfiles: readonly string[];
      continuingDeparture: boolean;
      fromTeam: boolean;
    }) => {
      for (const entity of world.query(Profile)) {
        const login = entity.get(Profile)!.login;
        const focused = focusedProfile === login;
        const slot = surroundingProfiles.indexOf(login);
        // Portraits that already told their story keep their ring and drop behind the
        // ones arriving in front
        const receded = recedingProfiles.includes(login);
        const held = focused || slot >= 0 || receded;
        const focus = entity.get(ProfileFocus);
        if (focus) {
          entity.set(ProfileFocus, {
            from: focus.value,
            to: held ? 1 : 0,
            slot: focused ? -1 : slot >= 0 ? slot : focus.slot,
            count: slot >= 0 ? surroundingProfiles.length : focus.count,
            recedeFrom: focus.recede,
            recedeTo: receded ? 1 : 0,
            wanderFromX: continuingDeparture ? focus.wanderFromX : focus.wanderX,
            wanderFromY: continuingDeparture ? focus.wanderFromY : focus.wanderY,
            wanderFromOpacity: continuingDeparture ? focus.wanderFromOpacity : focus.wanderOpacity,
            scaleFrom: focus.scale,
            fromTeam,
          });
        }
        // A screen that names no portraits shows everyone, otherwise only the named ones
        const everyone =
          !focusedProfile && surroundingProfiles.length === 0 && recedingProfiles.length === 0;
        show(
          entity,
          profilesVisible && (everyone || held),
          Boolean(focusedProfile || surroundingProfiles.length)
        );
      }
    },

    setProfilesVisible: (visible: boolean) => {
      for (const entity of world.query(Profile)) show(entity, visible);
    },
    createProfile,
    createProfiles: () => {
      // Shuffle depth slots independently of the portrait layout.
      const depths = profiles.map((_, index) => index);
      return profiles.map((profile, index) => {
        const [depth] = depths.splice(random.int(Math.random, 0, depths.length - 1), 1);
        return createProfile(profile.login, profile.avatar, index, depth);
      });
    },
  };
});
