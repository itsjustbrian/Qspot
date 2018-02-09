import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as req from 'request-promise-native';

admin.initializeApp(functions.config().firebase);

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_ID_SECRET = 'NzA2MjAzYjAxZDY5NDM0MGFlZDhiY2RmN2M1ZjljNDM6YjdmMjdkMWVlYTRhNDliYzg5MDVhMjZmODcxNmY0YjY=';

exports.getSpotifyAccessToken = functions.https.onRequest(async (request, response) => {

  const tokenRequestOptions = {
    method: 'POST',
    uri: SPOTIFY_TOKEN_URL,
    form: {
      grant_type: 'client_credentials',
    },
    headers: {
      authorization: `Basic ${SPOTIFY_ID_SECRET}`,
    },
    json: true,
    forever: true
  };

  const spotifyAuthResponse = await req(tokenRequestOptions);

  await saveSpotifyTokenToFirestore(spotifyAuthResponse.access_token);

  response.status(200).send(spotifyAuthResponse.access_token);
});

function saveSpotifyTokenToFirestore(token) {
  return admin.firestore().collection('metadata').doc('spotify').set({
    accessToken: token
  });
}
