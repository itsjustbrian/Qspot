import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as express from 'express';
import * as cookieParser from 'cookie-parser';
import * as cors from 'cors';
import * as crypto from 'crypto';
import * as SpotifyWebApi from 'spotify-web-api-node';

const serviceAccount = require('../service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${process.env.GCLOUD_PROJECT}.firebaseio.com`,
});

const PRODUCTION_ENV = process.env.NODE_ENV === 'production';
const APP_URL = PRODUCTION_ENV ? `https://${process.env.GCLOUD_PROJECT}.firebaseapp.com` : 'http://localhost:5000';
const SPOTIFY_CLIENT_ID = functions.config().spotify.client_id;
const SPOTIFY_CLIENT_SECRET = functions.config().spotify.client_secret;
const SPOTIFY_AUTH_REDIRECT_URI = `${APP_URL}/login`;
const OAUTH_SCOPES = ["streaming", "user-read-birthdate", "user-read-email", "user-read-private"];

const CORS_OPTIONS = {
  origin: APP_URL,
  methods: 'GET',
  credentials: true
};

const Spotify = new SpotifyWebApi({
  clientId: SPOTIFY_CLIENT_ID,
  clientSecret: SPOTIFY_CLIENT_SECRET,
  redirectUri: SPOTIFY_AUTH_REDIRECT_URI,
});

// todo: once supported in spotify-web-api-node, make spotify requests over persistant connection

const app = express();
const api = express.Router();

app.use('/api', api);

async function authenticate(request, response, next) {
  const auth = request.headers.authorization;
  if (!auth || typeof auth !== 'string' || !auth.startsWith('Bearer ')) {
    return response.status(403).json(NetworkError(403, 'Unauthorized'));
  }
  const idToken = auth.split('Bearer ')[1];
  try {
    const decodedIdToken = await admin.auth().verifyIdToken(idToken);
    request['user'] = decodedIdToken;
    next();
    return 1;
  } catch (error) {
    return response.status(403).json(NetworkError(403, 'Unauthorized'));
  }
};

api.get('/getSpotifyClientCredentials', async (request, response) => {
  try {
    const spotifyAuthResponse = await Spotify.clientCredentialsGrant();
    await saveSpotifyClientToken(spotifyAuthResponse.body['access_token']);
    return response.status(200).json({ token: spotifyAuthResponse.body['access_token'] });
  } catch (error) {
    return response.status(500).json(NetworkError(500, error.message));
  }
});

api.get('/refreshAccessToken', authenticate, async (request, response) => {
  try {
    const uid = request['user'].uid;
    const userRef = admin.firestore().collection('users').doc(uid);

    const userDoc = await userRef.get();
    const refreshToken = userDoc.data().spotifyRefreshToken;
    Spotify.setRefreshToken(refreshToken);
    const { body } = await Spotify.refreshAccessToken();
    console.log('The access token has been refreshed!');
    await saveSpotifyUserTokens(body['access_token'], body['refresh_token'] || refreshToken, uid);
    return response.status(200).json({ token: body['access_token'] });
  } catch (error) {
    return response.status(500).json(NetworkError(500, error.message));
  }
});

api.use((request, response, next) => {
  response.status(404).json(NetworkError(404, 'No such api endpoint exists'))
});

exports.api = functions.https.onRequest(app);

// Redirect and create need their own urls to keep cookies happy
exports.spotifyAuthRedirect = functions.https.onRequest((request, response) => {
  cookieParser()(request, response, async () => {
    const state = request.cookies.state || crypto.randomBytes(20).toString('hex');
    console.log('Setting verification state:', state);
    response.cookie('state', state.toString(), { maxAge: 3600000, secure: PRODUCTION_ENV, httpOnly: true });
    const authorizeURL = Spotify.createAuthorizeURL(OAUTH_SCOPES, state.toString(), true);
    response.redirect(authorizeURL);
  });
});

exports.createSpotifyAccount = functions.https.onRequest((request, response) => {
  cors(CORS_OPTIONS)(request, response, () => {
    cookieParser()(request, response, async () => {
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
        const refreshToken = authGrantResponse.body['refresh_token'];
        console.log('Received Access Token:', accessToken, 'and Refresh Token:', refreshToken);
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

        // The UID we'll assign to the user.
        const uid = `spotify:${userId}`;

        // Save the access and refresh tokens to Firestore
        const saveTokensTask = saveSpotifyUserTokens(accessToken, refreshToken, uid);

        // Create a Firebase account and get the Custom Auth Token.
        const createUserTask = createFirebaseAccount(uid, displayName, profilePic, email);

        // Wait for all async tasks to complete
        const [firebaseToken] = await Promise.all([createUserTask, saveTokensTask]);

        return response.status(200).jsonp({ token: firebaseToken });
      } catch (error) {
        // todo: better error handling here
        return response.status(500).jsonp(NetworkError(500, error.message));
      }
    });
  });
});


// Util functions

function saveSpotifyClientToken(token) {
  return admin.firestore().collection('metadata').doc('spotify').set({
    accessToken: token
  });
}

function saveSpotifyUserTokens(accessToken, refreshToken, uid) {
  return admin.firestore().collection('users').doc(uid).set({
    spotifyAccessToken: accessToken,
    spotifyRefreshToken: refreshToken
  }, { merge: true });
}

/**
 * Creates a Firebase account with the given user profile and returns a custom auth token allowing
 * signing-in this account.
 * Also saves the accessToken to the datastore at /spotifyAccessToken/$uid
 *
 * @returns {Promise<string>} The Firebase custom auth token in a promise.
 */
async function createFirebaseAccount(uid, displayName, photoURL, email) {

  const userInfo = {
    displayName: displayName,
    email: email,
    emailVerified: true,
    ...!!photoURL && { photoURL: photoURL },
  };

  // Create or update the user account.
  await admin.auth().updateUser(uid, userInfo).catch((error) => {
    // If user does not exists we create it.
    if (error.code === 'auth/user-not-found') {
      return admin.auth().createUser({
        ...{ uid: uid },
        ...userInfo
      });
    }
    throw error;
  });

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
