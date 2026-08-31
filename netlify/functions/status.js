import { mp } from './_shared/_lib.js';
import { rota, json, erro } from './_shared/_http.js';

/* GET /api/status?id=123456789
   A tela do Pix chama isto de tempo em tempo até o pagamento cair. */
export const handler = rota(async (event) => {
  if (event.httpMethod !== 'GET') return erro(405, 'Método não permitido.');

  const id = String(event.queryStringParameters?.id || '').replace(/\D/g, '');
  if (!id) return erro(400, 'Informe o id do pagamento.');

  try {
    const p = await mp(`/v1/payments/${id}`);
    return json(200, {
      status: p.status,
      detalhe: p.status_detail,
      referencia: p.external_reference,
      valor: p.transaction_amount
    });
  } catch (e) {
    console.error('status:', e.detalhe || e.message);
    return erro(400, e.message);
  }
});
