import crypto from 'node:crypto';
import { db, normalizarEmail } from './_db.js';

/* ═══════════════════════════════════════════════════════════════
   Login sem bibliotecas externas

   Senha: scrypt (o mesmo algoritmo recomendado pelo OWASP para
   quem não usa Argon2). Guardamos salt + hash, nunca a senha.

   Sessão: um token assinado com HMAC guardado num cookie HttpOnly.
   HttpOnly significa que o JavaScript da página não consegue ler —
   se alguém injetar script no site, não leva a sessão junto.
   ═══════════════════════════════════════════════════════════════ */

const DIAS = 30;

function segredo() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 24) {
    throw new Error('SESSION_SECRET não configurado no servidor (use ao menos 24 caracteres).');
  }
  return s;
}

/* ── Senha ──────────────────────────────────────────────────── */

export function criarHash(senha) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(senha, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function conferirSenha(senha, guardado) {
  try {
    const [algo, salt, hash] = String(guardado).split('$');
    if (algo !== 'scrypt' || !salt || !hash) return false;
    const teste = crypto.scryptSync(senha, salt, 64);
    const alvo = Buffer.from(hash, 'hex');
    return teste.length === alvo.length && crypto.timingSafeEqual(teste, alvo);
  } catch {
    return false;
  }
}

/** Regras mínimas de senha, com mensagem que diz o que fazer. */
export function senhaFraca(senha) {
  const s = String(senha || '');
  if (s.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (!/[a-zA-Z]/.test(s) || !/[0-9]/.test(s)) return 'Misture letras e números na senha.';
  if (s.length > 200) return 'Senha longa demais.';
  return null;
}

/* ── Sessão ─────────────────────────────────────────────────── */

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');

export function criarToken(clienteId) {
  const corpo = b64({ id: clienteId, exp: Date.now() + DIAS * 86400000 });
  const assin = crypto.createHmac('sha256', segredo()).update(corpo).digest('base64url');
  return `${corpo}.${assin}`;
}

export function lerToken(token) {
  if (!token || !token.includes('.')) return null;
  const [corpo, assin] = token.split('.');
  const esperado = crypto.createHmac('sha256', segredo()).update(corpo).digest('base64url');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(assin), Buffer.from(esperado))) return null;
  } catch {
    return null;
  }
  const dados = JSON.parse(Buffer.from(corpo, 'base64url').toString());
  if (!dados.exp || dados.exp < Date.now()) return null;
  return dados.id;
}

/* Diferente da versão para Vercel, estas duas não escrevem em res —
   devolvem a string do cabeçalho Set-Cookie, e cada função decide
   como anexá-la à sua resposta (ver json() em _http.js, parâmetro
   `extras`). Isso mantém este arquivo sem saber nada sobre qual
   plataforma está por trás. */
export function cookieDeSessao(token) {
  const partes = [
    `sessao=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${DIAS * 86400}`
  ];
  if (process.env.NETLIFY_DEV !== 'true') partes.push('Secure');
  return partes.join('; ');
}

export function cookieDeSaida() {
  return 'sessao=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
}

function cookieDaRequisicao(req) {
  const bruto = req.headers?.cookie || req.headers?.Cookie || '';
  const achado = bruto.split(';').map(p => p.trim()).find(p => p.startsWith('sessao='));
  return achado ? decodeURIComponent(achado.slice(7)) : null;
}

/** Devolve o cliente logado, ou null. Aceita tanto o `event` da
    Netlify quanto o `req` sintético que _http.js monta a partir
    dele — os dois têm `.headers`, que é tudo que esta função usa. */
export async function clienteLogado(req) {
  const id = lerToken(cookieDaRequisicao(req));
  if (!id) return null;
  const sql = db();
  const linhas = await sql`
    select id, nome, email, cpf, telefone, cep, endereco, cidade, uf, admin, criado_em
      from clientes where id = ${id} limit 1`;
  return linhas[0] || null;
}

/** Para as rotas do painel: exige uma sessão válida com admin = true.
    Lança em vez de responder direto, porque quem decide o formato da
    resposta é o rota() de _http.js — assim este arquivo continua sem
    saber nada sobre Netlify, Vercel ou qualquer outra plataforma. */
export async function exigirAdmin(req) {
  const c = await clienteLogado(req);
  if (!c) { const e = new Error('Entre com sua conta para acessar o painel.'); e.http = 401; throw e; }
  if (!c.admin) { const e = new Error('Esta conta não tem acesso ao painel.'); e.http = 403; throw e; }
  return c;
}

/* ── Proteção contra tentativas em série ────────────────────── */

const tentativas = new Map();

/** Trava simples por e-mail: 6 erros liberam de novo após 15 minutos.
    Vale por instância da função; para algo mais rígido, use Upstash. */
export function bloqueado(chave) {
  const r = tentativas.get(chave);
  if (!r) return false;
  if (Date.now() - r.desde > 15 * 60000) { tentativas.delete(chave); return false; }
  return r.erros >= 6;
}
export function registrarErro(chave) {
  const r = tentativas.get(chave) || { erros: 0, desde: Date.now() };
  r.erros++; tentativas.set(chave, r);
}
export function limparErros(chave) { tentativas.delete(chave); }

export { normalizarEmail };
