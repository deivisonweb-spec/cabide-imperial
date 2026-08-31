import { db } from './_shared/_db.js';
import { clienteLogado } from './_shared/_auth.js';
import { rota, json, erro, corpoDe, reqDe } from './_shared/_http.js';

const ELEGIVEIS = ['pago', 'enviado', 'entregue'];

/* POST /api/conta/avaliar
   { referencia, nota, comentario }
   Só aceita avaliar um pedido que: existe, é da própria cliente
   logada, já foi pago (não dá pra avaliar o que não comprou), e
   ainda não foi avaliado antes (o banco também garante isso). */
export const handler = rota(async (event) => {
  if (event.httpMethod !== 'POST') return erro(405, 'Método não permitido.');

  const cliente = await clienteLogado(reqDe(event));
  if (!cliente) return erro(401, 'Entre na sua conta para avaliar.');

  const { referencia, nota, comentario } = corpoDe(event);
  const notaNum = parseInt(nota, 10);
  const texto = String(comentario || '').trim();

  if (!referencia) return erro(400, 'Pedido não informado.');
  if (!(notaNum >= 1 && notaNum <= 5)) return erro(400, 'Escolha de 1 a 5 estrelas.');
  if (texto.length < 10) return erro(400, 'Escreva um pouco mais sobre sua experiência (mínimo 10 caracteres).');
  if (texto.length > 600) return erro(400, 'Comentário muito longo.');

  const sql = db();
  const pedidos = await sql`
    select referencia, cliente_id, status, entrega
      from pedidos where referencia = ${referencia} limit 1`;
  const pedido = pedidos[0];

  if (!pedido) return erro(404, 'Pedido não encontrado.');
  if (pedido.cliente_id !== cliente.id) return erro(403, 'Este pedido não é da sua conta.');
  if (!ELEGIVEIS.includes(pedido.status)) {
    return erro(400, 'Só é possível avaliar depois que o pagamento for confirmado.');
  }

  const jaExiste = await sql`select id from avaliacoes where pedido_referencia = ${referencia}`;
  if (jaExiste.length) return erro(409, 'Você já avaliou este pedido.');

  const ent = typeof pedido.entrega === 'string' ? JSON.parse(pedido.entrega) : (pedido.entrega || {});

  const salvo = await sql`
    insert into avaliacoes (cliente_id, pedido_referencia, nome, cidade, uf, nota, comentario)
    values (${cliente.id}, ${referencia}, ${cliente.nome}, ${ent.cidade || null}, ${ent.uf || null}, ${notaNum}, ${texto})
    returning id`;

  return json(201, { ok: true, id: salvo[0].id });
});
