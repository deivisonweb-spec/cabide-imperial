import { calcular, mp, referencia, mensagemDoStatus } from './_shared/_lib.js';
import { salvarPedido } from './_shared/_db.js';
import { clienteLogado } from './_shared/_auth.js';
import { rota, json, erro, corpoDe, reqDe } from './_shared/_http.js';

/* POST /api/criar-cartao
   O navegador NUNCA manda o número do cartão para cá. O SDK do
   Mercado Pago transforma os dados do cartão num token de uso único
   direto no browser, e é só esse token que chega aqui.

   Recebe: { pagamento:{token,installments,payment_method_id,issuer_id,payer},
             itens, cupom, cliente }
   Devolve: { status, referencia, id, mensagem } */
export const handler = rota(async (event) => {
  if (event.httpMethod !== 'POST') return erro(405, 'Método não permitido.');

  const { pagamento = {}, itens, cupom, cliente: dadosCliente = {} } = corpoDe(event);
  const req = reqDe(event);
  const cliente = await clienteLogado(req).catch(() => null);
  if (!pagamento.token) return erro(400, 'Dados do cartão não recebidos. Preencha o formulário novamente.');

  try {
    const conta = await calcular(itens, cupom, 'cartao');
    const ref = referencia();
    const parcelas = Math.max(1, Math.min(12, parseInt(pagamento.installments, 10) || 1));

    const resposta = await mp('/v1/payments', {
      metodo: 'POST',
      idem: ref,
      corpo: {
        transaction_amount: conta.total,
        token: pagamento.token,
        description: `Pedido ${ref} — Cabide Imperial`,
        installments: parcelas,
        payment_method_id: pagamento.payment_method_id,
        issuer_id: pagamento.issuer_id,
        external_reference: ref,
        notification_url: process.env.URL_WEBHOOK || undefined,
        metadata: {
          pedido: ref,
          telefone: dadosCliente.tel || '',
          entrega: [dadosCliente.end, dadosCliente.cid, dadosCliente.uf, dadosCliente.cep].filter(Boolean).join(' · '),
          itens: conta.linhas.map(l => `${l.qtd}x ${l.nome} (${l.tam})`).join(' | ')
        },
        payer: {
          email: pagamento.payer?.email || dadosCliente.email,
          identification: pagamento.payer?.identification
        }
      }
    });

    try {
      await salvarPedido({
        referencia: ref, clienteId: cliente?.id, cliente: dadosCliente, conta,
        forma: 'cartão', parcelas, mpId: resposta.id
      });
    } catch (e) { console.error('salvarPedido (cartão):', e.message); }

    return json(200, {
      status: resposta.status,
      detalhe: resposta.status_detail,
      referencia: ref,
      id: resposta.id,
      parcelas,
      mensagem: mensagemDoStatus(resposta)
    });

  } catch (e) {
    console.error('criar-cartao:', e.detalhe || e.message);
    return erro(e.http === 401 ? 500 : 400, e.message);
  }
});
