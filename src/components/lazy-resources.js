import './qspot-404.js';
import './snack-bar.js';
import { store } from '../store.js';
import { installPlayer } from '../player.js';
import player from '../reducers/player.js';
import { setPassiveTouchGestures } from '@polymer/polymer/lib/utils/settings.js';

store.addReducers({
  player
});
installPlayer(store);

// To force all event listeners for gestures to be passive.
// See https://www.polymer-project.org/2.0/docs/devguide/gesture-events#use-passive-gesture-listeners
setPassiveTouchGestures(true);