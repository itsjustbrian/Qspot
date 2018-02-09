"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const req = require("request-promise-native");
admin.initializeApp(functions.config().firebase);
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_ID_SECRET = 'NzA2MjAzYjAxZDY5NDM0MGFlZDhiY2RmN2M1ZjljNDM6YjdmMjdkMWVlYTRhNDliYzg5MDVhMjZmODcxNmY0YjY=';
exports.getSpotifyAccessToken = functions.https.onRequest((request, response) => __awaiter(this, void 0, void 0, function* () {
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
    const spotifyAuthResponse = yield req(tokenRequestOptions);
    yield saveSpotifyTokenToFirestore(spotifyAuthResponse.access_token);
    response.status(200).send(spotifyAuthResponse.access_token);
}));
function saveSpotifyTokenToFirestore(token) {
    return admin.firestore().collection('metadata').doc('spotify').set({
        accessToken: token
    });
}
//# sourceMappingURL=index.js.map