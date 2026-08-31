import { db } from './_shared/_db.js';
import { exigirAdmin } from './_shared/_auth.js';
import { rota, json, erro, corpoDe, reqDe } from './_shared/_http.js';

/* GET    /api/admin/avaliacoes           → todas, inclusive escondidas
   POST   /api/admin/avaliacoes           → { id, visivel } alterna vitrine
   DELETE /api/admin/avaliacoes?id=5      → apaga de vez */
export const handler = rota(async (event) => {
  await exigirAdmin(reqDe(event));
  const sql = db();

  if (event.httpMethod === 'GET') {
    const itens = await sql`
      select id, nome, cidade, uf, nota, comentario, visivel, pedido_referencia, criado_em
        from avaliacoes order by criado_em desc`;
    return json(200, { itens });
  }

  if (event.httpMethod === 'DELETE') {
    const id = parseInt(event.queryStringParameters?.id, 10);
    if (!id) return erro(400, 'Informe a avaliação.');
    await sql`delete from avaliacoes where id = ${id}`;
    return json(200, { ok: true });
  }

  if (event.httpMethod === 'POST') {
    const { id, visivel } = corpoDe(event);
    const idNum = parseInt(id, 10);
    if (!idNum) return erro(400, 'Informe a avaliação.');

    const salvo = await sql`
      update avaliacoes set visivel = ${!!visivel} where id = ${idNum} returning id, visivel`;
    if (!salvo.length) return erro(404, 'Avaliação não encontrada.');
    return json(200, { item: salvo[0] });
  }

  return erro(405, 'Método não permitido.');
});
