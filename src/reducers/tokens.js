import { createSelector } from 'reselect';
import {
  REQUEST_NEW_CLIENT_TOKEN,
  RECEIVE_NEW_CLIENT_TOKEN,
  FAIL_NEW_CLIENT_TOKEN,
  RECEIVE_CLIENT_TOKEN_FROM_LISTENER
} from "../actions/tokens";

const tokens = (state = {}, action) => {
  switch (action.type) {
    case REQUEST_NEW_CLIENT_TOKEN:
      return {
        ...state,
        clientToken: {
          ...state.clientToken,
          failure: false,
          isFetching: true
        }
      };
    case RECEIVE_NEW_CLIENT_TOKEN:
      return {
        ...state,
        clientToken: {
          ...state.clientToken,
          value: action.token,
          failure: false,
          isFetching: false
        }
      };
    case FAIL_NEW_CLIENT_TOKEN:
      return {
        ...state,
        clientToken: {
          ...state.clientToken,
          failure: true,
          isFetching: false
        }
      };
    case RECEIVE_CLIENT_TOKEN_FROM_LISTENER:
      return {
        ...state,
        clientToken: {
          ...state.clientToken,
          value: action.token,
          listenerAttached: true
        }
      };
    default:
      return state;
  }
};

export default tokens;

export const clientTokenListenerAttachedSelector = state => state.tokens.clientToken && state.tokens.clientToken.listenerAttached;
export const clientTokenSelector = state => state.tokens.clientToken && state.tokens.clientToken.value;