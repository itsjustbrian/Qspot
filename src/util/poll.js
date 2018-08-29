
export class Poll {
  constructor(callback, delay, startAfterTimeout = false) {
    this.callback = callback;
    this.delay = delay;
    this.startAfterTimeout = startAfterTimeout;
    this._timerId = null;
    this._started = false;
  }

  start() {
    if (!this._started) {
      this.startAfterTimeout ? (this._timerId = this._timeoutPoll()) : this._poll();
      this._started = true;
    }
  }

  stop() {
    clearTimeout(this._timerId);
    this._timerId = null;
    this._started = false;
  }

  async _poll() {
    await this.callback();
    this._timerId = this._timeoutPoll();
  }

  _timeoutPoll() {
    return setTimeout(() => this._poll(), this.delay);
  }
}