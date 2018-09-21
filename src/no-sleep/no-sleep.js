/* NoSleep.js - git.io/vfn01 - Rich Tibbett - MIT license */
/* Condensed and converted to an ES6 module - Brian Ferch */

import { MEDIA_FILE } from './media.js';

// Detect iOS browsers < version 10
const OLD_IOS = typeof navigator !== 'undefined' && parseFloat(
  ('' + (/CPU.*OS ([0-9_]{3,4})[0-9_]{0,1}|(CPU like).*AppleWebKit.*Mobile/i.exec(navigator.userAgent) || [0, ''])[1])
    .replace('undefined', '3_2').replace('_', '.').replace('_', '')
) < 10 && !window['MSStream'];

export class NoSleep {
  constructor() {
    if (OLD_IOS) {
      this.noSleepTimer = null;
    } else {
      // Set up no sleep video element
      this.noSleepVideo = document.createElement('video');

      this.noSleepVideo.setAttribute('playsinline', '');
      this.noSleepVideo.setAttribute('src', MEDIA_FILE);

      this.noSleepVideo.addEventListener('timeupdate', (e) => {
        if (this.noSleepVideo.currentTime > 0.5) {
          this.noSleepVideo.currentTime = Math.random();
        }
      });
    }
  }

  enable() {
    if (OLD_IOS) {
      this.disable();
      this.noSleepTimer = window.setInterval(() => {
        window.location.href = '/';
        window.setTimeout(window.stop, 0);
      }, 15000);
    } else {
      this.noSleepVideo.play();
    }
  }

  disable() {
    if (OLD_IOS) {
      if (this.noSleepTimer) {
        window.clearInterval(this.noSleepTimer);
        this.noSleepTimer = null;
      }
    } else {
      this.noSleepVideo.pause();
    }
  }
}
