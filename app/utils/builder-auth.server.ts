import { Authenticator, AuthorizationError } from 'remix-auth';
import { builderSessionStorage } from './builder-session.server';
import env from './env.server';
import { OAuth2StrategyOptions } from 'remix-auth-oauth2';
import { AsyncLocalStorage } from 'node:async_hooks';
import {
  OAuth2StrategyOptionsOverrides,
  WSStrategy,
} from '~/auth-strategy/ws.server';
import {
  getAuthorizationServerOrigin,
  getRequestOrigin,
  parseBuilderUrl,
} from './origins.server';
import createDebug from 'debug';
import { readAccessToken } from './token.server';
import { userHasAccessTo } from './permissions.server';

const debug = createDebug('Auth').extend('BuilderAuthenticator');

const asyncLocalStorage = new AsyncLocalStorage<
  Partial<OAuth2StrategyOptions> &
    Pick<
      OAuth2StrategyOptions,
      'authorizationEndpoint' | 'tokenEndpoint' | 'redirectURI'
    >
>();

type User = {
  id: string;
  email: string;
  sessionIssueDate: number;
};

export const builderAuthenticator = new Authenticator<User>(
  builderSessionStorage,
  {
    throwOnError: true,
  }
);

const getUserById = (id: string): User => {
  return {
    id,
    email: 'ice@yandex.ru',
    sessionIssueDate: Date.now(),
  };
};

builderAuthenticator.use(
  new WSStrategy<User>(
    {
      clientId: env.AUTH_WS_CLIENT_ID,
      clientSecret: env.AUTH_WS_CLIENT_SECRET,
      authorizationEndpoint: 'https://OVERRIDED_ENDPOINT/oauth2/authorize',
      tokenEndpoint: 'https://OVERRIDED_ENDPOINT/oauth2/token',
      redirectURI: 'https://OVERRIDED_ENDPOINT/auth/callback',
      codeChallengeMethod: 'S256',
      authenticateWith: 'request_body',
    },
    async ({ tokens, profile, context, request }) => {
      // here you can use the params above to get the user and return it
      // what you do inside this and how you find the user is up to you
      const accessToken = await readAccessToken(
        tokens.access_token,
        env.AUTH_WS_CLIENT_SECRET
      );

      if (accessToken === undefined) {
        debug('Invalid or expired access token', tokens.access_token);

        throw new AuthorizationError('Invalid or expired access token');
      }

      const { projectId } = parseBuilderUrl(request.url);

      if (accessToken.projectId !== projectId) {
        throw new AuthorizationError(
          'Token projectId and request projectId do not match'
        );
      }

      if (
        userHasAccessTo(accessToken.userId, accessToken.projectId) === false
      ) {
        throw new AuthorizationError(
          'User does not have access to this project'
        );
      }

      debug('User authenticated', accessToken.userId);

      return getUserById(accessToken.userId);
    },
    (request: Request): OAuth2StrategyOptionsOverrides => {
      const origin = getRequestOrigin(request);
      const authOrigin = getAuthorizationServerOrigin(request);
      const { projectId } = parseBuilderUrl(request.url);

      if (origin === authOrigin) {
        throw new Error('Origin and authOrigin cannot be same');
      }

      return {
        authorizationEndpoint: `${authOrigin}/oauth/ws/authorize`,
        tokenEndpoint: `${authOrigin}/oauth/ws/token`,
        redirectURI: `${origin}/auth/ws/callback`,
        scopes: [`project:${projectId}`],
      };
    }
  ),
  'ws'
);
