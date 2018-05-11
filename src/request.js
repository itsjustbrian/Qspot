
export default function request(options) {
  
  return new Promise((resolve, reject) => {
    let xhr = new XMLHttpRequest();
    xhr.responseType = options.responseType || 'json';
    xhr.open(options.method || 'GET', options.url || options);
    xhr.withCredentials = !!options.withCredentials;
    if (options.headers) {
      Object.keys(options.headers).forEach((key) => {
        xhr.setRequestHeader(key, options.headers[key]);
      });
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response);
      } else {
        reject(getNetworkError(xhr));
      }
    };
    xhr.onerror = () => reject(getNetworkError(xhr));
    xhr.send(JSON.stringify(options.body));
  });
}

function getNetworkError(xhr) {
  if (!xhr || !xhr.response) {
    return { message: 'Unknown error' };
  }
  return xhr.response.error;
}