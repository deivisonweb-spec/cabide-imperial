import { listarProdutos } from './_shared/_db.js';
import { rota, json, erro } from './_shared/_http.js';

/* GET /api/produtos
   A vitrine chama isto ao abrir. Se o banco ainda não tiver peças
   cadastradas, devolve lista vazia e o site usa o catálogo de
   demonstração que já vem dentro do index.html. */
export const handler = rota(async (event) => {
  if (event.httpMethod !== 'GET') return erro(405, 'Método não permitido.');

  try {
    if (!process.env.DATABASE_URL) return json(200, { produtos: [] });

    const linhas = await listarProdutos();

    const produtos = linhas.map(p => ({
      id: Number(p.id),  // o banco devolve como texto; o site inteiro compara por número
      nome: p.nome,
      cat: p.categoria,
      preco: Number(p.preco),
      de: p.preco_de ? Number(p.preco_de) : undefined,
      tecido: p.tecido || '',
      desc: p.descricao || '',
      tams: p.tams || [],
      cores: p.cores || [],   // [{nome,hex}] — o site resolve o nome
      fotos: p.fotos || [],
      estoque: p.estoque || {},
      novo: p.novo,
      destaque: p.destaque
    }));

    // 60 s de cache na borda: a vitrine abre instantânea e uma peça
    // nova aparece para todo mundo em no máximo um minuto.
    return json(200, { produtos }, { 'Cache-Control': 's-maxage=60, stale-while-revalidate=300' });

  } catch (e) {
    console.error('produtos:', e.message);
    return json(200, { produtos: [] });
  }
});
