import { register } from 'node:module';
import React from 'react';

globalThis.React = React;
globalThis.__IMPORT_META_ENV__ = {
  VITE_OLLAMA_URL: 'http://localhost:11434',
};

register('./loader.mjs', import.meta.url);
