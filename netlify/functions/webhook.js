import crypto from 'node:crypto';
import { mp } from './_shared/_lib.js';
import { atualizarStatusPedido } from './_shared/_db.js';
import { corpoDe } from './_shared/_http.js';

/* POST /api/webhook
   O Mercado Pago avisa aqui toda vez que um pagamento muda de estado.
   É o que garante que a venda seja registrada mesmo se a cliente
   fechar o navegador logo depois de pagar.

   Este endpoint é conversa de servidor para servidor — o Mercado
   Pago, não um navegador — então não precisa de CORS nem do
   tratamento de erro pensado para quem está comprando. Por isso não
   usa o rota() dos outros arquivos: aqui o objetivo é sempre
   responder 200 rápido (para não gerar reenvio em cadeia), exceto
   quando a assinatura não confere.

   Configure a URL em: Mercado Pago › Suas integrações › Webhooks
   https://seusite.netlify.app/api/webhook  (evento: Pagamentos) */

function assinaturaConfere(event) {
  const segredo = process.env.MP_WEBHOOK_SECRET;
  if (!segredo) return true; // sem segredo configurado, não valida

  const assinatura = event.headers?.['x-signature'];
  const requestId = event.headers?.['x-request-id'];
  if (!assinatura) return false;

  const partes = Object.fromEntries(
    String(assinatura).split(',').map(p => p.split('=').map(s => s.trim()))
  );
  const { ts, v1 } = partes;
  if (!ts || !v1) return false;

  const corpo = corpoDe(event);
  const id = event.queryStringParameters?.['data.id'] || corpo?.data?.id || '';
  const base = `id:${id};request-id:${requestId};ts:${ts};`;
  const esperado = crypto.createHmac('sha256', segredo).update(base).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(v1));
  } catch {
    return false;
  }
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: '' };

  if (!assinaturaConfere(event)) {
    console.warn('webhook: assinatura inválida');
    return { statusCode: 401, body: '' };
  }

  try {
    const corpo = corpoDe(event);
    const tipo = corpo?.type || event.queryStringParameters?.type;
    const id = corpo?.data?.id || event.queryStringParameters?.['data.id'];
    if (tipo !== 'payment' || !id) return { statusCode: 200, body: '' };

    const p = await mp(`/v1/payments/${id}`);
    const pedido = p.external_reference || p.metadata?.pedido || '(sem referência)';

    console.log(`[${pedido}] ${p.status} · ${p.payment_method_id} · R$ ${p.transaction_amount}`);

    const mapa = { approved: 'pago', rejected: 'recusado', cancelled: 'cancelado',
                   refunded: 'estornado', charged_back: 'estornado', in_process: 'em análise' };
    if (p.external_reference && mapa[p.status]) {
      try { await atualizarStatusPedido(p.external_reference, mapa[p.status], p.id); }
      catch (e) { console.error('atualizar pedido:', e.message); }
    }

    if (p.status === 'approved') {
      // ── Venda confirmada. Aqui é onde você avisa a loja. ──
      // Se você configurar URL_AVISO com um webhook do Make, n8n ou
      // Zapier, o pedido chega no WhatsApp/e-mail automaticamente.
      if (process.env.URL_AVISO) {
        await fetch(process.env.URL_AVISO, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pedido,
            valor: p.transaction_amount,
            forma: p.payment_method_id,
            parcelas: p.installments,
            cliente: p.payer?.email,
            telefone: p.metadata?.telefone,
            entrega: p.metadata?.entrega,
            itens: p.metadata?.itens,
            pagoEm: p.date_approved
          })
        }).catch(e => console.error('aviso:', e.message));
      }
    }

    return { statusCode: 200, body: '' };
  } catch (e) {
    console.error('webhook:', e.message);
    return { statusCode: 200, body: '' };
  }
};
