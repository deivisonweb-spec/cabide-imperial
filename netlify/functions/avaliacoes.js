import { db } from './_shared/_db.js';
import { rota, json, erro } from './_shared/_http.js';

/* "Rebeca Moreira" -> "Rebeca M." — o site nunca expõe o sobrenome
   completo de quem avaliou, só o suficiente para parecer pessoal. */
function nomeExibicao(nome) {
  const partes = String(nome || '').trim().split(/\s+/);
  if (partes.length < 2) return partes[0] || 'Cliente';
  return `${partes[0]} ${partes[partes.length - 1][0]}.`;
}

/* GET /api/avaliacoes
   A seção "Clientes que voltam" da home chama isto. Só mostra
   avaliações de pedidos de verdade — nunca depoimento fictício. */
export const handler = rota(async (event) => {
  if (event.httpMethod !== 'GET') return erro(405, 'Método não permitido.');

  try {
    if (!process.env.DATABASE_URL) return json(200, { itens: [] });

    const sql = db();
    const linhas = await sql`
      select id, nome, cidade, uf, nota, comentario, criado_em
        from avaliacoes
       where visivel = true
       order by criado_em desc
       limit 24`;

    const itens = linhas.map(l => ({ ...l, nome: nomeExibicao(l.nome) }));

    return json(200, { itens }, { 'Cache-Control': 's-maxage=60, stale-while-revalidate=300' });
  } catch (e) {
    console.error('avaliacoes:', e.message);
    return json(200, { itens: [] });
  }
});
