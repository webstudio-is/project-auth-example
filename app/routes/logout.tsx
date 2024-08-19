import {
  ActionFunctionArgs,
  HeadersFunction,
  json,
  LoaderFunctionArgs,
} from '@remix-run/node';
import { authenticator } from '~/utils/auth.server';
import { builderAuthenticator } from '~/utils/builder-auth.server';
import { isBuilderUrl } from '~/utils/origins.server';
import createDebug from 'debug';

const debug = createDebug('Auth').extend('Logout');

export const loader = async ({ request }: LoaderFunctionArgs) => {
  debug('Logout request received');

  try {
    if (isBuilderUrl(request.url)) {
      await builderAuthenticator.logout(request, { redirectTo: '/' });
    } else {
      await authenticator.logout(request, { redirectTo: '/' });
    }
  } catch (error) {
    if (error instanceof Response) {
      const contentType = request.headers.get('Content-Type');

      if (contentType?.includes('application/json')) {
        const headers = new Headers(error.headers);
        headers.set('Content-Type', 'application/json');
        return new Response(
          JSON.stringify({
            success: true,
          }),
          {
            headers,
            status: 200,
          }
        );
      }

      return error;
    }

    throw error;
  }

  return json({});
};
