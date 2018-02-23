import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as express from 'express';
import * as cookieParser from 'cookie-parser';
import * as crypto from 'crypto';
import * as SpotifyWebApi from 'spotify-web-api-node';

const app = express();
app.use(cookieParser())

const serviceAccount = require('../../service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${process.env.GCLOUD_PROJECT}.firebaseio.com`,
});

const SPOTIFY_CLIENT_ID = functions.config().spotify.client_id;
const SPOTIFY_CLIENT_SECRET = functions.config().spotify.client_secret;
const SPOTIFY_AUTH_REDIRECT_URI = 'http://localhost:5000/login';
const OAUTH_SCOPES = ["streaming", "user-read-birthdate", "user-read-email", "user-read-private"];

const Spotify = new SpotifyWebApi({
  clientId: SPOTIFY_CLIENT_ID,
  clientSecret: SPOTIFY_CLIENT_SECRET,
  redirectUri: SPOTIFY_AUTH_REDIRECT_URI,
});

// todo: once supported in spotify-web-api-node, make spotify requests over persistant connection

app.get('/api/getSpotifyClientCredentials', async (request, response) => {
  try {
    const spotifyAuthResponse = await Spotify.clientCredentialsGrant();
    await saveSpotifyTokenToFirestore(spotifyAuthResponse.body['access_token']);
    response.status(200).json({ token: spotifyAuthResponse.body['access_token'] });
  } catch (error) {
    response.status(500).json(NetworkError(500, error.message));
  }
});

app.get('/api/createSpotifyAccount', async (request, response) => {
  try {
    console.log('Received verification state:', request.cookies.state);
    console.log('Received state:', request.query.state);
    if (!request.cookies.state) {
      throw new Error('State cookie not set or expired. Maybe you took too long to authorize. Please try again.');
    } else if (request.cookies.state !== request.query.state) {
      throw new Error('State validation failed');
    }
    console.log('Received auth code:', request.query.code);

    const authGrantResponse = await Spotify.authorizationCodeGrant(request.query.code);
    const accessToken = authGrantResponse.body['access_token'];
    console.log('Received Access Token:', accessToken);
    Spotify.setAccessToken(accessToken);

    const userResults = await Spotify.getMe();
    console.log('Auth code exchange result received:', userResults);
    // We have a Spotify access token and the user identity now.
    const userId = userResults.body['id'];
    const userImages = userResults.body['images'];
    const profilePic = userImages.length ? userImages[0].url : null;
    const spotifyDisplayName = userResults.body['display_name'];
    const displayName = spotifyDisplayName ? spotifyDisplayName : userId;
    const email = userResults.body['email'];

    // Create a Firebase account and get the Custom Auth Token.
    const firebaseToken = await createFirebaseAccount(userId, displayName, profilePic, email, accessToken);
    return response.status(200).json({ token: firebaseToken });
  } catch (error) {
    // todo: better error handling here
    return response.status(500).json(NetworkError(500, error.message));
  }
});

app.use((request, response, next) => {
  response.status(404).json(NetworkError(404, 'No such endpoint exists'))
});

// Redirect needs it's own url
exports.spotifyAuthRedirect = functions.https.onRequest((request, response) => {
  cookieParser()(request, response, () => {
    const state = request.cookies.state || crypto.randomBytes(20).toString('hex');
    console.log('Setting verification state:', state);
    response.cookie('state', state.toString(), { maxAge: 3600000, secure: functions.config().env.production, httpOnly: true });
    const authorizeURL = Spotify.createAuthorizeURL(OAUTH_SCOPES, state.toString(), true);
    response.redirect(authorizeURL);
  });
});

exports.api = functions.https.onRequest(app);

// Util functions

function saveSpotifyTokenToFirestore(token) {
  return admin.firestore().collection('metadata').doc('spotify').set({
    accessToken: token
  });
}

/**
 * Creates a Firebase account with the given user profile and returns a custom auth token allowing
 * signing-in this account.
 * Also saves the accessToken to the datastore at /spotifyAccessToken/$uid
 *
 * @returns {Promise<string>} The Firebase custom auth token in a promise.
 */
async function createFirebaseAccount(spotifyID, displayName, photoURL, email, accessToken) {
  // The UID we'll assign to the user.
  const uid = `spotify:${spotifyID}`;

  const saveTokenTask = admin.firestore().collection('users').doc(uid).set({
    spotifyAccessToken: accessToken
  }, { merge: true });

  const userInfo = {
    displayName: displayName,
    email: email,
    emailVerified: true,
    ...!!photoURL && { photoURL: photoURL },
  };

  // Create or update the user account.
  const userCreationTask = admin.auth().updateUser(uid, userInfo).catch((error) => {
    // If user does not exists we create it.
    if (error.code === 'auth/user-not-found') {
      return admin.auth().createUser({
        ...{ uid: uid },
        ...userInfo
      });
    }
    throw error;
  });

  // Wait for all async tasks to complete, then generate and return a custom auth token.
  await Promise.all([userCreationTask, saveTokenTask]);
  
  // Create a Firebase custom auth token.
  const token = await admin.auth().createCustomToken(uid);
  console.log('Created Custom token for UID "', uid, '" Token:', token);
  return token;
}

function NetworkError(status, message) {
  return {
    error: {
      status: status,
      message: message
    }
  }
}
