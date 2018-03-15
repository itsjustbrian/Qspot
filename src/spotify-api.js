import request from './request.js';
import { tokenManager } from './spotify-token-manager.js';
import { currentUser } from './firebase-loader.js';

export async function getSpotifyTrackData(trackId) {
  const options = {
    url: `https://api.spotify.com/v1/tracks/${trackId}`
  };

  return await _spotifyRequest(options);
}

export async function searchSpotifyForTracks(query) {
  const options = {
    url: `https://api.spotify.com/v1/search?q=${query}&limit=10&type=track&best_match=true&market=US`
  };

  const response = await _spotifyRequest(options);
  console.log('Got tracks', response.tracks.items);
  return response.tracks.items;
}

export async function playTrackOnSpotify(trackId, deviceId) {
  console.log('playing using device id', deviceId);
  const deviceQueryParam = (deviceId || '') && `?device_id=${deviceId}`;
  const options = {
    userAuthenticated: true,
    url: `https://api.spotify.com/v1/me/player/play${deviceQueryParam}`,
    body: {
      uris: [`spotify:track:${trackId}`]
    },
    method: 'PUT'
  };

  const response = await _spotifyRequest(options);
  console.log('Played track', trackId, response);
}

export function toSpotifySearchQuery(input) {
  // Check if last 2 characters of query are alphanumueric,
  // and if so, add wildcard to query. Wildcards improve search
  // results but can produce errors without this precaution
  if (input.length > 2 && /^[a-zA-Z0-9]{2}$/.test(input.slice(-2))) {
    return input += '*';
  }
  return input;
}

async function _spotifyRequest(options) {
  if (options.userAuthenticated && !currentUser()) {
    throw new Error('Not authenticated');
  }

  if (options.userAuthenticated) {
    return await _userAuthenticatedSpotifyRequest(options);
  }

  // Should be if the user is logged in with spotify
  //if (currentUser()) {
  //  return await _userAuthenticatedSpotifyRequest(options);
  //}

  return await _clientAuthenticatedSpotifyRequest(options);
}

async function _userAuthenticatedSpotifyRequest(options) {
  const token = await tokenManager.getUserToken();
  return await _requestRetry(options, token, async () => {
    return await tokenManager.getNewUserToken();
  });
}

async function _clientAuthenticatedSpotifyRequest(options) {
  const token = await tokenManager.getClientToken();
  return await _requestRetry(options, token, async () => {
    return await tokenManager.getNewClientToken();
  });
}

async function _requestRetry(options, token, newTokenGetter) {
  options.headers = {
    Authorization: `Bearer ${token}`
  };
  let response;
  try {
    response = await request(options);
  } catch (error) {
    if (error.message === 'The access token expired') {
      const newToken = await newTokenGetter();
      options.headers.Authorization = `Bearer ${newToken}`;
      response = await request(options);
    } else {
      throw error;
    }
  }
  return response;
}
