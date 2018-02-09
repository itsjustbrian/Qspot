import request from './request.js';
import { tokenManager } from './token-manager.js';

export async function getSpotifyTrackData(trackId) {
  const options = {
    url: `https://api.spotify.com/v1/tracks/${trackId}`
  };

  try {
    return await _spotifyRequest(options);
  } catch (error) {
    throw new Error(`Unexpected error getting track data: ${error.message}`);
  }
}

export async function searchSpotifyForTracks(query) {
  const options = {
    url: `https://api.spotify.com/v1/search?q=${query}&limit=10&type=track&best_match=true&market=US`
  };

  try {
    const response = await _spotifyRequest(options);
    console.log('Got tracks', response.tracks.items);
    return response.tracks.items;
  } catch (error) {
    throw new Error(`Unexpected error searching for tracks: ${error.message}`);
  }
}

export function toSpotifySearchQuery(input) {
  /* Check if last 2 characters of query are alphanumueric,
     and if so, add wildcard to query. Wildcards improve search
     results but can produce errors without this precaution */
  if (input.length > 2 && /^[a-zA-Z0-9]{2}$/.test(input.slice(-2))) {
    return input += '*';
  }
  return input;
}

async function _spotifyRequest(options) {
  const token = await tokenManager.getToken();
  options.headers = {
    Authorization: `Bearer ${token}`
  };
  let response;
  try {
    response = await request(options);
  } catch (error) {
    if (error.message === 'The access token expired') {
      const newToken = await tokenManager.getNewToken();
      options.headers.Authorization = `Bearer ${newToken}`;
      response = await request(options);
    } else {
      throw new Error(error.message);
    }
  }
  return response;
}