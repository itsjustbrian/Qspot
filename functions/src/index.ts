import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as req from 'request-promise-native';
import * as express from 'express';

const app = express();

admin.initializeApp(functions.config().firebase);

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_CLIENT_ID = functions.config().spotify.client_id;
const SPOTIFY_CLIENT_SECRET = functions.config().spotify.client_secret;
const SPOTIFY_ENCODED_AUTH = Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64');

exports.getSpotifyAccessToken = functions.https.onRequest(async (request, response) => {

  const tokenRequestOptions = {
    method: 'POST',
    uri: SPOTIFY_TOKEN_URL,
    form: {
      grant_type: 'client_credentials',
    },
    headers: {
      authorization: `Basic ${SPOTIFY_ENCODED_AUTH}`,
    },
    json: true,
    forever: true
  };

  try {
    const spotifyAuthResponse = await req(tokenRequestOptions);
    await saveSpotifyTokenToFirestore(spotifyAuthResponse.access_token);
    response.status(200).send(spotifyAuthResponse.access_token);
  } catch (error) {
    console.log(error.message);
    response.sendStatus(500);
  }
});

function saveSpotifyTokenToFirestore(token) {
  return admin.firestore().collection('metadata').doc('spotify').set({
    accessToken: token
  });
}
