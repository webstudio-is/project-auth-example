import { Authenticator, AuthorizationError } from 'remix-auth';
import { sessionStorage } from './session.server';
import { OAuth2StrategyOptions } from 'remix-auth-oauth2';
import { AsyncLocalStorage } from 'node:async_hooks';
import { FormStrategy } from 'remix-auth-form';
import createDebug from 'debug';

const debug = createDebug('Auth').extend('Authenticator');

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

export const authenticator = new Authenticator<User>(sessionStorage, {
  throwOnError: true,
});

const getUserById = (id: string) => {
  return {
    id,
    email: 'ice@yandex.ru',
    sessionIssueDate: Date.now(),
  };
};

authenticator.use(
  new FormStrategy(async ({ form }) => {
    return getUserById('123');
  }),
  'dev'
);
