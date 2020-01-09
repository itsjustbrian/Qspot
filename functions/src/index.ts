import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as firebase_tools from 'firebase-tools';
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

const firestore = admin.firestore();
const settings = { timestampsInSnapshots: true };
firestore.settings(settings);

const PRODUCTION_ENV = process.env.NODE_ENV === 'production';
const APP_URL = PRODUCTION_ENV ? `https://${process.env.GCLOUD_PROJECT}.firebaseapp.com` : 'http://localhost:8081';
const FIREBASE_TOKEN = functions.config().fb.token;
const SPOTIFY_CLIENT_ID = functions.config().spotify.client_id;
const SPOTIFY_CLIENT_SECRET = functions.config().spotify.client_secret;
const SPOTIFY_AUTH_REDIRECT_URI = `${APP_URL}/authorize_spotify`;
const OAUTH_SCOPES = ["streaming", "user-read-birthdate", "user-read-email", "user-read-private", "user-read-playback-state"];

const CORS_OPTIONS = {
  origin: APP_URL,
  methods: ['GET', 'DELETE'],
  credentials: true
};

// note: replace spotify-web-api-node
const Spotify = new SpotifyWebApi({
  clientId: SPOTIFY_CLIENT_ID,
  clientSecret: SPOTIFY_CLIENT_SECRET,
  redirectUri: SPOTIFY_AUTH_REDIRECT_URI,
});

// Error class

class HttpsError extends Error {
  status: number;
  constructor(status, message) {
    super();
    this.status = status;
    this.message = message;
  }
}

// Middleware

const catch_wrap = fn => (...args) => fn(...args).catch(args[2]);

async function authenticate(request, _, next) {
  const auth = request.headers.authorization;
  if (!auth || typeof auth !== 'string' || !auth.startsWith('Bearer ')) {
    next(new HttpsError(403, 'unauthorized'));
  }
  const idToken = auth.split('Bearer ')[1];
  try {
    const decodedIdToken = await admin.auth().verifyIdToken(idToken);
    request['user'] = decodedIdToken;
    next();
  } catch (error) {
    next(new HttpsError(403, 'unauthorized'));
  }
};

const app = express();
app.use(cors(CORS_OPTIONS));

app.get('/getSpotifyClientCredentials', catch_wrap(async (_, response) => {
  const spotifyAuthResponse = await Spotify.clientCredentialsGrant();
  await saveSpotifyClientToken(spotifyAuthResponse.body['access_token']);
  return response.status(200).json({ token: spotifyAuthResponse.body['access_token'] });
}));

app.get('/refreshAccessToken', authenticate, catch_wrap(async (request, response) => {
  if (!request['user'].spotifyPremium) throw new HttpsError(403, 'user is not spotify premium');
  const uid = request['user'].uid;
  const userDoc = await admin.firestore().collection('users').doc(uid).get();
  if (!userDoc.exists || !userDoc.data().spotifyRefreshToken) throw new HttpsError(400, 'no refresh token available');
  const currentRefreshToken = userDoc.data().spotifyRefreshToken;
  Spotify.setRefreshToken(currentRefreshToken);
  const refreshTokenResponse = await Spotify.refreshAccessToken();
  const token = refreshTokenResponse.body['access_token'];
  const refreshToken = refreshTokenResponse.body['refresh_token'] || currentRefreshToken;
  const expireTime = toExpireTime(refreshTokenResponse.body['expires_in']);
  console.log('The access token has been refreshed!');
  await saveSpotifyUserData(uid, {
    spotifyAccessToken: token,
    spotifyAccessTokenExpireTime: expireTime,
    spotifyRefreshToken: refreshToken,
  });
  return response.status(200).json({ token });
}));

