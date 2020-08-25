import { createSelector } from 'reselect';
import { RECEIVE_MY_TRACKS, MY_TRACKS_ORIGIN } from '../actions/my-tracks.js';
import { RECEIVE_TRACK, FAIL_TRACK } from '../actions/track.js';
import { partyMembersSelector } from './members.js';
import { userIdSelector } from './auth.js';

const myTracks = (state = { trackDataById: {} }, action) => {
  switch (action.type) {
    case RECEIVE_MY_TRACKS:
      return {
        ...state,
        itemsList: action.items.map((item) => item.id),
        items: action.items.reduce((obj, item) => {
          obj[item.id] = item;
          return obj;
        }, {}),
      };
    case RECEIVE_TRACK:
      return action.origin === MY_TRACKS_ORIGIN ? {
        ...state,
        trackDataById: {
          ...state.trackDataById,
          [action.id]: {
            name: action.track.name,
            artists: action.track.artists.map((artist) => ({ name: artist.name }))
          }
        }
      } : state;
    case FAIL_TRACK:
      return action.origin === MY_TRACKS_ORIGIN ? {
        ...state,
        items: {
          ...state.items,
          [action.id]: {
            ...state.items[action.id],
            failure: true
          }
        }
      } : state;
    default:
      return state;
  }
};

export default myTracks;

export const myTracksItemsSelector = state => state.myTracks.items;
export const myTracksItemsListSelector = state => state.myTracks && state.myTracks.itemsList;
export const myTracksDataSelector = state => state.myTracks && state.myTracks.trackDataById;

export const myTracksQueuePositionsSelector = createSelector(
  myTracksItemsListSelector,
  myTracksItemsSelector,
  partyMembersSelector,
  userIdSelector,
  (itemsList, items, members, currentUserId) => {
    if (!currentUserId || !members || !itemsList || !members[currentUserId]) return null;
    const currentUserMemberData = members[currentUserId];
    return itemsList.reduce((obj, id) => {
      const item = items[id];
      // If this is the X'th track we've submitted, then the position is at least (X - number of tracks played)
      let positionInQueue = item.trackNumber - currentUserMemberData.numTracksPlayed;
      for (const [id, member] of Object.entries(members)) {
        if (id === currentUserId) continue;
        if (member.numTracksAdded >= item.trackNumber) {
          // We know at least (trackNumber - 1) tracks submitted by this member are ahead of the track we're looking at
          let numTracksInFront = item.trackNumber - 1;

          // In this case where, for example, we are looking at the user's X'th track, and this member also has a X'th track,
          // we need to compare their ordering numbers to find out who comes first
          if (member.timeFirstTrackAdded < currentUserMemberData.timeFirstTrackAdded) {
            numTracksInFront++;
          }

          // If these tracks have been played, they aren't in front anymore
          numTracksInFront -= member.numTracksPlayed;
          positionInQueue += numTracksInFront > 0 ? numTracksInFront : 0;
        } else
          positionInQueue += member.numTracksAdded - member.numTracksPlayed;
      }

      obj[id] = positionInQueue;
      return obj;
    }, {});
  }
);

export const myTracksSelector = createSelector(
  myTracksItemsListSelector,
  myTracksItemsSelector,
  myTracksDataSelector,
  myTracksQueuePositionsSelector,
  (itemsList, items, trackDataById, queuePositions) => itemsList ? itemsList.map((id) => {
    const trackData = trackDataById[id];
    return {
      id,
      ...items[id],
      ...!!trackData && { track: trackData },
      ...queuePositions && { positionInQueue: queuePositions[id] }
    };
  }) : []
);