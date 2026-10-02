const fs = require('node:fs');
const Module = require('node:module');
const { pathToFileURL } = require('node:url');
const original = fs.realpathSync(process.argv[1]);
const target = pathToFileURL(original).href;
if (typeof Module.registerHooks === 'function') {
  Module.registerHooks({
    load(url, context, nextLoad) {
      const loaded = nextLoad(url, context);
      return url === target ? { ...loaded, source: fs.readFileSync(snapshot) } : loaded;
    },
  });
} else {
  // Node 18/20 use separate CommonJS and asynchronous ESM loading hooks.
  const load = Module._extensions['.js'];
  Module._extensions['.js'] = (module, filename) => {
    if (fs.realpathSync(filename) === original)
      module._compile(fs.readFileSync(snapshot, 'utf8'), filename);
    else load(module, filename);
  };
  if (typeof Module.register === 'function')
    Module.register(pathToFileURL(loader), { data: { target, snapshot } });
}
