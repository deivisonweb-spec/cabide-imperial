import { calcular, mp, referencia, expiraEm } from './_shared/_lib.js';
import { salvarPedido } from './_shared/_db.js';
import { clienteLogado } from './_shared/_auth.js';
import { rota, json, erro, corpoDe, reqDe } from './_shared/_http.js';

/* POST /api/criar-pix
   Recebe: { itens:[{id,qtd,tam}], cupom, cliente:{nome,email,cpf,...} }
   Devolve: { id, referencia, valor, qrBase64, copiaECola, expiraEm } */
export const handler = rota(async (event) => {
  if (event.httpMethod !== 'POST') return erro(405, 'Método não permitido.');

  const { itens, cupom, cliente: dadosCliente = {} } = corpoDe(event);
  const req = reqDe(event);
  const cliente = await clienteLogado(req).catch(() => null);

  const cpf = String(dadosCliente.cpf || '').replace(/\D/g, '');
  if (cpf.length !== 11) return erro(400, 'Informe um CPF válido para gerar o Pix.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(dadosCliente.email || '')) {
    return erro(400, 'Informe um e-mail válido.');
  }

  try {
    const conta = await calcular(itens, cupom, 'pix');
    const ref = referencia();
    const partes = String(dadosCliente.nome || 'Cliente').trim().split(/\s+/);

    const pagamento = await mp('/v1/payments', {
      metodo: 'POST',
      idem: ref,
      corpo: {
        transaction_amount: conta.total,
        description: `Pedido ${ref} — Cabide Imperial`,
        payment_method_id: 'pix',
        external_reference: ref,
        date_of_expiration: expiraEm(30),
        notification_url: process.env.URL_WEBHOOK || undefined,
        metadata: {
          pedido: ref,
          telefone: dadosCliente.tel || '',
          entrega: [dadosCliente.end, dadosCliente.cid, dadosCliente.uf, dadosCliente.cep].filter(Boolean).join(' · '),
          itens: conta.linhas.map(l => `${l.qtd}x ${l.nome} (${l.tam})`).join(' | ')
        },
        payer: {
          email: dadosCliente.email,
          first_name: partes[0],
          last_name: partes.slice(1).join(' ') || partes[0],
          identification: { type: 'CPF', number: cpf }
        }
      }
    });

    const dados = pagamento.point_of_interaction?.transaction_data || {};
    if (!dados.qr_code) throw new Error('O Mercado Pago não devolveu o código Pix. Tente novamente.');

    // Guarda o pedido como pendente. O webhook marca como pago depois.
    // Se o banco falhar, a cobrança já existe e não pode ser perdida —
    // por isso o erro é só registrado, não devolvido à cliente.
    try {
      await salvarPedido({
        referencia: ref, clienteId: cliente?.id, cliente: dadosCliente,
        conta, forma: 'pix', parcelas: 1, mpId: pagamento.id
      });
    } catch (e) { console.error('salvarPedido (pix):', e.message); }

    return json(200, {
      id: pagamento.id,
      referencia: ref,
      valor: conta.total,
      qrBase64: dados.qr_code_base64,
      copiaECola: dados.qr_code,
      expiraEm: pagamento.date_of_expiration
    });

  } catch (e) {
    console.error('criar-pix:', e.detalhe || e.message);
    // 401 aqui é o Mercado Pago recusando a NOSSA credencial, não a
    // cliente — mostrar 401 pra ela sugeriria que é ela quem precisa
    // "logar de novo", o que não é o caso. 500 é mais honesto.
    return erro(e.http === 401 ? 500 : 400, e.message);
  }
});
