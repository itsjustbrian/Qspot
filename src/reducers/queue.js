import { createSelector } from 'reselect';
import { RECEIVE_QUEUE, RECEIVE_QUEUE_TRACK_DATA } from '../actions/queue.js';
import { REQUEST_TRACK, RECEIVE_TRACK, FAIL_TRACK } from '../actions/track.js';

const queue = (state = { items: {}, trackDataById: {} }, action) => {
  switch (action.type) {
    case RECEIVE_QUEUE:
      return {
        ...state,
        itemsList: action.items.map((item) => item.id),
        items: action.items.reduce((obj, item) => {
          obj[item.id] = {
            submitterName: item.submitterName,
            loading: true
          };
          return obj;
        }, {}),
      };
    case REQUEST_TRACK:
      return {
        ...state,
        items: {
          ...state.items,
          [action.id]: {
            ...state.items[action.id],
            loading: true
          }
        }
      };
    case RECEIVE_TRACK:
      return {
        ...state,
        trackDataById: {
          ...state.trackDataById,
          [action.id]: {
            name: action.track.name,
            artists: action.track.artists.map((artist) => ({ name: artist.name }))
          }
        },
        items: {
          ...state.items,
          [action.id]: {
            ...state.items[action.id],
            loading: false
          }
        }
      };
    case FAIL_TRACK:
      return {
        ...state,
        items: {
          ...state.items,
          [action.id]: {
            ...state.items[action.id],
            loading: false,
            failure: true
          }
        }
      };
    default:
      return state;
  }
};

export default queue;

export const queueItemsSelector = state => state.queue.items;
export const queueItemsListSelector = state => (state.queue && state.queue.itemsList) || [];
export const queueTrackDataSelector = state => (state.queue && state.queue.trackDataById) || {};

export const queueSelector = createSelector(
  queueItemsListSelector,
  queueItemsSelector,
  queueTrackDataSelector,
  (itemsList, items, trackDataById) => itemsList.map((id) => {
    const trackData = trackDataById[id];
    return {
      id,
      ...items[id],
      ...!!trackData && { track: trackData }
    };
  })
);