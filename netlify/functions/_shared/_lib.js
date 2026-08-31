/* ═══════════════════════════════════════════════════════════════
   CABIDE IMPERIAL — biblioteca do servidor
   Tudo que envolve dinheiro é calculado AQUI, nunca no navegador.
   O site manda só o id e a quantidade; o preço quem decide é este
   arquivo. Assim ninguém consegue alterar o valor pelo console.

   ⚠ IMPORTANTE: sempre que mudar um preço no index.html,
   mude também na tabela abaixo. Os dois precisam bater.
   ═══════════════════════════════════════════════════════════════ */

/* Catálogo de partida. A partir do momento em que a tabela `produtos`
   tiver peças cadastradas pelo painel, é ela que manda — esta lista só
   serve enquanto o banco não está configurado. */
export const PRODUTOS = {
  1:  { nome: 'Vestido Midi Ester',       preco: 329.90 },
  2:  { nome: 'Saia Longa Rute',          preco: 189.90 },
  3:  { nome: 'Conjunto Ana Clara',       preco: 399.90 },
  4:  { nome: 'Blusa Serena',             preco: 149.90 },
  5:  { nome: 'Vestido Longo Débora',     preco: 429.90 },
  6:  { nome: 'Camisa Linho Ravena',      preco: 199.90 },
  7:  { nome: 'Saia Jeans Sara',          preco: 169.90 },
  8:  { nome: 'Vestido Chemise Priscila', preco: 279.90 },
  9:  { nome: 'Conjunto Tricot Naomi',    preco: 349.90 },
  10: { nome: 'Blusa Bordada Lírio',      preco: 219.90 },
  11: { nome: 'Vestido Plus Herança',     preco: 359.90 },
  12: { nome: 'Saia Plissada Aurora',     preco: 229.90 },
  13: { nome: 'Conjunto Plus Vitória',    preco: 389.90 },
  14: { nome: 'Camisa Social Milena',     preco: 189.90 },
  15: { nome: 'Vestido Tubinho Miriam',   preco: 299.90 },
  16: { nome: 'Blusa Cetim Rebeca',       preco: 179.90 }
};

export const REGRAS = {
  freteGratisAcima: 299,
  freteValor: 24.90,
  descontoPix: 0.05,
  maxParcelas: 10,
  cupons: {
    GRACA10:     { tipo: 'perc',  valor: 0.10, rotulo: 'Cupom GRACA10' },
    BEMVINDA:    { tipo: 'perc',  valor: 0.10, rotulo: 'Cupom BEMVINDA' },
    FRETEGRATIS: { tipo: 'frete', valor: 1,    rotulo: 'Frete grátis' }
  }
};

/* Tudo é somado em centavos (número inteiro). Se calculássemos com
   casas decimais, 329,90 × 0,95 daria 313,40 no servidor e 313,41 na
   tela do site — a cliente veria um valor e seria cobrada outro. */
const emCentavos = reais => Math.round(reais * 100);
const emReais = c => c / 100;

