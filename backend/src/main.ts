import { createApp } from "./infrastructure/config/composition.js";

const app = await createApp();
const port = Number(process.env.PORT ?? 8000);

await app.listen({ host: "0.0.0.0", port });
