import { LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { authenticator } from '~/utils/auth.server';
import { getAuthorisationEndpointOrigin } from '~/utils/origins.server';
import { sessionStorage } from '~/utils/session.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  let error = await (
    await sessionStorage.getSession(request.headers.get('Cookie'))
  ).get(authenticator.sessionErrorKey);

  return { error, origin: getAuthorisationEndpointOrigin(request) };
};

export default () => {
  const data = useLoaderData<typeof loader>();

  return (
    <div className="font-sans p-4">
      <h1>Auth Error</h1>
      <p>{data.error?.message}</p>
      <a
        className="text-blue-700 underline visited:text-purple-900"
        href={data.origin}
      >
        Goto authorizer app
      </a>
    </div>
  );
};
