import type {
  LoaderFunction,
  LoaderFunctionArgs,
  MetaFunction,
} from '@remix-run/node';
import { sessionStorage } from '~/utils/session.server';
import { authenticator } from '~/utils/auth.server';
import {
  getRequestOrigin,
  getAuthorizationServerOrigin,
  isBuilderUrl,
} from '../utils/origins.server';
import { useLoaderData } from '@remix-run/react';

export const meta: MetaFunction = () => {
  return [
    { title: 'New Remix App' },
    { name: 'description', content: 'Welcome to Remix!' },
  ];
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request);

  return {
    user,
    isBuilderUrl: isBuilderUrl(request.url),
    origin: getAuthorizationServerOrigin(request),
  };
};

export default function Index() {
  const data = useLoaderData<typeof loader>();
  const projectUrl = new URL(data.origin);
  projectUrl.host = `p-9ccd96e1-de48-4f3f-898b-042e890ae805.${projectUrl.host}`;

  const noAccessProjectUrl = new URL(data.origin);
  noAccessProjectUrl.host = `p-9ccd9600-de48-4f3f-898b-042e890ae805.${noAccessProjectUrl.host}`;

  return (
    <div className="font-sans p-4">
      <h1 className="text-3xl">Welcome to Remix {data.user?.email}</h1>
      <ul className="list-disc mt-4 pl-6 space-y-2">
        {!data.isBuilderUrl && (
          <>
            <li>
              <a
                className="text-blue-700 underline visited:text-purple-900"
                href={projectUrl.href}
                rel="noreferrer"
              >
                Project link
              </a>
            </li>

            <li>
              <a
                className="text-blue-700 underline visited:text-purple-900"
                href={noAccessProjectUrl.href}
                rel="noreferrer"
              >
                Project link you have no access to
              </a>
            </li>
          </>
        )}
        {!data.isBuilderUrl && data.user == null && (
          <li>
            <a
              className="text-blue-700 underline visited:text-purple-900"
              href={'/login'}
              rel="noreferrer"
            >
              Login at authorizer app
            </a>
          </li>
        )}

        {!data.isBuilderUrl && data.user != null && (
          <li>
            <a
              className="text-blue-700 underline visited:text-purple-900"
              href={'/logout'}
              rel="noreferrer"
            >
              Logout at authorizer app
            </a>
          </li>
        )}

        {data.isBuilderUrl && (
          <>
            <li>
              <a
                className="text-blue-700 underline visited:text-purple-900"
                href={data.origin}
                rel="noreferrer"
              >
                Goto Auth Server
              </a>
            </li>

            <li>
              <a
                className="text-blue-700 underline visited:text-purple-900"
                href={'/auth/ws'}
                rel="noreferrer"
              >
                Run Project Login
              </a>
            </li>
            {data.user != null && (
              <li>
                <a
                  className="text-blue-700 underline visited:text-purple-900"
                  href={'/logout'}
                  rel="noreferrer"
                >
                  Run Project Logout
                </a>
              </li>
            )}
          </>
        )}
      </ul>
    </div>
  );
}
