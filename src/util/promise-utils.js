
/**
 * Turns the given function into a function
 * that is forced sequential. Any calls to the returned
 * function will execute one after the other, not in parallel
 * @param {function} fn 
 */
export const sequentialize = (fn) => {
  let task;
  return async (...args) => {
    let error;
    task = (async () => {
      task && await task;
      try {
        await fn(...args);
      } catch (err) {
        error = err;
      }
    })();
    await task;
    if (error) throw error;
  };
};

/**
 * Turns the given function into a function that
 * only runs the latest call to it. That is to say, if
 * the function is called several times while a previous
 * call is still in progress, it will only run the latest call
 * after the current call is done
 * @param {function} fn
 */
export const takeLatest = (fn) => {
  let currentTask, nextTask, cancelTask;
  return async (...args) => {
    const task = () => { return fn(...args); };
    if (nextTask) cancelTask();
    nextTask = task;
    if (currentTask) {
      const taskCanceller = new Promise((resolve) => cancelTask = resolve);
      try {
        await Promise.race([currentTask, taskCanceller]);
      } catch(error) { /* This ain't our task */ }
    }
    if (nextTask === task) {
      nextTask = null;
      try {
        currentTask = task();
        await currentTask;
      } finally {
        currentTask = null;
      }
    }
  };
};
