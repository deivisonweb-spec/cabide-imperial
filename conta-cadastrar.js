import { db, normalizarEmail, vincularPedidosPeloEmail } from './_shared/_db.js';
import { criarHash, senhaFraca, criarToken, cookieDeSessao } from './_shared/_auth.js';
import { rota, json, erro, corpoDe } from './_shared/_http.js';

/* POST /api/conta/cadastrar
   { nome, email, senha, telefone?, cpf? } */
export const handler = rota(async (event) => {
  if (event.httpMethod !== 'POST') return erro(405, 'Método não permitido.');

  const { nome, email, senha, telefone, cpf } = corpoDe(event);

  const limpo = normalizarEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(limpo)) {
    return erro(400, 'Informe um e-mail válido.');
  }
  if (String(nome || '').trim().split(/\s+/).length < 2) {
    return erro(400, 'Informe seu nome completo.');
  }
  const problema = senhaFraca(senha);
  if (problema) return erro(400, problema);

  const sql = db();
  const jaExiste = await sql`select id from clientes where email = ${limpo} limit 1`;
  if (jaExiste.length) {
    return erro(409, 'Já existe uma conta com este e-mail. Tente entrar.');
  }

  const criado = await sql`
    insert into clientes (nome, email, senha, telefone, cpf)
    values (${String(nome).trim()}, ${limpo}, ${criarHash(senha)},
            ${String(telefone || '').slice(0, 20)}, ${String(cpf || '').replace(/\D/g, '').slice(0, 11)})
    returning id, nome, email, telefone, cpf`;

  const cliente = criado[0];

  // Se ela já tinha comprado como visitante com este e-mail,
  // aqueles pedidos passam a aparecer no histórico dela.
  await vincularPedidosPeloEmail(cliente.id, limpo);

  return json(201, { cliente }, { 'Set-Cookie': cookieDeSessao(criarToken(cliente.id)) });
});
