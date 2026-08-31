import { db } from './_shared/_db.js';
import { exigirAdmin } from './_shared/_auth.js';
import { rota, json, erro, corpoDe, reqDe } from './_shared/_http.js';

/* GET  /api/admin/pedidos           → últimos 200 pedidos + resumo do mês
   POST /api/admin/pedidos           → { referencia, status?, rastreio? } */
export const handler = rota(async (event) => {
  await exigirAdmin(reqDe(event));
  const sql = db();

  if (event.httpMethod === 'GET') {
    const pedidos = await sql`
      select referencia, nome, email, status, forma, valor, parcelas,
             itens, entrega, rastreio, criado_em, pago_em
        from pedidos order by criado_em desc limit 200`;

    const resumo = await sql`
      select count(*)::int as vendas, coalesce(sum(valor),0) as total
        from pedidos
       where status in ('pago','enviado','entregue')
         and coalesce(pago_em, criado_em) >= date_trunc('month', now())`;

    return json(200, { pedidos, resumo: resumo[0] });
  }

  if (event.httpMethod === 'POST') {
    const b = corpoDe(event);
    const ref = String(b.referencia || '').trim();
    if (!ref) return erro(400, 'Informe o pedido.');

    const permitidos = ['pendente', 'pago', 'enviado', 'entregue', 'recusado', 'cancelado'];
    if (b.status && !permitidos.includes(b.status)) {
      return erro(400, 'Status inválido.');
    }

    const atualizado = await sql`
      update pedidos set
        status   = coalesce(${b.status || null}, status),
        rastreio = coalesce(${b.rastreio ?? null}, rastreio)
      where referencia = ${ref}
      returning referencia, status, rastreio`;

    if (!atualizado.length) return erro(404, 'Pedido não encontrado.');
    return json(200, { pedido: atualizado[0] });
  }

  return erro(405, 'Método não permitido.');
});
