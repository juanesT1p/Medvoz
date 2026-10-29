import { env } from './config/env.js';
import { createApp } from './app.js';

const app = createApp(env);

app.listen(env.PORT, () => {
  console.log(`MedVoz API escuchando en http://localhost:${env.PORT}`);
});
