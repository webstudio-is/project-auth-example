import { vitePlugin as remix } from '@remix-run/dev';
import { CorsOptions, defineConfig, type Plugin } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { readFileSync } from 'node:fs';
import type { IncomingMessage } from 'node:http';
import {
  getAuthorizationServerOrigin,
  isBuilderUrl,
} from './app/utils/origins.server';

export default defineConfig(({ mode }) => {
  return {
    plugins: [
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
      // Service-to-service OAuth token call requires a specified host for the wstd.dev domain
      host: 'wstd.dev',
      // Needed for SSL
      proxy: {},

      https: {
        key: readFileSync('./https/privkey.pem'),
        cert: readFileSync('./https/fullchain.pem'),
      },

      cors: ((
        req: IncomingMessage,
        callback: (error: Error | null, options: CorsOptions | null) => void
      ) => {
        // Handle CORS preflight requests in development to mimic Remix production behavior
        if (req.method === 'OPTIONS') {
          if (req.headers.origin != null && req.url != null) {
            const url = new URL(req.url, `https://${req.headers.host}`);

            // Allow CORS for /logout path when requested from the authorization server
            if (url.pathname === '/logout' && isBuilderUrl(url.href)) {
              return callback(null, {
                origin: getAuthorizationServerOrigin(url.href),
                preflightContinue: false,
                credentials: true,
              });
            }
          }

          // Respond with method not allowed for other preflight requests
          return callback(null, {
            preflightContinue: false,
            optionsSuccessStatus: 405,
          });
        }

        // Disable CORS for all other requests
        return callback(null, {
          origin: false,
        });
      }) as never,
    },
  };
});
