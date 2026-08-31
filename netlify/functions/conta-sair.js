import { cookieDeSaida } from './_shared/_auth.js';
import { rota, json } from './_shared/_http.js';

/* POST /api/conta/sair */
export const handler = rota(async () => {
  return json(200, { ok: true }, { 'Set-Cookie': cookieDeSaida() });
});
