import { db } from './_shared/_db.js';
import { clienteLogado, conferirSenha, cookieDeSaida } from './_shared/_auth.js';
import { rota, json, erro, corpoDe, reqDe } from './_shared/_http.js';

/* POST /api/conta/excluir  { senha }

   A conta é apagada, mas o registro da venda permanece — sem nome,
   sem e-mail, sem endereço. A LGPD permite (e a Receita exige) guardar
   a nota da operação; o que não pode ficar é o dado pessoal. */
export const handler = rota(async (event) => {
  if (event.httpMethod !== 'POST') return erro(405, 'Método não permitido.');

  const cliente = await clienteLogado(reqDe(event));
  if (!cliente) return erro(401, 'Não autenticada.');

  const sql = db();
  const guardada = await sql`select senha from clientes where id = ${cliente.id}`;
  const { senha } = corpoDe(event);
  if (!conferirSenha(senha || '', guardada[0].senha)) {
    return erro(400, 'Confirme sua senha para excluir a conta.');
  }

  await sql`
    update pedidos
       set cliente_id = null,
           email = 'removido@lgpd',
           nome  = 'Cliente removida',
           entrega = jsonb_build_object('uf', coalesce(entrega->>'uf', ''))
     where cliente_id = ${cliente.id}`;

  await sql`delete from clientes where id = ${cliente.id}`;

  return json(200, { ok: true, mensagem: 'Conta excluída.' }, { 'Set-Cookie': cookieDeSaida() });
});
