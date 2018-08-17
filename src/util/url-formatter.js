export const formatUrl = (urlStr, params) => urlStr + '?' +
  new URLSearchParams(_.pickBy(params, _.negate(_.isNil))).toString();