import { createCookieSessionStorage } from '@remix-run/node';
import env from './env.server';

// export the whole sessionStorage object
export const sessionStorage = createCookieSessionStorage({
  cookie: {
    maxAge: 60 * 60 * 24 * 30,
    name: '_session', // use any name you want here
    sameSite: 'lax', // this helps with CSRF
    path: '/', // remember to add this so the cookie will work in all routes
    httpOnly: true, // for security reasons, make this cookie http only
    secrets: env.AUTH_SECRET ? [env.AUTH_SECRET] : undefined, // replace this with an actual secret
    secure: true,
  },
});
