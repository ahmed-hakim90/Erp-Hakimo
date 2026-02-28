import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { authRoutes } from "./modules/auth/routes.js";
import { productionRoutes } from "./modules/production/routes.js";
import { systemRoutes } from "./modules/system/routes.js";
import { errorHandler, notFound } from "./middlewares/error.js";

const app = express();

app.use(
  cors({
    origin: env.corsOrigin.split(",").map((s) => s.trim()),
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "hakimo-backend" });
});

const api = express.Router();
api.use("/auth", authRoutes);
api.use("/production", productionRoutes);
api.use("/system", systemRoutes);
api.use("/", systemRoutes);
app.use("/api", api);

app.use(notFound);
app.use(errorHandler);

export { app };

