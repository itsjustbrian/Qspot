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
const APP_URL = PRODUCTION_ENV ? `https://${process.env.GCLOUD_PROJECT}.firebaseapp.com` : 'http://localhost:8081';
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

app.use(cors(CORS_OPTIONS));

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

app.get('/getSpotifyClientCredentials', async (request, response) => {
  try {
    const spotifyAuthResponse = await Spotify.clientCredentialsGrant();
    await saveSpotifyClientToken(spotifyAuthResponse.body['access_token']);
    return response.status(200).json({ token: spotifyAuthResponse.body['access_token'] });
  } catch (error) {
    return response.status(500).json(NetworkError(500, error.message));
  }
});

app.get('/refreshAccessToken', authenticate, async (request, response) => {
  try {
    const uid = request['user'].uid;
    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    const refreshToken = userDoc.data().spotifyRefreshToken;
    Spotify.setRefreshToken(refreshToken);
    const refreshTokenResponse = await Spotify.refreshAccessToken();
    const accessToken = refreshTokenResponse.body['access_token'];
    const newRefreshToken = refreshTokenResponse.body['refresh_token'];
    const expiresIn = refreshTokenResponse.body['expires_in'];
    const expireDate = toExpireDate(expiresIn);
    console.log('The access token has been refreshed!');
    await saveSpotifyUserData(uid, {
      spotifyAccessToken: accessToken,
      spotifyAccessTokenExpireDate: expireDate,
      spotifyRefreshToken: newRefreshToken || refreshToken,
    });
    return response.status(200).json({ token: accessToken, expireDate: expireDate });
  } catch (error) {
    return response.status(500).json(NetworkError(500, error.message));
  }
});

app.get('/spotifyAuthRedirect', cookieParser(), async (request, response) => {
  const state = request.cookies.state || crypto.randomBytes(20).toString('hex');
  console.log('Setting verification state:', state);
  response.cookie('state', state.toString(), { maxAge: 3600000, secure: PRODUCTION_ENV, httpOnly: true });
  const authorizeURL = Spotify.createAuthorizeURL(OAUTH_SCOPES, state.toString(), true);
  response.redirect(authorizeURL);
});

app.get('/createSpotifyAccount', cookieParser(), async (request, response) => {
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
    const expiresIn = authGrantResponse.body['expires_in'];
    const expireDate = toExpireDate(expiresIn);
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
    const isPremium = userResults.body['product'] === 'premium';
    const country = userResults.body['country'];

    // The UID we'll assign to the user.
    let uid = `spotify:${userId}`;

    // An object that groups the spotify user's profile data
    // for the purpose of creating/updating a user
    const userInfo = {
      displayName,
      email,
      emailVerified: true,
      ...!!profilePic && { photoURL: profilePic },
    };

    // Get the user with same email as the spotify user's email (if one exists)
    const userRecord = await admin.auth().getUserByEmail(email).catch((error) => {
      if (error.code === 'auth/user-not-found') {
        return null;
      }
      throw error;
    });

    const saveUserTask = (_uid) => {
      return saveSpotifyUserData(_uid, {
        spotifyAccessToken: accessToken,
        spotifyAccessTokenExpireDate: expireDate,
        spotifyRefreshToken: refreshToken,
        spotifyCountry: country
      });
    };

    const createTokenTask = (_uid) => {
      return admin.auth().createCustomToken(_uid, { spotify: true, spotifyPremium: isPremium });
    }

    // Different account exists with this email exists.
    // We'll assign the tokens and claims to that user and sign them in.
    if (userRecord && userRecord.uid !== uid) {
      uid = userRecord.uid;
      const [token] = await Promise.all([createTokenTask(uid), saveUserTask(uid)]);
      return response.status(200).json({ token: token, providers: userRecord.providerData });
    }

    // At this point the user either doesn't exist, or is a returning spotify user

    const createOrUpdateUserTask = async (_uid) => {
      userRecord ? await admin.auth().updateUser(_uid, userInfo) : await admin.auth().createUser({ uid: _uid, ...userInfo });
      return createTokenTask(uid);
    };

    const [firebaseToken] = await Promise.all([createOrUpdateUserTask(uid), saveUserTask(uid)]);

    // Return the custom token the client can sign in with
    return response.status(200).json({ token: firebaseToken });
  } catch (error) {
    // todo: better error handling here
    return response.status(500).json(NetworkError(500, error.message));
  }
});

app.use((request, response, next) => {
  response.status(404).json(NetworkError(404, 'No such api endpoint exists'))
});

exports.api = functions.https.onRequest(app);

// Actions

function saveSpotifyClientToken(token) {
  return admin.firestore().collection('metadata').doc('spotify').set({
    accessToken: token
  });
}

function saveSpotifyUserData(uid, data) {
  return admin.firestore().collection('users').doc(uid).set(data, { merge: true });
}


// Util functions

function toExpireDate(expiresIn) {
  return new Date(Date.now() + expiresIn * 1000);
}

function NetworkError(status, message) {
  return {
    error: {
      status,
      message
    }
  }
}
