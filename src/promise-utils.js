
/**
 * Turns the given function into a function
 * that is forced synchronus. Any calls to the returned
 * function will execute one after the other
 * @param {function} fn 
 */
export function noParallel(fn) {
  let task = null;

  return async (...args) => {
    let error = null;
    task = (async () => {
      task && await task;
      try {
        await fn(...args);
      } catch (err) {
        error = err;
      }
    })();
    await task;
    if (error) {
      throw error;
    }
  };
}