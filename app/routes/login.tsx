import { json, LoaderFunctionArgs, redirect } from '@remix-run/node';
import { authenticator } from '~/utils/auth.server';
import { isBuilderUrl } from '~/utils/origins.server';
import { returnToCookie } from '~/utils/return-to.cookie.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (isBuilderUrl(request.url)) {
    return new Response(null, {
      status: 404,
      statusText: 'Builder has its own login process',
    });
  }

  const user = await authenticator.isAuthenticated(request);

  const url = new URL(request.url);
  let returnTo = url.searchParams.get('returnTo');

  if (user) {
    throw redirect(returnTo ?? '/');
  }

  const headers = new Headers();

  if (returnTo) {
    headers.append('Set-Cookie', await returnToCookie.serialize(returnTo));
  }

  return json({}, { headers });
};

export default function Login() {
  return (
    <div className="font-sans p-4">
      <h1 className="text-3xl">Login</h1>
      <form method="post" action="/auth/dev">
        <label className="block mt-4">
          <span className="text-gray-700">Password</span>
          <input
            type="password"
            name="password"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          />
        </label>
        <button
          type="submit"
          className="mt-4 bg-blue-500 text-white px-4 py-2 rounded"
        >
          Login
        </button>
      </form>
    </div>
  );
}
