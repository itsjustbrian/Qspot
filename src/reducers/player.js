import { createSelector } from 'reselect';
import {
  RECEIVE_NEXT_TRACK,
  PLAYER_READY,
  PLAYER_STATE_CHANGED,
  PAUSE_PLAYER,
  RESUME_PLAYER,
  PLAYER_DISCONNECTED,
  PLAYER_NOT_READY,
  GET_CONNECTED_DEVICES
} from '../actions/player';

const player = (state = {}, action) => {
  switch (action.type) {
    case GET_CONNECTED_DEVICES:
      return {
        ...state,
        connectedDevices: action.devices.map((device) => ({
          id: device.id,
          name: device.name,
          isActive: device.is_active
        }))
      };
    case PLAYER_READY:
      return {
        ...state,
        deviceId: action.deviceId,
        ready: true,
        loaded: true,
      };
    case PLAYER_NOT_READY:
      return {
        ...state,
        ready: false
      };
    case RECEIVE_NEXT_TRACK:
      return {
        ...state,
        nextTrack: action.item && {
          id: action.item.id,
          submitterId: action.item.submitterId
        }
      };
    case PLAYER_STATE_CHANGED:
      return {
        ...state,
        playbackState: action.playbackState
      };
    case PLAYER_DISCONNECTED:
    case PAUSE_PLAYER:
    case RESUME_PLAYER:
      return {
        ...state,
        playbackState: playbackState(state.playbackState, action)
      };
    default:
      return state;
  }
};

const playbackState = (state, action) => {
  switch (action.type) {
    case PLAYER_DISCONNECTED:
    case PAUSE_PLAYER:
      return {
        ...state,
        paused: true
      };
    case RESUME_PLAYER:
      return {
        ...state,
        paused: false
      };
    default:
      return state;
  }
};

export default player;

export const playbackStateSelector = state => state.player && state.player.playbackState;
export const playerLoadedSelector = state => state.player && state.player.loaded;
export const connectedDevicesSelector = state => state.player && state.player.connectedDevices;

export const qspotDeviceIsConnectedSelector = createSelector(
  connectedDevicesSelector,
  (devices) => devices.some((device) => device.name === 'Qspot')
);