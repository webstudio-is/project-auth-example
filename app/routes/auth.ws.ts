import type { LoaderFunction } from '@remix-run/node';
import { authenticator } from '~/utils/auth.server';
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

    debug(
      'Authenticate request received, starting authentication and authorization process'
    );

    return await authenticator.authenticate('ws', request, {
      throwOnError: true,
    });
  } catch (error) {
    // all redirects are basically errors and in that case we don't want to catch it
    if (error instanceof Response) {
      return error;
    }

    debug('error', error);

    console.error('error', error);
    throw error;
  }
};
