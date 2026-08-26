-- ═══════════════════════════════════════════════════════════════
-- Cabide Imperial — estrutura do banco
-- Rode uma vez no editor SQL do Neon (aba "SQL Editor").
-- Pode rodar de novo sem problema: nada é apagado.
-- ═══════════════════════════════════════════════════════════════

create table if not exists clientes (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  email      text not null unique,
  senha      text not null,          -- scrypt: salt + hash, nunca a senha
  cpf        text,
  telefone   text,
  cep        text,
  endereco   text,
  cidade     text,
  uf         text,
  criado_em  timestamptz not null default now()
);

create table if not exists pedidos (
  id          bigserial primary key,
  referencia  text unique not null,  -- CI-260816-A4K9
  cliente_id  uuid references clientes(id) on delete set null,
  email       text,                  -- guardado também aqui: permite
  nome        text,                  -- ligar compras feitas sem conta
  status      text not null default 'pendente',  -- pendente | pago | recusado | cancelado
  forma       text,                  -- pix | cartão
  valor       numeric(10,2) not null,
  parcelas    int default 1,
  itens       jsonb not null,
  entrega     jsonb,
  mp_id       text,                  -- id do pagamento no Mercado Pago
  criado_em   timestamptz not null default now(),
  pago_em     timestamptz
);

create index if not exists pedidos_cliente_idx on pedidos (cliente_id);
create index if not exists pedidos_email_idx   on pedidos (email);
create index if not exists pedidos_status_idx  on pedidos (status, criado_em desc);

-- ── Consultas úteis para o dia a dia da loja ───────────────────

-- Vendas pagas dos últimos 30 dias
-- select referencia, nome, valor, forma, pago_em from pedidos
--  where status = 'pago' and pago_em > now() - interval '30 days'
--  order by pago_em desc;

-- Faturamento por forma de pagamento no mês
-- select forma, count(*) as vendas, sum(valor) as total from pedidos
--  where status = 'pago' and pago_em >= date_trunc('month', now())
--  group by forma;

-- Clientes que mais compraram
-- select c.nome, c.email, count(p.id) as compras, sum(p.valor) as total
--   from clientes c join pedidos p on p.cliente_id = c.id
--  where p.status = 'pago'
--  group by c.id, c.nome, c.email
--  order by total desc limit 20;

-- Peças mais vendidas
-- select item->>'nome' as peca, sum((item->>'qtd')::int) as unidades
--   from pedidos, jsonb_array_elements(itens) as item
--  where status = 'pago'
--  group by 1 order by unidades desc;

-- ═══════════════════════════════════════════════════════════════
-- Catálogo e painel de administração
-- Rode este trecho depois do primeiro (pode rodar junto).
-- ═══════════════════════════════════════════════════════════════

-- Quem pode entrar no /admin.html
alter table clientes add column if not exists admin boolean not null default false;

-- Depois de criar sua conta no site, rode esta linha trocando o e-mail:
-- update clientes set admin = true where email = 'seu@email.com';

create table if not exists produtos (
  id            bigserial primary key,
  nome          text not null,
  categoria     text not null,          -- vestidos | saias | blusas | conjuntos | camisas | plus
  preco         numeric(10,2) not null,
  preco_de      numeric(10,2),          -- preço riscado, quando estiver em oferta
  tecido        text,
  descricao     text,
  tams          jsonb not null default '[]'::jsonb,   -- ["P","M","G"]
  cores         jsonb not null default '[]'::jsonb,   -- [{"nome":"Vinho","hex":"#501E27"}]
  fotos         jsonb not null default '[]'::jsonb,   -- ["https://...jpg"]
  estoque       jsonb not null default '{}'::jsonb,   -- {"P":3,"M":0,"G":5}
  novo          boolean not null default false,
  destaque      int not null default 5,               -- ordem na vitrine, maior primeiro
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists produtos_vitrine_idx on produtos (ativo, destaque desc);

-- Rastreio da entrega
alter table pedidos add column if not exists rastreio text;
