import { SET_USER, SET_USER_DATA } from '../actions/auth.js';

const auth = (state = {}, action) => {
  switch (action.type) {
    case SET_USER:
      return {
        ...state,
        user: action.user,
        initialized: true,
        signedIn: !!action.user
      };
    case SET_USER_DATA:
      return {
        ...state,
        user: {
          ...state.user,
          ...action.userData
        }
      };
    default:
      return state;
  }
};

export default auth;