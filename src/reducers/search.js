import { REQUEST_TRACKS, RECEIVE_TRACKS } from '../actions/search.js';
import { UPDATE_LOCATION } from '../actions/app.js';

const search = (state = {}, action) => {
  switch (action.type) {
    case REQUEST_TRACKS:
      return {
        ...state,
        requestedQuery: action.query,
        failure: false,
        isFetching: true
      };
    case RECEIVE_TRACKS:
      return {
        ...state,
        tracks: action.tracks,
        failure: false,
        isFetching: false
      };
    case UPDATE_LOCATION:
      return {
        ...state,
        query: (action.query || state.query)
      };
    default:
      return state;
  }
};

export default search;

export const requestedQuerySelector = state => state.search.requestedQuery;
