import { db } from './_shared/_db.js';
import { clienteLogado } from './_shared/_auth.js';
import { rota, json, erro, reqDe } from './_shared/_http.js';

/* GET /api/conta/exportar
   A LGPD dá à cliente o direito de receber uma cópia dos dados que
   a loja tem sobre ela. Isto devolve tudo num único JSON. */
export const handler = rota(async (event) => {
  if (event.httpMethod !== 'GET') return erro(405, 'Método não permitido.');

  const cliente = await clienteLogado(reqDe(event));
  if (!cliente) return erro(401, 'Não autenticada.');

  const sql = db();
  const pedidos = await sql`
    select referencia, status, forma, valor, parcelas, itens, entrega, criado_em, pago_em
      from pedidos where cliente_id = ${cliente.id} order by criado_em desc`;

  return json(200, {
    gerado_em: new Date().toISOString(),
    loja: 'Cabide Imperial',
    dados_cadastrais: cliente,
    pedidos
  }, { 'Content-Disposition': 'attachment; filename="meus-dados-cabide-imperial.json"' });
});
