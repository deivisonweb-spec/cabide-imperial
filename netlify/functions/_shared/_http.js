/* ═══════════════════════════════════════════════════════════════
   CABIDE IMPERIAL — camada HTTP (Netlify Functions)

   A Vercel deixa a função escrever direto na resposta
   (res.status(200).json({...})). A Netlify pede o oposto: a função
   RETORNA um objeto {statusCode, headers, body} e a plataforma
   decide o que fazer com ele. Este arquivo existe para que o resto
   do código (regras de negócio, banco, autenticação) não precise
   saber qual das duas está por trás — só usa `json(...)`, `erro(...)`
   e `corpoDe(event)`.
   ═══════════════════════════════════════════════════════════════ */

/** Cabeçalhos de CORS. Com cookie de sessão em jogo, o navegador
    exige uma origem exata — curinga (*) e credenciais não convivem.
    Por isso, quando ORIGEM_PERMITIDA está definida, ela é devolvida
    como está; sem ela, cai no curinga (sem cookies funcionando). */
export function corsHeaders() {
  const permitida = process.env.ORIGEM_PERMITIDA;
  const h = {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS'
  };
  if (permitida) {
    h['Access-Control-Allow-Origin'] = permitida;
    h['Access-Control-Allow-Credentials'] = 'true';
    h['Vary'] = 'Origin';
  } else {
    h['Access-Control-Allow-Origin'] = '*';
  }
  return h;
}

/** Resposta OPTIONS de pré-voo, ou null se a requisição já pode seguir. */
export function preflight(event) {
  if (event.httpMethod !== 'OPTIONS') return null;
  return { statusCode: 204, headers: corsHeaders(), body: '' };
}

/** Monta uma resposta JSON. Uso: return json(200, { ok: true }) */
export function json(status, corpo, extras = {}) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(), ...extras },
    body: JSON.stringify(corpo)
  };
}

/** Atalho para erros — sempre no formato { erro: "mensagem" } que o
    site espera. */
export function erro(status, mensagem) {
  return json(status, { erro: mensagem });
}

/** Lê o corpo da requisição como JSON. A Netlify entrega texto puro
    (às vezes em base64, se vier de um cliente binário); a Vercel
    entregava isso já pronto como objeto — aqui fazemos esse trabalho
    nós mesmos. Corpo ausente ou inválido vira objeto vazio. */
export function corpoDe(event) {
  if (!event.body) return {};
  const texto = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
  try { return JSON.parse(texto); } catch { return {}; }
}

/** Constrói um objeto `req` no formato que _auth.js e _lib.js já
    esperam (com .headers), a partir do `event` da Netlify. Existe só
    para o código de autenticação não precisar saber de qual
    plataforma o pedido veio. */
export function reqDe(event) {
  return { headers: event.headers || {}, query: event.queryStringParameters || {} };
}

/** Envolve o handler de uma função com o tratamento padrão: responde
    o OPTIONS sozinho e transforma qualquer erro solto em JSON — nunca
    deixa a função do servidor cair sem resposta, o que a Netlify
    mostraria como "erro de servidor" cru para a cliente.
    Usa e.http quando a função marcou um (401 de sessão ausente, 403
    de acesso negado, 409 de conflito...) e cai em 400 por padrão. */
export function rota(fn) {
  return async (event, context) => {
    const opt = preflight(event);
    if (opt) return opt;
    try {
      return await fn(event, context);
    } catch (e) {
      console.error('erro não tratado:', e.detalhe || e.message);
      return erro(e.http || 400, e.message || 'Algo deu errado. Tente novamente.');
    }
  };
}
