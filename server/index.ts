import { createApp } from "./app.js";
import { prisma } from "./db.js";
import { FdcClient } from "./fdc.js";

const port = Number(process.env.PORT ?? 3000);
const apiKey = process.env.FDC_API_KEY ?? "DEMO_KEY";
if (apiKey === "DEMO_KEY") console.warn("FDC_API_KEY not set; using DEMO_KEY (30 requests/hour).");

const app = createApp({ prisma, fdc: new FdcClient(apiKey), serveClient: process.env.NODE_ENV === "production" });
app.listen(port, () => console.log(`Listening on http://localhost:${port}`));
