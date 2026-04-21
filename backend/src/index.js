import { createApp } from "./app.js";
import { getConfig } from "./env.js";

const { port } = getConfig();
const app = createApp();

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
