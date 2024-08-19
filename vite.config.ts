import { vitePlugin as remix } from '@remix-run/dev';
import { defineConfig, type Plugin } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import basicSsl from '@vitejs/plugin-basic-ssl';
import dns from 'node:dns';

dns.setDefaultResultOrder('verbatim');

export default defineConfig(({ mode }) => {
  if (mode === 'development') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  return {
    plugins: [
      basicSsl() as Plugin<unknown>,

      remix({
        future: {
          v3_fetcherPersist: true,
          v3_relativeSplatPath: true,
          v3_throwAbortReason: true,
        },
      }),
      tsconfigPaths(),
    ],
    server: {
      host: '0.0.0.0',
      // Needed for SSL
      proxy: {},
    },
  };
});
