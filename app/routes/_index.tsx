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
import { builderAuthenticator } from '~/utils/builder-auth.server';

export const meta: MetaFunction = () => {
  return [
    { title: 'New Remix App' },
    { name: 'description', content: 'Welcome to Remix!' },
  ];
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const sess = await sessionStorage.getSession(request.headers.get('Cookie'));

  console.log(sess.data);

  const user = isBuilderUrl(request.url)
    ? await builderAuthenticator.isAuthenticated(request)
    : await authenticator.isAuthenticated(request);

  return {
    user,
    isBuilderUrl: isBuilderUrl(request.url),
    origin: getAuthorizationServerOrigin(request),
  };
};

const fetchAllProjectIdsLoggedInAfterIssueDate = async (
  userId: string,
  issueDate: number
) => {
  return [
    {
      id: '9ccd96e1-de48-4f3f-898b-042e890ae805',
    },
  ];
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
            {data.user != null && (
              <li>
                <a
                  className="text-blue-700 underline visited:text-purple-900"
                  href="#"
                  rel="noreferrer"
                  onClick={async (event) => {
                    if (data.user == null) {
                      return;
                    }

                    const projectsToLogout =
                      await fetchAllProjectIdsLoggedInAfterIssueDate(
                        data.user.id,
                        data.user.sessionIssueDate
                      );

                    // @todo use https://github.com/sindresorhus/p-all to execute in parallel like concurrency=5 stopOnError=false
                    // @todo remove /logout from rate limiter
                    for (const project of projectsToLogout) {
                      const projectUrl = new URL(data.origin);
                      projectUrl.host = `p-${project.id}.${projectUrl.host}`;

                      await fetch(`${projectUrl.origin}/logout`, {
                        method: 'GET',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        redirect: 'manual',
                        credentials: 'include',
                      });
                    }
                  }}
                >
                  Logout from Project {data.user.sessionIssueDate}
                </a>
              </li>
            )}

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
