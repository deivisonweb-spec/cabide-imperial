import { db } from './_shared/_db.js';
import { clienteLogado } from './_shared/_auth.js';
import { rota, json, erro, reqDe } from './_shared/_http.js';

/* GET /api/conta/eu
   Devolve o perfil e o histórico de pedidos de quem está logado. */
export const handler = rota(async (event) => {
  if (event.httpMethod !== 'GET') return erro(405, 'Método não permitido.');

  const cliente = await clienteLogado(reqDe(event));
  if (!cliente) return erro(401, 'Não autenticada.');

  const sql = db();
  const pedidos = await sql`
    select referencia, status, forma, valor, parcelas, itens, entrega, criado_em, pago_em
      from pedidos
     where cliente_id = ${cliente.id}
     order by criado_em desc
     limit 100`;

  return json(200, { cliente, pedidos });
});
