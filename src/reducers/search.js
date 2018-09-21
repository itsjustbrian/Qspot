import { createSelector } from 'reselect';
import { SET_QUERY, REQUEST_SEARCH_TRACKS, RECEIVE_SEARCH_TRACKS } from '../actions/search.js';
import { UPDATE_LOCATION } from '../actions/app.js';

const search = (state = {}, action) => {
  switch (action.type) {
    case SET_QUERY:
      return {
        ...state,
        query: action.query
      };
    case REQUEST_SEARCH_TRACKS:
      return {
        ...state,
        requestedQuery: action.query,
        failure: false,
        isFetching: true
      };
    case RECEIVE_SEARCH_TRACKS:
      return {
        ...state,
        resultsList: action.results.map((track) => track.id),
        trackDataById: action.results.reduce((obj, track) => {
          obj[track.id] = {
            name: track.name,
            artists: track.artists.map((artist) => ({ name: artist.name }))
          };
          return obj;
        }, {}),
        failure: false,
        isFetching: false
      };
    case UPDATE_LOCATION:
      return {
        ...state,
        query: state.query || action.params.get('q') || ''
      };
    default:
      return state;
  }
};

export default search;

export const requestedQuerySelector = state => state.search.requestedQuery;
export const searchTracksDataSelector = state => (state.search && state.search.trackDataById) || {};
export const resultsListSelector = state => (state.search && state.search.resultsList) || [];

export const searchResultsSelector = createSelector(
  resultsListSelector,
  searchTracksDataSelector,
  (resultsList, trackDataById) => resultsList.map((id) => ({ id, ...trackDataById[id] }))
);