/** Recalcula o pedido inteiro a partir dos ids. Nunca confie no valor do cliente. */
export async function calcular(itens, cupom, metodo) {
  if (!Array.isArray(itens) || !itens.length) throw new Error('A sacola está vazia.');
  if (itens.length > 30) throw new Error('Pedido grande demais. Fale com a gente pelo WhatsApp.');

  // O preço vem do banco. Se ele ainda não estiver configurado,
  // caímos no catálogo de partida deste arquivo.
  let tabela = PRODUTOS;
  if (process.env.DATABASE_URL) {
    const { precosDe } = await import('./_db.js');
    tabela = await precosDe(itens.map(i => parseInt(i.id, 10)).filter(Boolean));
  }

  let sub = 0;
  const linhas = [];
  for (const it of itens) {
    const p = tabela[it.id];
    if (!p) throw new Error('Uma das peças do pedido não existe mais.');
    if (p.ativo === false) throw new Error(`${p.nome} saiu do catálogo. Tire da sacola para continuar.`);
    const qtd = Math.max(1, Math.min(9, parseInt(it.qtd, 10) || 1));
    if (p.estoque && it.tam) {
      const resta = p.estoque[it.tam];
      if (resta !== undefined && resta < qtd) {
        throw new Error(resta === 0
          ? `${p.nome} tamanho ${it.tam} esgotou.`
          : `Só restam ${resta} de ${p.nome} tamanho ${it.tam}.`);
      }
    }
    sub += emCentavos(Number(p.preco)) * qtd;
    linhas.push({ id: it.id, nome: p.nome, tam: String(it.tam || '').slice(0, 12), qtd, preco: Number(p.preco) });
  }

  let desconto = 0, freteCortesia = false;
  const c = REGRAS.cupons[String(cupom || '').toUpperCase()];
  if (c) {
    if (c.tipo === 'perc') desconto = Math.round(sub * c.valor);
    if (c.tipo === 'frete') freteCortesia = true;
  }

  const base = sub - desconto;
  const frete = (base >= emCentavos(REGRAS.freteGratisAcima) || freteCortesia) ? 0 : emCentavos(REGRAS.freteValor);
  let total = base + frete;
  if (metodo === 'pix') total = Math.round(total * (1 - REGRAS.descontoPix));

  if (total < 100) throw new Error('Valor do pedido inválido.');

  return {
    sub: emReais(sub),
    desconto: emReais(desconto),
    frete: emReais(frete),
    total: emReais(total),
    linhas,
    cupomRotulo: c?.rotulo || null
  };
}

/** Número do pedido: CI-AAMMDD-XXXX */
export function referencia() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  const data = `${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}`;
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CI-${data}-${rnd}`;
}

/** Data de expiração no formato que o Mercado Pago aceita (com fuso -03:00). */
export function expiraEm(minutos) {
  const d = new Date(Date.now() + minutos * 60000 - 3 * 3600000);
  return d.toISOString().replace('Z', '-03:00');
}

/** Chamada à API do Mercado Pago. */
export async function mp(caminho, { metodo = 'GET', corpo, idem } = {}) {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error('O servidor ainda não tem a credencial do Mercado Pago configurada.');

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  if (idem) headers['X-Idempotency-Key'] = idem;

  const r = await fetch('https://api.mercadopago.com' + caminho, {
    method: metodo,
    headers,
    body: corpo ? JSON.stringify(corpo) : undefined
  });

  const dados = await r.json().catch(() => ({}));
  if (!r.ok) {
    const erro = new Error(dados.message || 'O Mercado Pago recusou a solicitação.');
    erro.http = r.status;
    erro.detalhe = dados;
    throw erro;
  }
  return dados;
}

/** Traduz a recusa do banco para uma frase que a cliente entende. */
export function mensagemDoStatus(pag) {
  const d = pag.status_detail;
  const mapa = {
    accredited: 'Pagamento aprovado.',
    pending_contingency: 'O banco está processando. Avisamos assim que confirmar.',
    pending_review_manual: 'O pagamento está em análise. Avisamos em algumas horas.',
    cc_rejected_bad_filled_card_number: 'Confira o número do cartão.',
    cc_rejected_bad_filled_date: 'Confira a validade do cartão.',
    cc_rejected_bad_filled_security_code: 'Confira o código de segurança (CVV).',
    cc_rejected_bad_filled_other: 'Algum dado do cartão está incorreto. Confira e tente de novo.',
    cc_rejected_insufficient_amount: 'O cartão não tem limite suficiente para este valor.',
    cc_rejected_high_risk: 'O banco não autorizou esta compra. Tente outro cartão ou pague no Pix.',
    cc_rejected_max_attempts: 'Muitas tentativas com este cartão. Use outro ou pague no Pix.',
    cc_rejected_call_for_authorize: 'Seu banco pediu autorização. Ligue para ele e autorize a compra.',
    cc_rejected_card_disabled: 'Este cartão está desativado. Ative com seu banco ou use outro.',
    cc_rejected_duplicated_payment: 'Este pagamento já foi feito. Confira o extrato antes de repetir.',
    cc_rejected_card_error: 'Não foi possível processar o cartão. Tente novamente.'
  };
  if (mapa[d]) return mapa[d];
  if (pag.status === 'approved') return 'Pagamento aprovado.';
  if (pag.status === 'in_process') return 'Pagamento em análise. Avisamos assim que for confirmado.';
  return 'O pagamento não foi aprovado. Tente outro cartão ou pague no Pix.';
}
