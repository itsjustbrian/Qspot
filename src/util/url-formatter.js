export const formatUrl = (urlStr, params) => urlStr + '?' +
  new URLSearchParams(Object.keys(params).reduce((obj, key) => {
    params[key] != null && (obj[key] = params[key]);
    return obj;
  }, {})).toString();

