import { RECEIVE_PARTY_MEMBERS } from '../actions/members';

const members = (state = {}, action) => {
  switch (action.type) {
    case RECEIVE_PARTY_MEMBERS:
      return {
        ...state,
        items: action.items.reduce((obj, item) => {
          obj[item.id] = item;
          return obj;
        }, {}),
      };
    default:
      return state;
  }
};

export default members;

export const partyMembersSelector = state => state.members.items;