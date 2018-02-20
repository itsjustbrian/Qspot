import { getSpotifyTrackData, searchSpotifyForTracks } from './spotify-api.js';

const tracksMap = new Map();

export async function getTrackData(trackId) {
  if (tracksMap.has(trackId)) {
    const track = tracksMap.get(trackId);
    return track.data ? track.data : await track.dataPromise;
  } else {
    const trackDataPromise = getSpotifyTrackData(trackId);
    tracksMap.set(trackId, { dataPromise: trackDataPromise });
    const trackData = await trackDataPromise;
    console.log('Got track', trackData);
    tracksMap.set(trackId, { data: trackData });
    return trackData;
  }
}

export async function searchForTracks(query) {
  const tracks = await searchSpotifyForTracks(query);
  for (const track of tracks) {
    if (!tracksMap.has(track.id)) {
      tracksMap.set(track.id, { data: track });
    }
  }
  return tracks;
}