import { neon } from '@neondatabase/serverless';

/* ═══════════════════════════════════════════════════════════════
   Banco de dados (Postgres no Neon)

   A string de conexão fica em DATABASE_URL, como variável de
   ambiente. Ela dá acesso total ao banco — nunca coloque no
   index.html nem suba para o GitHub.

   O esquema das tabelas está em schema.sql, na raiz do projeto.
   ═══════════════════════════════════════════════════════════════ */

let _sql = null;

export function db() {
  if (!process.env.DATABASE_URL) {
    throw new Error('O banco de dados ainda não foi configurado no servidor.');
  }
  if (!_sql) _sql = neon(process.env.DATABASE_URL);
  return _sql;
}

/** Normaliza e-mail para servir de chave única. */
export const normalizarEmail = e => String(e || '').trim().toLowerCase();

/** Guarda um pedido assim que a cobrança é criada (ainda pendente). */
export async function salvarPedido({ referencia, clienteId, cliente, conta, forma, parcelas, mpId }) {
  const sql = db();
  await sql`
    insert into pedidos
      (referencia, cliente_id, email, nome, status, forma, valor, parcelas, itens, entrega, mp_id)
    values (
      ${referencia},
      ${clienteId || null},
      ${normalizarEmail(cliente.email)},
      ${cliente.nome || ''},
      'pendente',
      ${forma},
      ${conta.total},
      ${parcelas || 1},
      ${JSON.stringify(conta.linhas)},
      ${JSON.stringify({
        cep: cliente.cep || '', endereco: cliente.end || '',
        cidade: cliente.cid || '', uf: cliente.uf || '', telefone: cliente.tel || ''
      })},
      ${String(mpId || '')}
    )
    on conflict (referencia) do nothing`;
}

/** Catálogo publicado, na ordem em que a vitrine mostra. */
export async function listarProdutos({ todos = false } = {}) {
  const sql = db();
  return todos
    ? await sql`select * from produtos order by ativo desc, destaque desc, criado_em desc`
    : await sql`select id, nome, categoria, preco, preco_de, tecido, descricao,
                       tams, cores, fotos, estoque, novo, destaque
                  from produtos where ativo = true order by destaque desc, criado_em desc`;
}

/** Preços oficiais das peças de um pedido, direto da fonte da verdade. */
export async function precosDe(ids) {
  const sql = db();
  const linhas = await sql`select id, nome, preco, estoque, ativo from produtos where id = any(${ids})`;
  const mapa = {};
  for (const l of linhas) mapa[l.id] = l;
  return mapa;
}

/** Chamado pelo webhook quando o Mercado Pago confirma (ou recusa). */
export async function atualizarStatusPedido(referencia, status, mpId) {
  const sql = db();
  await sql`
    update pedidos
       set status  = ${status},
           mp_id   = coalesce(nullif(${String(mpId || '')}, ''), mp_id),
           pago_em = case when ${status} = 'pago' then now() else pago_em end
     where referencia = ${referencia}`;
}

/** Liga pedidos antigos feitos como visitante à conta recém-criada. */
export async function vincularPedidosPeloEmail(clienteId, email) {
  const sql = db();
  await sql`
    update pedidos set cliente_id = ${clienteId}
     where cliente_id is null and email = ${normalizarEmail(email)}`;
}
