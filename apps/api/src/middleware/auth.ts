import type { Context, Next } from "hono";
import type { Bindings } from "../lib/types";

export function getToken(c: Context<{ Bindings: Bindings }>): string | null {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

export async function validateToken(kv: KVNamespace, token: string): Promise<boolean> {
  const value = await kv.get(`token:${token}`);
  return value !== null;
}

export async function requireAuth(c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> {
  const token = getToken(c);
  if (!token || !(await validateToken(c.env.KV, token))) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("token" as never, token);
  await next();
}
