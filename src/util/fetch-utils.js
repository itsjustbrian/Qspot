export const formatUrl = (urlStr, params) => {
  const paramsStr = new URLSearchParams(cleanObject(params)).toString();
  return urlStr + (paramsStr.length ? '?' + paramsStr : '');
};

export const formatBody = (params) => JSON.stringify(cleanObject(params));

const cleanObject = (obj) => Object.keys(obj).reduce((cleanObj, key) => {
  obj[key] != null && (cleanObj[key] = obj[key]);
  return cleanObj;
}, {});

export const fetchRetry = (url, ...args) => {
  let i = 0;
  let options, retries, timeout;
  if (args[0] && typeof args[0] === 'object') {
    options = args[0];
    i++;
  }
  retries = args[i];
  timeout = args[i + 1];
  const fetcher = new FetchRetry(url, options, retries, timeout);
  return fetcher.run();
};

const RESOLVE = 'RESOLVE';
const CONTINUE = 'CONTINUE';
const RERUN = 'RERUN';
const RERUN_AFTER_TIMEOUT = 'RERUN_AFTER_TIMEOUT';

export class FetchRetry {
  constructor(url, options, retries = FetchRetry.DEFAULT_RETRIES, timeout = 0) {
    //console.error(retries);
    this.url = url;
    this.options = options || {};
    if (typeof retries === 'number') {
      this._numRetries = retries;
      this._retries = [timeout];
    } else {
      this._numRetries = retries.length;
      this._retries = retries;
    }
    this._aborted, this._notOkCallback, this._cancelCallback, this._controller, this._timeoutID;
  }

  static get RESOLVE() { return { name: 'RESOLVE' }; }
  static get CONTINUE() { return { name: 'CONTINUE' }; }
  static get RERUN() { return { name: 'RERUN' }; }
  static RERUN_AFTER_TIMEOUT(timeout) {
    return { name: 'RERUN_AFTER_TIMEOUT', timeout };
  }

  static get DEFAULT_RETRIES() {
    return [10, 50, 250];
  }

  onNotOk(callback) {
    this._notOkCallback = callback;
  }

  async run() {
    //console.error('numRetries: ', this._numRetries);
    this._aborted = false;
    for (let attemptNum = 0; attemptNum < this._numRetries + 1; attemptNum++) {
      //console.error('On attempt: ', attemptNum + 1);
      let rerunTimeout = 0;
      let error;
      try {
        if (this._aborted) throw new AbortError();
        this._controller = new AbortController();
        this.options.signal = this._controller.signal;
        const response = await fetch(this.url, this.options);
        this._controller = null;
        if (response.ok) return response;
        const callbackCanceller = new Promise((resolve) => this._cancelCallback = resolve);
        const decision = this._notOkCallback ? await Promise.race([this._notOkCallback(response), callbackCanceller]) : FetchRetry.RESOLVE;
        if (this._aborted) throw new AbortError();
        let shouldContinueLoop;
        switch (decision && decision.name) {
          case RESOLVE:
            return response;
          case RERUN:
            attemptNum = -1;
            shouldContinueLoop = true;
            break;
          case RERUN_AFTER_TIMEOUT:
            attemptNum = -1;
            rerunTimeout = decision.timeout;
            break;
          case CONTINUE:
            break;
          default:
            return response;
        }
        if (shouldContinueLoop) continue;
      } catch (err) {
        console.log('Caught error');
        console.error(err);
        if (err.name === 'AbortError') throw err;
        error = err;
      }
      if (attemptNum === this._numRetries) throw error;
      const timeoutIndex = attemptNum >= this._retries.length ? this._retries.length - 1 : attemptNum;
      await new Promise((resolve) => {
        this._timeoutID = setTimeout(resolve,  timeoutIndex === -1 ? rerunTimeout : this._retries[timeoutIndex]);
      });
      this._timeoutID = null;
    }
  }

  abort() {
    this._aborted = true;
    this._controller && this._controller.abort();
    if (typeof this._timeoutID === 'number') clearTimeout(this._timeoutID);
    this._cancelCallback && this._cancelCallback();
  }
}

class AbortError extends Error{}

let attemptNum = 1;
let succeedOn = 4;
const fetch_stub = (url, options) => {
  const shouldFail = attemptNum !== succeedOn;
  attemptNum++;
  return new Promise((resolve, reject) => {
    if (shouldFail) {
      setTimeout(() => reject({ ok: false }), 300);
    } else {
      setTimeout(() => resolve({ ok : true }), 300);
    }
  });
};

const reset = () => {
  attemptNum = 1;
};