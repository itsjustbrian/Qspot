import { createSelector } from 'reselect';
import { userSelector } from './auth.js';
import { RECEIVE_PARTY } from '../actions/party.js';
import { SET_USER } from '../actions/auth.js';

const party = (state = {}, action) => {
  switch (action.type) {
    case RECEIVE_PARTY:
      return {
        ...state,
        item: action.item
      };
    case SET_USER: {
      const currentParty = action.user && action.user.currentParty;
      return {
        ...state,
        id: currentParty,
        ...state.id !== currentParty && { item: null }
      };
    }
    default:
      return state;
  }
};

export default party;

export const currentPartySelector = state => state.party.id;
export const partyDataSelector = state => state.party.item;
export const currentUserIsHostSelector = createSelector(
  partyDataSelector,
  userSelector,
  (partyData, user) => partyData && user && partyData.host === user.id
);

