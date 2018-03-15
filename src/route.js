
export class Route {

  constructor(path, params, parts, previousParts) {
    if (!arguments.length) {
      this._setPropsFromUrl();

      // Attach change listeners on window
      this.__urlChanged = (e) => this._urlChanged(e);
      window.addEventListener('location-changed', this.__urlChanged);
      window.addEventListener('popstate', this.__urlChanged);
      this.onUrlChanged = null;
    } else {
      this.path = path;
      this.params = params;
      this.parts = parts;
      this.previousParts = previousParts;
    }
    this.subRoute = null;
  }

  disconnect() {
    window.removeEventListener('location-changed', this.__urlChanged);
    window.removeEventListener('popstate', this.__urlChanged);
  }

  get currentPart() {
    return this.parts[0] || '';
  }

  get previousPath() {
    return '/' + this.previousParts.join('/');
  }

  sub(part) {
    if (this.parts.length && part === this.parts[0]) {
      if (!this.subRoute) {
        const previousParts = this.previousParts.slice();
        previousParts.push(this.currentPart);
        this.subRoute = new Route(this.path, this.params, this.parts.slice(1), previousParts);
      }
      return this.subRoute;
    } else {
      return null;
    }
  }

  _setPropsFromUrl() {
    const path = decodeURIComponent(window.location.pathname);
    const params = new URLSearchParams(location.search);
    if (path === this.path && params === this.params) {
      // Url is already a reflection of our state
      console.log('Url is already a reflection of our state');
      return false;
    }
    this.path = path;
    this.params = params;
    this.parts = this.path.split('/').filter((part) => part.length);
    this.previousParts = [];
    this.subRoute = null;
    return true;
  }

  _urlChanged(event) {
    this._setPropsFromUrl() && this.onUrlChanged && this.onUrlChanged();
  }
}

export function pushRoute(url, noUpdate) {
  window.history.pushState({}, '', url);
  noUpdate || updateLocation();
}

export function replaceRoute(url, noUpdate) {
  window.history.replaceState({}, '', url);
  noUpdate || updateLocation();
}

export function updateLocation() {
  window.dispatchEvent(new CustomEvent('location-changed'));
}

export function routeLink(event) {
  event.preventDefault();
  
  const href = event.target.href;
  if (!href) {
    return;
  }
  const locationHref = decodeURIComponent(window.location.href);
  if (href !== locationHref) {
    pushRoute(href);
  }
}