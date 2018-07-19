import request from './request.js';
import { tokenManager } from './spotify-token-manager.js';
import { currentUser } from './firebase-loader.js';

const DEFAULT_SEARCH_LIMIT = 10;

export async function getTrackData(trackId) {
  const options = {
    url: `https://api.spotify.com/v1/tracks/${trackId}`
  };

  return await _spotifyRequest(options);
}

// Note: search seems to have trouble with 1 or 2 letters at beggining
// or after space. Possible only when best match is true?
export async function searchForTracks(query, market, limit = DEFAULT_SEARCH_LIMIT) {
  const options = {
    url: `https://api.spotify.com/v1/search?q=${query}&limit=${limit}&type=track&best_match=true${market ? `&market=${market}` : ''}`
  };

  const response = await _spotifyRequest(options);
  console.log('Got tracks in search', response.tracks.items);
  return response.tracks.items;
}

// todo: playing on currently active device doesn't work
// if they don't have a compatible active device, need to check
// for active devices and default to web player or some other explicit device
export async function playTrack(trackId, deviceId) {
  console.log('Playing track using device id', deviceId);
  const deviceQueryParam = (deviceId || '') && `?device_id=${deviceId}`;
  const options = {
    userAuthenticated: true,
    url: `https://api.spotify.com/v1/me/player/play${deviceQueryParam}`,
    
    // If a trackId is provided, add the body
    ...!!trackId && {
      body: { uris: [`spotify:track:${trackId}`] }
    },
    method: 'PUT'
  };

  const response = await _spotifyRequest(options);
  console.log('Played track', trackId, response);
}

export async function pauseTrack(deviceId) {
  console.log('Pausing track');
  const deviceQueryParam = (deviceId || '') && `?device_id=${deviceId}`;
  const options = {
    userAuthenticated: true,
    url: `https://api.spotify.com/v1/me/player/pause${deviceQueryParam}`,
    method: 'PUT'
  };

  await _spotifyRequest(options);
  console.log('Paused');
}

export async function seekInTrack(position) {
  console.log('Seeking to position:', position);

  const positionParam = `?position_ms=${position}`;
  const options = {
    userAuthenticated: true,
    url: `https://api.spotify.com/v1/me/player/seek${positionParam}`,
    method: 'PUT'
  };

  return _spotifyRequest(options);
}

async function _spotifyRequest(options) {
  if (options.userAuthenticated && !currentUser()) {
    throw new Error('Not authenticated');
  }

  if (options.userAuthenticated) {
    return await _userAuthenticatedSpotifyRequest(options);
  }

  if (currentUser() && currentUser().claims.spotify) {
    return await _userAuthenticatedSpotifyRequest(options);
  }

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

export function toSearchQuery(input) {
  // Check if last 2 characters of query are alphanumueric,
  // and if so, add wildcard to query. Wildcards improve search
  // results but can produce errors without this precaution
  if (input.length > 2 && /^[a-zA-Z0-9]{2}$/.test(input.slice(-2))) {
    return input += '*';
  }
  return input;
}
