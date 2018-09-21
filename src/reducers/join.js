import { SUCCEED_JOIN_PARTY, FAIL_JOIN_PARTY } from '../actions/join';

const join = (state = {}, action) => {
  switch (action.type) {
    case SUCCEED_JOIN_PARTY:
      return {
        ...state,
        failure: false
      };
    case FAIL_JOIN_PARTY:
      return {
        ...state,
        failure: true,
        error: action.error
      };
    default:
      return state;
  }
};

export default join;