app.get('/createSpotifyAccount', cookieParser(), catch_wrap(async (request, response) => {
  console.log('Received verification state:', request.cookies.state);
  console.log('Received state:', request.query.state);
  if (!request.cookies.state) throw new HttpsError(400, 'state cookie not set or expired');
  else if (request.cookies.state !== request.query.state) throw new HttpsError(403, 'state validation failed');
  console.log('Received auth code:', request.query.code);

  const authGrantResponse = await Spotify.authorizationCodeGrant(request.query.code);
  const accessToken = authGrantResponse.body['access_token'];
  const refreshToken = authGrantResponse.body['refresh_token'];
  const expireTime = toExpireTime(authGrantResponse.body['expires_in']);
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

  // An object that groups the spotify user's profile data
  // for the purpose of creating/updating a user
  const userInfo = {
    displayName,
    email,
    emailVerified: true,
    ...!!profilePic && { photoURL: profilePic },
  };

  // Get the user with same email as the spotify user's email (if one exists)
  let userRecord = await admin.auth().getUserByEmail(email).catch((error) => {
    if (error.code === 'auth/user-not-found') {
      return null;
    }
    throw error;
  });

  // Custom auth claims for a spotify user
  const customClaims = {
    ...(userRecord && userRecord.customClaims),
    spotify: true,
    spotifyPremium: isPremium
  };

  // We need to assign the custom claims if either the account doesn't have any,
  // or the account wasn't already designated as a spotify account,
  // or the premium status of the account has changed
  const needToAssignClaims = userRecord &&
    (!userRecord.customClaims ||
    !userRecord.customClaims.spotify ||
    isPremium !== userRecord.customClaims.spotifyPremium);

  const saveUserTask = (_uid) => {
    return saveSpotifyUserData(_uid, {
      spotifyUsername: userId,
      spotifyDisplayName: displayName,
      ...!!profilePic && { spotifyPhotoURL: profilePic },
      spotifyAccessToken: accessToken,
      spotifyAccessTokenExpireTime: expireTime,
      spotifyRefreshToken: refreshToken,
      spotifyCountry: country
    });
  };

  const assignClaimsTask = (_uid) => {
    return admin.auth().setCustomUserClaims(_uid, customClaims);
  }

  const createTokenTask = (_uid) => {
    return admin.auth().createCustomToken(_uid, customClaims);
  }

  const updateUserTask = (_uid) => {
    return admin.auth().updateUser(_uid, userInfo);
  }

  // Unique id of the user
  let uid;

  // The custom token the user will sign in with
  let token;

  // Gotta extract this from the 'if' block to appease the Typescript Gods
  let tasks;

  // Account exists.
  if (userRecord) {
    uid = userRecord.uid;
    tasks = [createTokenTask(uid), updateUserTask(uid), saveUserTask(uid)];
    if (needToAssignClaims) tasks.push(assignClaimsTask(uid));
    [token] = await Promise.all(tasks);
    return response.status(200).json({ token });
  }
  
  // Create new spotify account
  userRecord = await admin.auth().createUser(userInfo);
  uid = userRecord.uid;
  [token] = await Promise.all([createTokenTask(uid), assignClaimsTask(uid), saveUserTask(uid)]);
  return response.status(200).json({ token });
}));

app.delete('/party/:id', authenticate, catch_wrap(async (request, response) => {
  const uid = request['user'].uid;
  const partyId = request.params.id;
  if (!partyId) throw new HttpsError(400, 'no party ID provided');
  const partyDoc = await admin.firestore().collection('parties').doc(partyId).get();
  if (!partyDoc.exists) throw new HttpsError(404, 'party does not exist');
  if (partyDoc.data().host !== uid) throw new HttpsError(403, 'requesting user is not the host of requested party');

  await deletePath(`parties/${partyId}`);
  return response.status(204).send('');
}));

app.use((request, response, next) => {
  throw new HttpsError(404, 'no such api endpoint exists');
});

app.use((error, request, response, next) => {
  // Somehow capture endpoint name here
  const { status = 500, message = 'unknown' } = error;
  if (status === 500) console.error(message);
  return response.status(status).json({
    error: {
      status,
      message
    }
  });
});

exports.api = functions.https.onRequest(app);
exports.api_heavy_duty = functions.runWith({ timeoutSeconds: 540, memory: '2GB' }).https.onRequest(app);

exports.redirect = functions.https.onRequest((request, response) => {
  cookieParser()(request, response, () => {
    const state = request.cookies.state || crypto.randomBytes(20).toString('hex');
    console.log('Setting verification state:', state);
    response.cookie('state', state.toString(), { maxAge: 3600000, secure: PRODUCTION_ENV, httpOnly: true });
    const authorizeURL = Spotify.createAuthorizeURL(OAUTH_SCOPES, state.toString(), true);
    response.redirect(authorizeURL);
  });
});

// Actions

function saveSpotifyClientToken(token) {
  return admin.firestore().collection('metadata').doc('spotify').set({
    accessToken: token
  });
}

function saveSpotifyUserData(uid, data) {
  return admin.firestore().collection('users').doc(uid).set(data, { merge: true });
}

function deletePath(path, recursive = true) {
  return firebase_tools.firestore.delete(path, {
    recursive,
    project: process.env.GCLOUD_PROJECT,
    yes: true,
    token: FIREBASE_TOKEN
  });
}

// Util

function toExpireTime(expiresIn) {
  const now = admin.firestore.Timestamp.now();
  return new admin.firestore.Timestamp(now.seconds + expiresIn, now.nanoseconds);
}
