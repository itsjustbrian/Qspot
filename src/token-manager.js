import { db } from './firebase-loader.js';
import request from './request.js';

/**
 * Singleton token manager
 */
class TokenManager {

  constructor() {
    this.newTokenPromise = null;
  }

  async getToken() {
    if (this.newTokenPromise) {
      return await this.newTokenPromise;
    }
    const spotifyDoc = await db().collection('metadata').doc('spotify').get();
    if (spotifyDoc.exists) {
      console.log('Got token from firebase');
      return spotifyDoc.data().accessToken;
    } else {
      return await this.getNewToken();
    }
  }

  async getNewToken() {
    if (this.newTokenPromise) {
      return await this.newTokenPromise;
    }
    this.newTokenPromise = request({
      url: '/functions/getSpotifyAccessToken',
      responseType: 'text'
    });
    const token = await this.newTokenPromise;
    console.log('Got new token', token);
    this.newTokenPromise = null;
    return token;
  }
}

// Creates a singleton reference
export let tokenManager = new TokenManager();