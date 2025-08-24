import { Response } from 'express';

export function setCookie(res: Response, name: string, value: string, options: {
  httpOnly?: boolean;
  secure?: boolean;
  maxAge?: number;
  sameSite?: 'strict' | 'lax' | 'none';
  path?: string;
} = {}) {
  let cookieString = `${name}=${encodeURIComponent(value)}`;
  
  if (options.httpOnly) cookieString += '; HttpOnly';
  if (options.secure) cookieString += '; Secure';
  if (options.maxAge) cookieString += `; Max-Age=${Math.floor(options.maxAge / 1000)}`;
  if (options.sameSite) cookieString += `; SameSite=${options.sameSite}`;
  if (options.path) cookieString += `; Path=${options.path}`;
  
  res.setHeader('Set-Cookie', cookieString);
}

export function clearCookie(res: Response, name: string, path = '/') {
  res.setHeader('Set-Cookie', `${name}=; Path=${path}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
}
