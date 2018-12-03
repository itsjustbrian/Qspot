export const formatUrl = (urlStr, params) => {
  const paramsStr = new URLSearchParams(cleanObject(params)).toString();
  return urlStr + (paramsStr.length ? '?' + paramsStr : '');
};

export const formatBody = (params) => JSON.stringify(cleanObject(params));

const cleanObject = (obj) => Object.keys(obj).reduce((cleanObj, key) => {
  obj[key] != null && (cleanObj[key] = obj[key]);
  return cleanObj;
}, {});