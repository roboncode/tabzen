import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Bindings } from "./lib/types";
import { sync } from "./routes/sync";

const app = new Hono<{ Bindings: Bindings }>();
app.use("/*", cors());
app.route("/sync", sync);

export default app;
