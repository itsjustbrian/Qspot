
export default function request(options) {
  
  return new Promise((resolve, reject) => {
    let xhr = new XMLHttpRequest();
    xhr.responseType = options.responseType || 'json';
    xhr.open(options.method || 'GET', options.url);
    if (options.headers) {
      Object.keys(options.headers).forEach((key) => {
        xhr.setRequestHeader(key, options.headers[key]);
      });
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response);
      } else {
        reject(xhr.response.error);
      }
    };
    xhr.onerror = () => reject(xhr.response.error);
    xhr.send(options.body);
  });
}