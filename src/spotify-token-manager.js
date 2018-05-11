import { db, currentUser } from './firebase-loader.js';
import { SpotifyMetadataListener } from './data-listeners.js';
import { API_URL } from './globals.js';
import request from './request.js';


import { _authenticatedRequest } from './queuespot-api.js';

/**
 * Singleton token manager
 */
class SpotifyTokenManager {

  constructor() {
    this.__newClientTokenPromise = null;
    this.__newUserTokenPromise = null;

    this.clientToken = null;
    this.userToken = null;
    this.userTokenExpireDate = null;
    
    this.clientTokenListener = new SpotifyMetadataListener((e) => this.onSpotifyMetadataReceived(e));
    this.clientTokenListener.attach();
  }

  onSpotifyMetadataReceived(data) {
    this.clientToken = data && data.accessToken;
  }

  async getClientToken() {
    if (this.__newClientTokenPromise) {
      const { token } = await this.__newClientTokenPromise;
      return token;
    }
    return this.clientToken || await this.getNewClientToken();
  }

  async getUserToken() {
    console.log('Trying to get a user token');
    if (this.__newUserTokenPromise) {
      console.log('New user token promise active');
      const { token } = await this.__newUserTokenPromise;
      return token;
    }
    if (!this.userToken) {
      console.log('Dont have a token, getting it from firebase');
      await this._getStoredUserToken();
    }
    if (Date.now() > this.userTokenExpireDate.getTime()) {
      console.log('Token expired, getting new one');
      await this.getNewUserToken();
    } else {
      console.log('The token didn\'t expire');
    }
    return this.userToken;
  }

  async _getStoredUserToken() {
    // Note: making 'gets' here is performant, since we attach a listener to the same
    // reference early on
    const userDoc = await db().collection('users').doc(currentUser().uid).get();
    if (userDoc.exists) {
      const { spotifyAccessToken, spotifyAccessTokenExpireDate } = userDoc.data();
      this.userToken = spotifyAccessToken;
      this.userTokenExpireDate = new Date(spotifyAccessTokenExpireDate);
      return spotifyAccessToken;
    }
  }

  async getNewClientToken() {
    if (this.__newClientTokenPromise) {
      const { token } = await this.__newClientTokenPromise;
      return token;
    }
    this.__newClientTokenPromise = request(`${API_URL}/getSpotifyClientCredentials`);
    const { token } = await this.__newClientTokenPromise;
    console.log('Got new client token', token);
    this.clientToken = token;
    this.__newClientTokenPromise = null;
    return token;
  }

  async getNewUserToken() {
    if (this.__newUserTokenPromise) {
      const { token } = await this.__newUserTokenPromise;
      return token;
    }
    this.__newUserTokenPromise = _authenticatedRequest(`${API_URL}/refreshAccessToken`);
    const { token, expireDate } = await this.__newUserTokenPromise;
    console.log('Got new user token', token);
    this.userToken = token;
    this.userTokenExpireDate = new Date(expireDate);
    this.__newUserTokenPromise = null;
    return token;
  }
}

// Creates a singleton reference
export let tokenManager = new SpotifyTokenManager();