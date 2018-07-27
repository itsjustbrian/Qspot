import { getTrackData as getSpotifyTrackData, searchForTracks as searchSpotifyForTracks } from './spotify-api.js';

const tracksMap = new Map();

export async function getTrackData(...args) {
  const trackId = args[0];
  if (tracksMap.has(trackId)) {
    const track = tracksMap.get(trackId);
    return track.data ? track.data : await track.dataPromise;
  } else {
    const trackDataPromise = getSpotifyTrackData(...args);
    tracksMap.set(trackId, { dataPromise: trackDataPromise });
    const trackData = await trackDataPromise;
    console.log('Got track', trackData);
    tracksMap.set(trackId, { data: trackData });
    return trackData;
  }
}

export async function searchForTracks(...args) {
  const tracks = await searchSpotifyForTracks(...args);
  for (const track of tracks) {
    if (!tracksMap.has(track.id)) {
      tracksMap.set(track.id, { data: track });
    }
  }
  return tracks;
}