import { db, listarProdutos } from './_shared/_db.js';
import { exigirAdmin } from './_shared/_auth.js';
import { rota, json, erro, corpoDe, reqDe } from './_shared/_http.js';

const lista = v => Array.isArray(v) ? v : [];
const texto = (v, n) => String(v ?? '').trim().slice(0, n);

/* Cada cor é {nome, hex}. Aceita o formato antigo (só a string do
   hex) para não quebrar peças cadastradas antes desta versão. */
function corMap(bruto) {
  const arr = Array.isArray(bruto) ? bruto : [];
  return arr.slice(0, 12).map(c => {
    const hex = String((c && typeof c === 'object' ? c.hex : c) || '').trim();
    const valido = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toUpperCase() : null;
    if (!valido) return null;
    const nome = String((c && typeof c === 'object' ? c.nome : '') || '').trim().slice(0, 30);
    return { nome: nome || 'Cor única', hex: valido };
  }).filter(Boolean);
}

/* GET    /api/admin/produtos          → todas as peças, inclusive pausadas
   POST   /api/admin/produtos          → cria (sem id) ou atualiza (com id)
   DELETE /api/admin/produtos?id=12    → apaga */
export const handler = rota(async (event) => {
  await exigirAdmin(reqDe(event));
  const sql = db();

  if (event.httpMethod === 'GET') {
    return json(200, { produtos: await listarProdutos({ todos: true }) });
  }

  if (event.httpMethod === 'DELETE') {
    const id = parseInt(event.queryStringParameters?.id, 10);
    if (!id) return erro(400, 'Informe a peça.');
    await sql`delete from produtos where id = ${id}`;
    return json(200, { ok: true });
  }

  if (event.httpMethod === 'POST') {
    const b = corpoDe(event);

    const nome = texto(b.nome, 120);
    const preco = Number(b.preco);
    if (nome.length < 2) return erro(400, 'Dê um nome à peça.');
    if (!(preco > 0)) return erro(400, 'Informe um preço maior que zero.');
    if (b.preco_de && Number(b.preco_de) <= preco) {
      return erro(400, 'O preço antigo precisa ser maior que o atual para virar oferta.');
    }

    const dados = {
      nome,
      categoria: texto(b.categoria, 30) || 'vestidos',
      preco,
      preco_de: b.preco_de ? Number(b.preco_de) : null,
      tecido: texto(b.tecido, 60),
      descricao: texto(b.descricao, 900),
      tams: JSON.stringify(lista(b.tams).map(t => texto(t, 12)).filter(Boolean)),
      cores: JSON.stringify(corMap(b.cores)),
      fotos: JSON.stringify(lista(b.fotos).map(f => texto(f, 400)).filter(Boolean)),
      estoque: JSON.stringify(b.estoque && typeof b.estoque === 'object' ? b.estoque : {}),
      novo: !!b.novo,
      destaque: Math.max(0, Math.min(10, parseInt(b.destaque, 10) || 5)),
      ativo: b.ativo !== false
    };

    const id = parseInt(b.id, 10);
    const salvo = id
      ? await sql`
          update produtos set
            nome=${dados.nome}, categoria=${dados.categoria}, preco=${dados.preco},
            preco_de=${dados.preco_de}, tecido=${dados.tecido}, descricao=${dados.descricao},
            tams=${dados.tams}::jsonb, cores=${dados.cores}::jsonb, fotos=${dados.fotos}::jsonb,
            estoque=${dados.estoque}::jsonb, novo=${dados.novo}, destaque=${dados.destaque},
            ativo=${dados.ativo}, atualizado_em=now()
          where id=${id} returning *`
      : await sql`
          insert into produtos
            (nome, categoria, preco, preco_de, tecido, descricao, tams, cores, fotos, estoque, novo, destaque, ativo)
          values
            (${dados.nome}, ${dados.categoria}, ${dados.preco}, ${dados.preco_de}, ${dados.tecido},
             ${dados.descricao}, ${dados.tams}::jsonb, ${dados.cores}::jsonb, ${dados.fotos}::jsonb,
             ${dados.estoque}::jsonb, ${dados.novo}, ${dados.destaque}, ${dados.ativo})
          returning *`;

    if (!salvo.length) return erro(404, 'Peça não encontrada.');
    return json(200, { produto: salvo[0] });
  }

  return erro(405, 'Método não permitido.');
});
