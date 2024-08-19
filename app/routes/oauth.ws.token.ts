import { ActionFunctionArgs, json } from '@remix-run/node';
import { z } from 'zod';
import env from '~/utils/env.server';
import { userHasAccessTo } from '~/utils/permissions.server';
import {
  createAccessToken,
  readAccessToken,
  readCodeToken,
  verifyChallenge,
} from '~/utils/token.server';
import createDebug from 'debug';
import { fromError } from 'zod-validation-error';

const TokenRequestSchema = z.object({
  grant_type: z.literal('authorization_code'),
  code: z.string(),
  redirect_uri: z.string().url(),
  code_verifier: z.string(),
  client_id: z.string(),
  client_secret: z.string(),
});

const debug = createDebug('OAuth').extend('Token');

export const action = async ({ request }: ActionFunctionArgs) => {
  debug('Token request received');
  const jsonBody = Object.fromEntries((await request.formData()).entries());
  debug('Token request received', jsonBody);

  const parsedBody = TokenRequestSchema.safeParse(jsonBody);

  if (false === parsedBody.success) {
    debug(fromError(parsedBody.error).toString());

    return json(
      {
        error: 'invalid_request',
        error_description: fromError(parsedBody.error).toString(),
        error_uri: 'https://tools.ietf.org/html/rfc6749#section-5.2',
      },
      { status: 400 }
    );
  }

  const body = parsedBody.data;

  if (
    body.client_id !== env.WS_CLIENT_ID ||
    body.client_secret !== env.WS_CLIENT_SECRET
  ) {
    debug('client_id and client_secret do not match', body.code);
    return json(
      {
        error: 'invalid_client',
        error_description: 'invalid client credentials',
        error_uri: 'https://tools.ietf.org/html/rfc6749#section-5.2',
      },
      { status: 401 }
    );
  }

  const codeToken = await readCodeToken(body.code, env.WS_CLIENT_SECRET);

  if (codeToken === undefined) {
    debug('Code can not be read', body.code);
    return json(
      {
        error: 'invalid_grant',
        error_description: 'invalid code',
        error_uri: 'https://tools.ietf.org/html/rfc6749#section-5.2',
      },
      { status: 400 }
    );
  }

  if (
    false ===
    (await verifyChallenge(body.code_verifier, codeToken.codeChallenge))
  ) {
    debug(
      'Code verifier does not match',
      body.code_verifier,
      codeToken.codeChallenge
    );
    return json(
      {
        error: 'invalid_grant',
        error_description: 'invalid code_verifier',
        error_uri: 'https://tools.ietf.org/html/rfc6749#section-5.2',
      },
      { status: 400 }
    );
  }

  const { projectId, userId } = codeToken;

  if (userHasAccessTo(userId, projectId) === false) {
    debug('User does not have access to the project', userId, projectId);
    return json(
      {
        error: 'invalid_grant',
        error_description: 'user does not have access to the project',
        error_uri: 'https://tools.ietf.org/html/rfc6749#section-5.2',
      },
      { status: 400 }
    );
  }

  const maxAge = 1000 * 60;

  // Generate short lived token, as the only purpose of this token is to login the user
  const accessToken = await createAccessToken(
    { userId, projectId },
    env.WS_CLIENT_SECRET,
    {
      maxAge,
    }
  );

  debug('Token created', accessToken);

  debug(
    'readAccessToken',
    await readAccessToken(accessToken, env.WS_CLIENT_SECRET)
  );

  return json(
    {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: Date.now() + maxAge,
    },
    { status: 200 }
  );
};
