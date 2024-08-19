import { ActionFunctionArgs, redirect } from '@remix-run/node';
import { authenticator } from '~/utils/auth.server';
import { isBuilderUrl } from '~/utils/origins.server';
import { returnToPath } from '~/utils/return-to.cookie.server';

export const action = async ({ request }: ActionFunctionArgs) => {
  if (isBuilderUrl(request.url)) {
    return new Response(null, {
      status: 404,
      statusText: 'Builder has its own authentication',
    });
  }

  const returnTo = await returnToPath(request);

  try {
    return await authenticator.authenticate('dev', request, {
      successRedirect: returnTo,
      throwOnError: true,
    });
  } catch (error: unknown) {
    // all redirects are basically errors and in that case we don't want to catch it
    if (error instanceof Response) {
      return error;
    }

    console.error('error', error);

    if (error instanceof Error) {
      return redirect('/login');
    }
  }
};
