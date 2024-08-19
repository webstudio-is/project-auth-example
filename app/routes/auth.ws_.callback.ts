import type { LoaderFunction } from '@remix-run/node';
import { AuthorizationError } from 'remix-auth';
import { builderAuthenticator } from '~/utils/builder-auth.server';
import { returnToPath } from '~/utils/return-to.cookie.server';
import { isBuilderUrl } from '~/utils/origins.server';
import createDebug from 'debug';

const debug = createDebug('Auth').extend('Ws');

export const loader: LoaderFunction = async ({ request }) => {
  try {
    if (false === isBuilderUrl(request.url)) {
      debug(`Request url is not the builder URL ${request.url}`);

      return new Response(null, {
        status: 404,
        statusText: 'Only builder URL is allowed',
      });
    }

    const returnTo = await returnToPath(request);

    debug('Start exchanging the code for the access token');

    await builderAuthenticator.authenticate('ws', request, {
      throwOnError: false,
      successRedirect: returnTo,
      failureRedirect: '/error',
    });
  } catch (error) {
    // all redirects are basically errors and in that case we don't want to catch it
    if (error instanceof Response) {
      return error;
    }

    if (error instanceof AuthorizationError) {
      debug('Authorization error', error.message);
      return new Response(null, {
        status: 401,
        statusText: 'Unauthorized',
      });
    }

    debug('error', error);
    console.error('error', error);
    throw error;
  }
};
