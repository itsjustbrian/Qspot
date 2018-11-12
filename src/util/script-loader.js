
export const loadScripts = (urls, async = true) => {
  if (typeof urls === 'string') urls = [urls];
  const scriptPromises = [];
  const frag = document.createDocumentFragment();
  for (const url of urls) {
    const script = document.createElement('script');
    script.src = url;
    script.async = async;
    frag.appendChild(script);
    scriptPromises.push(_promisifyScript(script));
  }
  document.body.appendChild(frag);
  return Promise.all(scriptPromises);
};

const _promisifyScript = (script) => {
  return new Promise((resolve, reject) => {
    script.onload = () => {
      resolve(script.src);
    };

    script.onerror = () => {
      reject(script.src);
    };
  });
};