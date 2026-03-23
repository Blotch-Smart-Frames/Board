import { writeFileSync } from 'fs';
import { resolve } from 'path';
import type { Plugin } from 'vite';

export const versionPlugin = (): Plugin => {
  const buildHash = Date.now().toString(36);

  return {
    name: 'version-plugin',
    config() {
      return {
        define: {
          __BUILD_HASH__: JSON.stringify(buildHash),
        },
      };
    },
    buildStart() {
      const versionFile = resolve('public', 'version.json');
      writeFileSync(versionFile, JSON.stringify({ buildHash }));
    },
  };
};
