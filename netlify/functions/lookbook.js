import { db } from './_shared/_db.js';
import { rota, json, erro } from './_shared/_http.js';

/* GET /api/lookbook
   A seção "Lookbook" da vitrine chama isto ao abrir. Diferente dos
   produtos, cada foto aqui é uma inspiração de estilo — não precisa
   estar à venda — com o crédito de Instagram de quem está usando,
   quando a loja tiver essa informação. */
export const handler = rota(async (event) => {
  if (event.httpMethod !== 'GET') return erro(405, 'Método não permitido.');

  try {
    if (!process.env.DATABASE_URL) return json(200, { itens: [] });

    const sql = db();
    const linhas = await sql`
      select id, foto, instagram, legenda
        from lookbook
       where ativo = true
       order by ordem, criado_em desc
       limit 24`;

    return json(200, { itens: linhas }, { 'Cache-Control': 's-maxage=60, stale-while-revalidate=300' });
  } catch (e) {
    console.error('lookbook:', e.message);
    return json(200, { itens: [] });
  }
});
