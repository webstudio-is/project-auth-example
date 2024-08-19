import { json, redirect, type LoaderFunction } from '@remix-run/node';
import { z } from 'zod';

import { getAuthorisationEndpointOrigin } from '~/utils/origins.server';
import { returnToCookie } from '~/utils/return-to.cookie.server';
import { authenticator } from '~/utils/auth.server';
import { userHasAccessTo } from '~/utils/permissions.server';
import createDebug from 'debug';
import { fromError } from 'zod-validation-error';
import { createCodeToken } from '~/utils/token.server';
import env from '~/utils/env.server';

const debug = createDebug('OAuth').extend('Authorize');

const createOauthError =
  (redirectUri: string) =>
  (
    error: 'invalid_request' | 'invalid_scope' | 'unauthorized_client',
    error_description: string
  ) => {
    const url = new URL(redirectUri);
    url.searchParams.set('error', error);
    url.searchParams.set('error_description', error_description);

    return redirect(url.href, { status: 302 });
  };

const OAuthParamsSchema = z.object({
  // https://datatracker.ietf.org/doc/html/rfc6749#section-3.1.1
  response_type: z.literal('code'),
  // https://datatracker.ietf.org/doc/html/rfc6749#section-3.1.2
  redirect_uri: z.string(),

  client_id: z.string(),
  state: z.string(),
  scope: z
    .string()
    .refine((str) => str.startsWith('project:'), {
      message: "Only 'project:' scopes are allowed",
    })
    .transform((scope) => ({
      projectId: scope.split(':')[1],
    })),
  code_challenge: z.string(),
  code_challenge_method: z.literal('S256'),
});

const OAuthRedirectUriSchema = z.object({
  redirect_uri: z.string(),
});

// https://datatracker.ietf.org/doc/html/rfc6749#section-3.1
export const loader: LoaderFunction = async ({ request }) => {
  try {
    debug('Authorize request received', request.url);

    const url = new URL(request.url);
    const searchParams = Object.fromEntries(url.searchParams);

    const parsedRedirect = OAuthRedirectUriSchema.safeParse(searchParams);

    if (!parsedRedirect.success) {
      debug('redirect_uri not provided in query params');

      return json(
        {
          error: 'invalid_request',
          error_description: 'No redirect_uri provided',
          error_uri: 'https://tools.ietf.org/html/rfc6749#section-3.1.2',
        },
        { status: 400 }
      );
    }

    const { redirect_uri } = parsedRedirect.data;

    if (
      getAuthorisationEndpointOrigin(request) !==
      getAuthorisationEndpointOrigin(redirect_uri)
    ) {
      debug('redirect_uri does not match the registered redirect URIs');

      return json(
        {
          error: 'invalid_request',
          error_description:
            'The redirect_uri provided does not match the registered redirect URIs.',
          error_uri: 'https://tools.ietf.org/html/rfc6749#section-3.1.2',
        },
        { status: 400 }
      );
    }

    const oauthError = createOauthError(redirect_uri);

    const parsedOAuthParams = OAuthParamsSchema.safeParse(searchParams);

    if (!parsedOAuthParams.success) {
      debug(fromError(parsedOAuthParams.error).toString());

      return oauthError(
        'invalid_request',
        fromError(parsedOAuthParams.error).toString()
      );
    }

    const oAuthParams = parsedOAuthParams.data;

    const user = await authenticator.isAuthenticated(request);

    if (user) {
      debug(`User id=${user.id} is authenticated`);

      if (!userHasAccessTo(user.id, oAuthParams.scope.projectId)) {
        debug(
          `User ${user.id} is not the owner of ${oAuthParams.scope.projectId}, denying access`
        );
        return oauthError(
          'unauthorized_client',
          'User does not have access to the project'
        );
      }

      debug(
        `User ${user.id} is the owner of ${oAuthParams.scope.projectId}, creating token`
      );

      // Generate code and save along with code_challenge on the db
      const code = await createCodeToken(
        {
          userId: user.id,
          projectId: oAuthParams.scope.projectId,
          codeChallenge: oAuthParams.code_challenge,
        },
        env.WS_CLIENT_SECRET,
        { maxAge: 1000 * 60 * 5 }
      );

      const redirectUri = new URL(oAuthParams.redirect_uri);
      redirectUri.searchParams.set('code', code);
      redirectUri.searchParams.set('state', oAuthParams.state);

      debug(
        `Code ${code} created, redirecting to redirect_uri: ${redirectUri.href}`
      );

      return redirect(redirectUri.href);
    }

    if (!user) {
      debug(
        'User is not authenticated, saving current url to returnTo cookie and redirecting to login'
      );

      const headers = new Headers();
      // Issue with local development, so force https
      const returnToUrl = new URL(request.url);
      returnToUrl.protocol = 'https';

      // We don't want to have all params above in the URL, so save in returnTo cookie immediately
      headers.append(
        'Set-Cookie',
        await returnToCookie.serialize(returnToUrl.href)
      );

      return redirect('/login', { headers });
    }

    return {
      params: [...url.searchParams.entries()],
    };
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    debug('error', error);

    throw json(
      {
        error: 'server_error',
        error_description:
          error instanceof Error ? error.message : 'Unknown error',
        error_uri: '',
      },
      { status: 500 }
    );
  }
};
