import crypto from 'node:crypto';
import { exigirAdmin } from './_shared/_auth.js';
import { rota, json, erro, reqDe } from './_shared/_http.js';

/* GET /api/admin/assinatura-upload
   Devolve uma autorização de uso único para o navegador enviar a
   foto DIRETO para o Cloudinary — os bytes da imagem nunca passam
   por esta função. Isso importa em dois sentidos: a foto chega mais
   rápido para a cliente (vem do CDN do Cloudinary, não da Netlify),
   e cada foto enviada não consome os créditos do plano gratuito da
   Netlify, que são contados por execução de função.

   Por que não é a foto que fica aqui: a chave secreta do Cloudinary
   nunca pode ir para o navegador. Em vez disso, esta função carimba
   um "timestamp + assinatura" que vale por alguns minutos — o
   Cloudinary confere essa assinatura no upload e recusa qualquer
   uma que não bata, então mesmo alguém abrindo o painel não
   consegue forjar um envio.

   Configuração: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e
   CLOUDINARY_API_SECRET — as três em Cloudinary → Dashboard. */
export const handler = rota(async (event) => {
  if (event.httpMethod !== 'GET') return erro(405, 'Método não permitido.');

  await exigirAdmin(reqDe(event));

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    return erro(500, 'O armazenamento de fotos ainda não foi configurado.');
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = 'pecas';

  // A assinatura cobre exatamente os parâmetros que o navegador vai
  // enviar (fora file, api_key e cloud_name, que o Cloudinary nunca
  // inclui na conta da assinatura). Ordem alfabética é exigência
  // deles, não escolha nossa.
  const paraAssinar = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const assinatura = crypto.createHash('sha1').update(paraAssinar).digest('hex');

  return json(200, { cloudName, apiKey, timestamp, folder, assinatura });
});
