import { db, normalizarEmail } from './_shared/_db.js';
import { conferirSenha, criarToken, cookieDeSessao, bloqueado, registrarErro, limparErros } from './_shared/_auth.js';
import { rota, json, erro, corpoDe } from './_shared/_http.js';

/* POST /api/conta/entrar  { email, senha } */
export const handler = rota(async (event) => {
  if (event.httpMethod !== 'POST') return erro(405, 'Método não permitido.');

  const corpo = corpoDe(event);
  const email = normalizarEmail(corpo.email);
  const senha = corpo.senha || '';

  if (bloqueado(email)) {
    return erro(429, 'Muitas tentativas. Aguarde 15 minutos ou fale com a gente no WhatsApp.');
  }

  const sql = db();
  const linhas = await sql`
    select id, nome, email, senha, telefone, cpf, cep, endereco, cidade, uf
      from clientes where email = ${email} limit 1`;
  const c = linhas[0];

  // A mesma frase para e-mail inexistente e senha errada: assim
  // ninguém descobre quais e-mails têm conta na loja.
  if (!c || !conferirSenha(senha, c.senha)) {
    registrarErro(email);
    return erro(401, 'E-mail ou senha não conferem.');
  }

  limparErros(email);
  delete c.senha;
  return json(200, { cliente: c }, { 'Set-Cookie': cookieDeSessao(criarToken(c.id)) });
});
