import { db } from './_shared/_db.js';
import { clienteLogado, conferirSenha, criarHash, senhaFraca } from './_shared/_auth.js';
import { rota, json, erro, corpoDe, reqDe } from './_shared/_http.js';

/* POST /api/conta/atualizar
   Dados de entrega: { nome, telefone, cpf, cep, endereco, cidade, uf }
   Troca de senha:   { senhaAtual, senhaNova } */
export const handler = rota(async (event) => {
  if (event.httpMethod !== 'POST') return erro(405, 'Método não permitido.');

  const cliente = await clienteLogado(reqDe(event));
  if (!cliente) return erro(401, 'Não autenticada.');

  const sql = db();
  const b = corpoDe(event);

  if (b.senhaNova) {
    const guardada = await sql`select senha from clientes where id = ${cliente.id}`;
    if (!conferirSenha(b.senhaAtual || '', guardada[0].senha)) {
      return erro(400, 'A senha atual não confere.');
    }
    const problema = senhaFraca(b.senhaNova);
    if (problema) return erro(400, problema);
    await sql`update clientes set senha = ${criarHash(b.senhaNova)} where id = ${cliente.id}`;
    return json(200, { ok: true, mensagem: 'Senha alterada.' });
  }

  const corta = (v, n) => String(v ?? '').trim().slice(0, n);
  const atualizado = await sql`
    update clientes set
      nome     = coalesce(nullif(${corta(b.nome, 120)}, ''), nome),
      telefone = ${corta(b.telefone, 20)},
      cpf      = ${String(b.cpf || '').replace(/\D/g, '').slice(0, 11)},
      cep      = ${String(b.cep || '').replace(/\D/g, '').slice(0, 8)},
      endereco = ${corta(b.endereco, 200)},
      cidade   = ${corta(b.cidade, 80)},
      uf       = ${corta(b.uf, 2).toUpperCase()}
    where id = ${cliente.id}
    returning id, nome, email, cpf, telefone, cep, endereco, cidade, uf`;

  return json(200, { cliente: atualizado[0], mensagem: 'Dados salvos.' });
});
