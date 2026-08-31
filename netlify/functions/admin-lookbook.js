import { db } from './_shared/_db.js';
import { exigirAdmin } from './_shared/_auth.js';
import { rota, json, erro, corpoDe, reqDe } from './_shared/_http.js';

const texto = (v, n) => String(v ?? '').trim().slice(0, n);

/* Aceita @usuario, usuario ou o link completo — sempre guarda só o
   @usuario, e o site monta o link certo na hora de mostrar. */
function instagramLimpo(bruto) {
  const s = texto(bruto, 120);
  if (!s) return null;
  const semLink = s.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/$/, '');
  const semArroba = semLink.replace(/^@/, '').trim();
  return semArroba ? semArroba.slice(0, 60) : null;
}

/* GET    /api/admin/lookbook          → todos os itens, inclusive pausados
   POST   /api/admin/lookbook          → cria (sem id) ou atualiza (com id)
   DELETE /api/admin/lookbook?id=5     → apaga */
export const handler = rota(async (event) => {
  await exigirAdmin(reqDe(event));
  const sql = db();

  if (event.httpMethod === 'GET') {
    const itens = await sql`select * from lookbook order by ativo desc, ordem, criado_em desc`;
    return json(200, { itens });
  }

  if (event.httpMethod === 'DELETE') {
    const id = parseInt(event.queryStringParameters?.id, 10);
    if (!id) return erro(400, 'Informe o item.');
    await sql`delete from lookbook where id = ${id}`;
    return json(200, { ok: true });
  }

  if (event.httpMethod === 'POST') {
    const b = corpoDe(event);

    const foto = texto(b.foto, 400);
    if (!foto) return erro(400, 'Envie uma foto.');

    const dados = {
      foto,
      instagram: instagramLimpo(b.instagram),
      legenda: texto(b.legenda, 120) || null,
      ordem: Math.max(0, Math.min(99, parseInt(b.ordem, 10) || 0)),
      ativo: b.ativo !== false
    };

    const id = parseInt(b.id, 10);
    const salvo = id
      ? await sql`
          update lookbook set
            foto=${dados.foto}, instagram=${dados.instagram}, legenda=${dados.legenda},
            ordem=${dados.ordem}, ativo=${dados.ativo}
          where id=${id} returning *`
      : await sql`
          insert into lookbook (foto, instagram, legenda, ordem, ativo)
          values (${dados.foto}, ${dados.instagram}, ${dados.legenda}, ${dados.ordem}, ${dados.ativo})
          returning *`;

    if (!salvo.length) return erro(404, 'Item não encontrado.');
    return json(200, { item: salvo[0] });
  }

  return erro(405, 'Método não permitido.');
});
