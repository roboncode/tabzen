import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Bindings } from "./lib/types";
import { sync } from "./routes/sync";
import { content } from "./routes/content";

const app = new Hono<{ Bindings: Bindings }>();
app.use("/*", cors());
app.route("/sync", sync);
app.route("/content", content);

export default app;
