import { db } from './_shared/_db.js';
import { clienteLogado } from './_shared/_auth.js';
import { rota, json, erro, reqDe } from './_shared/_http.js';

/* GET /api/conta/eu
   Devolve o perfil e o histórico de pedidos de quem está logado.
   `avaliado` diz se aquele pedido já tem uma avaliação — assim o
   site só mostra o botão "Avaliar" onde ainda faz sentido. */
export const handler = rota(async (event) => {
  if (event.httpMethod !== 'GET') return erro(405, 'Método não permitido.');

  const cliente = await clienteLogado(reqDe(event));
  if (!cliente) return erro(401, 'Não autenticada.');

  const sql = db();
  const pedidos = await sql`
    select p.referencia, p.status, p.forma, p.valor, p.parcelas, p.itens, p.entrega, p.criado_em, p.pago_em,
           (a.id is not null) as avaliado
      from pedidos p
      left join avaliacoes a on a.pedido_referencia = p.referencia
     where p.cliente_id = ${cliente.id}
     order by p.criado_em desc
     limit 100`;

  return json(200, { cliente, pedidos });
});
