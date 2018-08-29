let actionHandler;
const player = () => _ => next => action => {
  actionHandler ? actionHandler(next, action) : next(action);
};

export const subscribe = (callback) => {
  actionHandler = callback;
};

export default player;