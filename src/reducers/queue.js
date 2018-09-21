import { createSelector } from 'reselect';
import { RECEIVE_QUEUE, QUEUE_ORIGIN } from '../actions/queue.js';
import { RECEIVE_TRACK, FAIL_TRACK } from '../actions/track.js';

const queue = (state = { items: {}, trackDataById: {} }, action) => {
  switch (action.type) {
    case RECEIVE_QUEUE:
      return {
        ...state,
        itemsList: action.items.map((item) => item.id),
        items: action.items.reduce((obj, item) => {
          obj[item.id] = { submitterName: item.submitterName };
          return obj;
        }, {}),
      };
    case RECEIVE_TRACK:
      return action.origin === QUEUE_ORIGIN ? {
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
      return action.origin === QUEUE_ORIGIN ? {
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

export default queue;

export const queueItemsSelector = state => state.queue.items;
export const queueItemsListSelector = state => (state.queue && state.queue.itemsList) || [];
export const queueTracksDataSelector = state => (state.queue && state.queue.trackDataById) || {};

export const queueSelector = createSelector(
  queueItemsListSelector,
  queueItemsSelector,
  queueTracksDataSelector,
  (itemsList, items, trackDataById) => itemsList.map((id) => {
    const trackData = trackDataById[id];
    return {
      id,
      ...items[id],
      ...!!trackData && { track: trackData }
    };
  })
);