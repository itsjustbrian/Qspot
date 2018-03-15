import { db, currentUser } from './firebase-loader.js';
import request from './request.js';


import { _authenticatedRequest } from './queuespot-api.js';

/**
 * Singleton token manager
 */
class SpotifyTokenManager {

  constructor() {
    this.newClientTokenPromise = null;
    this.newUserTokenPromise = null;
  }

  async getClientToken() {
    if (this.newClientTokenPromise) {
      return await this.newClientTokenPromise;
    }
    const token = await this._getStoredClientToken();
    return token || await this.getNewClientToken();
  }

  async getUserToken() {
    if (this.newUserTokenPromise) {
      return await this.newUserTokenPromise;
    }
    return await this._getStoredUserToken();
  }

  async _getStoredClientToken() {
    const spotifyDoc = await db().collection('metadata').doc('spotify').get();
    if (spotifyDoc.exists) {
      const { accessToken } = spotifyDoc.data();
      console.log('Got client token from firebase');
      return accessToken;
    }
  }

  async _getStoredUserToken() {
    const userDoc = await db().collection('users').doc(currentUser().uid).get();
    if (userDoc.exists) {
      const { spotifyAccessToken } = userDoc.data();
      console.log('Got user token from firebase', spotifyAccessToken);
      return spotifyAccessToken;
    }
  }

  async getNewClientToken() {
    if (this.newClientTokenPromise) {
      return await this.newClientTokenPromise;
    }
    this.newClientTokenPromise = request('/api/getSpotifyClientCredentials').then((response) => response.token);
    const token = await this.newClientTokenPromise;
    console.log('Got new client token', token);
    this.newClientTokenPromise = null;
    return token;
  }

  async getNewUserToken() {
    if (this.newUserTokenPromise) {
      return await this.newUserTokenPromise;
    }
    this.newUserTokenPromise = _authenticatedRequest({ url: '/api/refreshAccessToken' }).then((response) => response.token);
    const token = await this.newUserTokenPromise;
    console.log('Got new user token', token);
    this.newUserTokenPromise = null;
    return token;
  }
}

// Creates a singleton reference
export let tokenManager = new SpotifyTokenManager();