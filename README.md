# Cabide Imperial — loja com Pix e cartão

Site da boutique com pagamento real via Mercado Pago: Pix com QR Code de verdade e cartão de crédito com tokenização segura. Hospedado na **Netlify**, que permite loja comercial no plano gratuito — a Vercel não permite (ver "Por que Netlify e não Vercel", mais abaixo).

---

## Como está organizado

```
cabide-imperial/
├── index.html            a loja (vitrine, sacola, checkout, conta da cliente)
├── admin.html            o painel da loja (peças e pedidos)
├── schema.sql            estrutura das tabelas do banco
├── netlify.toml          onde estão as funções e como manter as URLs /api/...
├── netlify/functions/
│   ├── _shared/
│   │   ├── _http.js        adapta as funções ao formato de resposta da Netlify
│   │   ├── _lib.js         tabela de preços, cálculo do total, chamada ao Mercado Pago
│   │   ├── _db.js          conexão com o banco e gravação dos pedidos
│   │   └── _auth.js        senha, sessão e cookie
│   ├── criar-pix.js        gera a cobrança Pix e devolve o QR Code
│   ├── criar-cartao.js     processa o pagamento no cartão
│   ├── status.js           consulta se o Pix já caiu
│   ├── webhook.js          recebe os avisos do Mercado Pago
│   ├── produtos.js         catálogo publicado, lido pela vitrine
│   ├── admin-produtos.js   criar, editar e apagar peças
│   ├── admin-pedidos.js    lista de pedidos e status da entrega
│   ├── admin-assinatura-upload.js   autoriza o envio de fotos ao Cloudinary
│   ├── conta-cadastrar.js  criar conta
│   ├── conta-entrar.js     login
│   ├── conta-sair.js       logout
│   ├── conta-eu.js         perfil + histórico de pedidos
│   ├── conta-atualizar.js  dados de entrega e troca de senha
│   ├── conta-exportar.js   baixar os próprios dados (LGPD)
│   └── conta-excluir.js    apagar a conta (LGPD)
├── package.json
└── .env.example          modelo das variáveis de ambiente
```

Um detalhe do `netlify.toml`: os arquivos de função têm nomes "achatados" (`conta-entrar.js`, não `conta/entrar.js`) porque é assim que a Netlify espera — mas o `netlify.toml` traduz `/api/conta/entrar` para o nome certo da função, então o `index.html` e o `admin.html` continuam chamando `/api/conta/entrar` normalmente, sem saber dessa organização por trás.

## Por que Netlify e não Vercel

As duas plataformas fazem a mesma coisa (hospedar o site e rodar as funções do servidor), mas os termos de uso são diferentes: a Vercel proíbe explicitamente cobrar pagamento de visitantes no plano gratuito — uma loja com Pix e cartão se enquadra nisso e precisaria do plano pago (US$ 20/mês). A Netlify permite loja no plano gratuito, com um limite de créditos mensais que uma boutique iniciante dificilmente estoura.

Se um dia o volume de vendas justificar migrar de volta ou para outro provedor, o formato das funções muda (cada plataforma tem o seu), mas as regras de negócio — cálculo de preço, senha, sessão, banco — estão isoladas em `netlify/functions/_shared/` justamente para essa mudança ser a menor possível.

## Por que precisa de servidor

O Mercado Pago tem duas credenciais:

- **Public Key** — pode ficar no site, é feita para isso.
- **Access Token** — é a chave do cofre. Quem tem ela movimenta a conta.

Se o Access Token ficasse no `index.html`, qualquer pessoa veria com um clique em "ver código-fonte". Por isso as funções de pagamento rodam no servidor, onde a chave fica escondida.

O servidor também **recalcula o valor do pedido**. O site manda só o id e a quantidade das peças; o preço quem decide é o `netlify/functions/_shared/_lib.js`. Sem isso, dava para alterar o total pelo console do navegador e comprar um vestido por R$ 1,00.

---

## Passo a passo

### 1. Conta no Mercado Pago

Crie uma conta em [mercadopago.com.br](https://www.mercadopago.com.br) com o CNPJ ou CPF da loja. Depois entre em **Seu negócio › Configurações › Gestão e administração › Credenciais**.

Você verá dois conjuntos: **teste** e **produção**. Comece pelos de teste.

### 2. Cole a Public Key no site

Abra o `index.html`, procure por `CONFIG` (perto do começo do `<script>`) e preencha:

```js
mp: {
  publicKey: 'TEST-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  api: ''
}
```

Enquanto essa chave estiver vazia, o checkout roda em modo demonstração — útil para mostrar o site para alguém sem cobrar nada.

Aproveite e ajuste, no mesmo bloco, o WhatsApp da loja e a chave Pix.

### 3. Publique na Netlify

```bash
npm i -g netlify-cli
cd cabide-imperial
netlify init
```

O `netlify init` pergunta se quer criar um site novo ou ligar a um existente — escolha criar novo e aceite os padrões. Ele detecta o `netlify.toml` sozinho e já sabe que as funções ficam em `netlify/functions`. Para publicar de verdade:

```bash
netlify deploy --prod
```

Se preferir sem terminal: crie um repositório no GitHub, suba a pasta e importe em [app.netlify.com/start](https://app.netlify.com/start).

### 4. Cadastre o Access Token

No painel da Netlify: **Site configuration › Environment variables › Add a variable**. Adicione:

| Nome | Valor |
|---|---|
| `MP_ACCESS_TOKEN` | o Access Token de teste (`TEST-...`) |
| `URL_WEBHOOK` | `https://seu-site.netlify.app/api/webhook` |
| `SESSION_SECRET` | uma chave aleatória longa (ver seção da área da cliente, abaixo) |

Depois rode `netlify deploy --prod` de novo (ou clique em **Trigger deploy** no painel) para as variáveis valerem — a Netlify só lê variáveis novas num deploy novo.

### 5. Teste sem gastar dinheiro

Com as credenciais de teste, use os cartões abaixo. Nome do titular: qualquer um. CPF: `12345678909`. Validade: qualquer data futura. CVV: `123`.

| Bandeira | Número | Resultado |
|---|---|---|
| Mastercard | 5031 4332 1540 6351 | aprovado |
| Visa | 4235 6477 2802 5682 | aprovado |
| Mastercard | 5031 4332 1540 6351 | recusado, se o nome for `OTHE` |

Para o Pix de teste, o QR aparece normalmente e o pagamento é confirmado pelo painel de testes do Mercado Pago.

Confira: valor correto, parcelamento até 10x, desconto de 5% no Pix e a tela avançando sozinha quando o Pix é aprovado.

Quer testar no computador antes de publicar? `netlify dev` sobe o site inteiro localmente, funções incluídas, respeitando os redirecionamentos do `netlify.toml`.

### 6. Configure o webhook

No Mercado Pago: **Suas integrações › sua aplicação › Webhooks**. Cadastre `https://seu-site.netlify.app/api/webhook` e marque o evento **Pagamentos**.

Copie a **assinatura secreta** que aparece e cadastre na Netlify como `MP_WEBHOOK_SECRET`.

Isso garante que a venda seja registrada mesmo se a cliente fechar o navegador logo depois de pagar.

### 7. Vá para produção

Troque as duas credenciais pelas de produção (`APP_USR-...`): a Public Key no `index.html` e o `MP_ACCESS_TOKEN` na Netlify. Faça uma compra real de valor baixo para conferir o dinheiro entrando na conta.

Recomendo também preencher `ORIGEM_PERMITIDA` com o domínio final, para que só o seu site possa usar a API.

---

## Área da cliente (login e histórico)

### Como funciona

A cliente pode comprar **sem criar conta** — isso não mudou. Quem cria conta ganha três coisas: o checkout já vem preenchido, o histórico de pedidos fica visível com o status de cada um, e ela mesma resolve exclusão e cópia dos dados sem precisar pedir por e-mail.

Detalhe útil: se alguém comprou como visitante e depois criou conta com **o mesmo e-mail**, os pedidos antigos são vinculados automaticamente ao cadastro.

### Como a senha e a sessão são protegidas

A senha nunca é guardada. O que fica no banco é o resultado de um **scrypt** com sal aleatório — mesmo que alguém copie a tabela inteira, não consegue voltar às senhas. Duas clientes com a mesma senha geram registros diferentes.

A sessão é um token assinado com HMAC dentro de um cookie **HttpOnly**, que o JavaScript da página não consegue ler. Se algum dia um script malicioso entrar no site, ele não leva a sessão junto.

O login também trava depois de 6 tentativas erradas no mesmo e-mail, por 15 minutos. E a mensagem de erro é a mesma para senha errada e e-mail inexistente, para ninguém descobrir quais e-mails têm conta na loja.

### Passo 1 — criar o banco

Crie uma conta gratuita no [Neon](https://neon.tech) e um projeto novo (escolha a região `AWS US East` ou `São Paulo`). Copie a **connection string**, aquela que termina em `?sslmode=require`.

Na aba **SQL Editor** do Neon, cole o conteúdo do arquivo `schema.sql` e execute. Isso cria as duas tabelas.

### Passo 2 — cadastrar as variáveis

Na Netlify, adicione mais duas (mesmo lugar do passo 4 acima: **Site configuration › Environment variables**):

| Nome | Valor |
|---|---|
| `DATABASE_URL` | a connection string do Neon |
| `SESSION_SECRET` | uma chave aleatória longa |

Para gerar a chave, rode no terminal:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Guarde essa chave. Se você trocá-la depois, todas as clientes são deslogadas de uma vez.

### Passo 3 — publicar

```bash
netlify deploy --prod
```

O ícone de pessoa aparece no topo do site. Teste criando uma conta, comprando e conferindo se o pedido aparece no histórico.

### Consultando as vendas

O arquivo `schema.sql` termina com quatro consultas prontas para colar no SQL Editor do Neon: vendas dos últimos 30 dias, faturamento por forma de pagamento, clientes que mais compraram e peças mais vendidas.

### Sobre a LGPD

Guardar CPF e endereço num banco próprio coloca a loja como controladora de dados pessoais. O que já está resolvido no código:

- a cliente baixa uma cópia de tudo pelo botão **Baixar meus dados**;
- a cliente apaga a própria conta, e os pedidos ficam sem nome, e-mail nem endereço — só o registro fiscal da venda, que a Receita exige guardar;
- a senha é irrecuperável mesmo para quem tem acesso ao banco.

O que ainda depende de você: escrever a política de privacidade de verdade (a que está no site é um resumo), informar um canal para pedidos de dados e não usar o e-mail das clientes para propaganda sem elas terem pedido.

---

## Receber aviso de venda no WhatsApp

Crie um cenário no [Make](https://www.make.com) ou [n8n](https://n8n.io) que comece com um webhook, copie a URL e cadastre na Netlify como `URL_AVISO`. A cada venda aprovada, o `webhook.js` envia:

```json
{
  "pedido": "CI-260816-A4K9",
  "valor": 313.41,
  "forma": "pix",
  "cliente": "maria@email.com",
  "telefone": "(79) 99999-9999",
  "entrega": "Rua das Flores, 120 · Aracaju · SE · 49000-000",
  "itens": "1x Vestido Midi Ester (M)"
}
```

Daí é só ligar esse dado a uma mensagem de WhatsApp ou a uma linha numa planilha.

---

## Cadastrando as peças

O catálogo fica no banco e se administra pelo painel, em `https://seu-site.netlify.app/admin.html`. Não é preciso abrir código para lançar uma peça nova.

### Preparar o painel (uma vez só)

**1. Criar a conta de fotos.** Crie uma conta gratuita em [cloudinary.com](https://cloudinary.com) — o plano grátis dá 25 GB de armazenamento e 25 GB de tráfego por mês, bem mais do que uma boutique gasta. No painel deles (**Dashboard**), copie três valores: **Cloud name**, **API Key** e **API Secret**. Cadastre os três na Netlify como `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` e `CLOUDINARY_API_SECRET`.

A foto sai do celular de quem está cadastrando direto para o Cloudinary — nunca passa pelo nosso servidor. Isso é bom por dois motivos: a foto fica disponível mais rápido (vem do CDN deles, feito para imagens) e cada envio não consome os créditos do plano gratuito da Netlify, que são contados por execução de função.

**2. Rodar o segundo trecho do `schema.sql`** no SQL Editor do Neon (a parte que cria a tabela `produtos`).

**3. Virar administradora.** Crie sua conta normalmente na loja e depois rode no Neon, trocando o e-mail:

```sql
update clientes set admin = true where email = 'seu@email.com';
```

Só contas com essa marca entram no painel. Todas as outras recebem "sem acesso", inclusive as clientes.

### Lançando uma peça

Abra `/admin.html` no celular mesmo, entre com sua conta e clique em **Nova peça**:

- **Nome, categoria, tecido e preço** — o preço antigo só se a peça estiver em oferta; ele vira o valor riscado e o selo de desconto na vitrine.
- **Fotos** — clique em "+ foto" e escolha direto da galeria. Dá para mandar várias de uma vez. A primeira vira a capa. As imagens são encolhidas para 1200px no seu próprio celular antes de subir, então pode mandar a foto original sem medo.
- **Tamanhos e estoque** — cada linha é um tamanho com a quantidade. Quando um tamanho zera, ele aparece riscado na loja; quando todos zeram, a peça ganha o selo "Esgotada" e não pode ser comprada. Deixe a quantidade vazia se você não quiser controlar estoque daquela peça.
- **Cores** — abre o seletor de cor do próprio celular.
- **Posição na vitrine** — de 0 a 10; quanto maior, mais no começo da arara.

**Salvar** publica na hora. A vitrine atualiza em até um minuto (há um cache curto para o site abrir rápido).

### Pausar em vez de apagar

O botão **Pausar** tira a peça da loja sem perder o cadastro — bom para quando o fornecedor está sem reposição. **Apagar** só quando a peça não voltar mais; os pedidos antigos continuam guardados de qualquer jeito.

### Acompanhando os pedidos

Na aba **Pedidos** aparecem as vendas do mês, o faturamento e quantos pedidos pagos estão esperando envio. Clique em um pedido para ver o endereço completo, lançar o código de rastreio, mudar a situação para *enviado* e avisar a cliente pelo WhatsApp com um toque.

### Onde o preço mora agora

No banco, num lugar só. O servidor consulta a tabela `produtos` na hora de cobrar, então não existe mais o risco de a tela mostrar um valor e a cobrança vir outro.

A lista `PRODUTOS` que está dentro do `index.html` e do `netlify/functions/_shared/_lib.js` virou só catálogo de demonstração: ela aparece enquanto o banco não tiver nenhuma peça cadastrada, para o site nunca abrir vazio. Assim que você lançar a primeira peça no painel, ela é substituída por completo.

---

## Taxas do Mercado Pago (agosto/2026)

- **Pix:** cerca de 0,99% por venda, cai na hora
- **Cartão:** varia conforme o prazo de recebimento — na faixa de 4,98% recebendo em 14 dias

Vale conferir os números atuais no painel, porque mudam de tempos em tempos. Se a margem apertar, o desconto de 5% no Pix ajuda a empurrar a cliente para a forma mais barata.

---

## Paleta e sistema de cores

### Como está organizada

A paleta tem **dois níveis**. As primitivas são as rampas de cor; as semânticas dizem para que cada tom serve. O CSS só usa as semânticas.

```
--rosa-400   ← primitiva: "este é o rosé médio"
--rose       ← semântica: "esta é a cor de destaque da marca"
```

A diferença importa na prática: se um dia o rosé mudar de tom, você altera uma linha na camada semântica e o site inteiro acompanha. Sem isso, seria caçar `#C9857C` em quarenta lugares.

### As quatro famílias

Foram geradas em **OKLCH** a partir das cores da própria logomarca. É o espaço de cor que os sistemas de design atuais adotaram, porque passos iguais de número produzem passos iguais para o olho — coisa que hexadecimal não garante.

| Família | Matiz | Vem de | Serve para |
|---|---|---|---|
| `--rosa-*` | 36° | o rosé do fundo da logo | fundos suaves, destaques |
| `--vinho-*` | 12° | a ameixa das sombras | texto e superfícies escuras |
| `--ouro-*` | 76° | o dourado da coroa | acento, fios metálicos |
| `--areia-*` | 48° | neutro quente da família | traços, texto terciário |

Cada uma tem onze degraus, de `50` (mais claro) a `950` (mais profundo).

### Tokens semânticos

| Token | Valor | Onde aparece |
|---|---|---|
| `--fundo` | `#FCF5F2` | fundo geral do site |
| `--fundo-rose` | `#FEE5DE` | faixas rosadas (newsletter, avisos) |
| `--superficie` | `#FFFFFF` | cartões, campos, caixas |
| `--marca` | `#501E27` | botões principais, rodapé, faixa do versículo |
| `--texto` | `#370813` | corpo do texto |
| `--texto-suave` | `#845056` | descrições, legendas |
| `--texto-tenue` | `#6A5E59` | terceiro nível de hierarquia |
| `--acento` | `#B28D55` | ornamento, ganchos, fios — **decorativo** |
| `--acento-forte` | `#9B7334` | ícones, bordas de estado, foco |
| `--acento-texto` | `#815806` | dourado quando é **texto** |
| `--acento-claro` | `#EED6B5` | dourado sobre fundo escuro |
| `--borda-campo` | `#9C918C` | contorno de campos de formulário |

### Por que o dourado virou quatro tokens

Era o nó da paleta antiga. O mesmo `--ouro` servia de fio decorativo e de texto, e não dá: o fio pode ser claro, mas texto precisa de 4,5:1 de contraste. O dourado bonito reprovava em **2,92:1** — quem lê no celular sob sol não enxergava as legendas.

Agora o fio continua claro (`--acento`) e o texto usa um tom mais fechado (`--acento-texto`, 5.85:1). Na prática ninguém percebe a diferença de tom; percebe que dá para ler.

### Contraste verificado

Todos os pares de texto passam em WCAG AA. Os principais:

| Par | Razão | Mínimo |
|---|---|---|
| texto no fundo | 16.15:1 | 4,5:1 |
| texto suave no fundo | 5.97:1 | 4,5:1 |
| texto tênue no fundo | 5.80:1 | 4,5:1 |
| dourado como texto | 5.85:1 | 4,5:1 |
| dourado sobre o rosé | 5.25:1 | 4,5:1 |
| claro sobre a marca | 11.23:1 | 4,5:1 |
| borda de campo | 3.07:1 | 3:1 |

### Mudando uma cor

Para ajustar o tom da marca inteira, mexa só na camada semântica do `:root`, dentro do `index.html`:

```css
--marca: var(--vinho-800);   /* em vez de vinho-900 */
```

Se trocar uma cor por um valor de fora das rampas, confira o contraste antes — [webaim.org/resources/contrastchecker](https://webaim.org/resources/contrastchecker/) faz isso de graça. E lembre que o `admin.html` tem o mesmo bloco de tokens; mude nos dois para os dois continuarem parecidos.

### Os tons das peças

As cores dos produtos não são cores de interface — são cores de tecido, e têm nome. A carta padrão tem 18 tons (Rosé, Vinho, Marfim, Terracota, Camel, Oliva, Taupe, Azul-marinho, Chocolate, Jeans, entre outros), e o nome aparece na tela, na sacola e para quem usa leitor de tela.

No painel, cada cor tem um seletor de tom e um campo de nome com sugestões. Se você trocar o tom sem mexer no nome, ele se ajusta sozinho.

Peças cadastradas antes desta versão, que tinham só o hexadecimal, são batizadas automaticamente pelo tom nomeado mais próximo — o cálculo compara as cores em OKLab dando menos peso à luminosidade, porque para dar nome a uma cor o que manda é o matiz. Vale conferir e ajustar os nomes no painel quando sobrar tempo.

---

## Problemas comuns

**"O servidor ainda não tem a credencial configurada"** — falta o `MP_ACCESS_TOKEN` na Netlify, ou você cadastrou e não fez um novo deploy (variável nova só vale a partir do próximo `netlify deploy --prod`).

**O formulário de cartão não aparece** — a Public Key está errada ou o SDK não carregou. Abra o console do navegador (F12) e veja o erro.

**O Pix gera mas nunca confirma** — normal em ambiente de teste; a aprovação precisa ser simulada no painel do Mercado Pago.

**Erro de CORS** — se o site e a API estiverem em domínios diferentes, preencha `CONFIG.mp.api` no `index.html` com o endereço da API **e** a variável `ORIGEM_PERMITIDA` com o endereço do site. Com cookie de sessão em jogo, o navegador exige a origem exata; curinga não funciona.

**"O banco de dados ainda não foi configurado"** — falta a `DATABASE_URL`, ou você cadastrou e não fez um novo deploy.

**A cliente entra e é deslogada sozinha** — a `SESSION_SECRET` mudou entre um deploy e outro. Defina uma e não altere mais.

**"O armazenamento de fotos ainda não foi configurado"** — falta uma das três variáveis do Cloudinary (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`) na Netlify, ou falta um novo deploy depois de cadastrá-las.

**Salvei a peça e a loja não mudou** — espere um minuto (é o cache) ou recarregue com a página forçada. Se continuar, confira se a peça está marcada como visível.

**"Esta conta não tem acesso ao painel"** — falta rodar o `update clientes set admin = true` com o seu e-mail.

**As cores do site e do painel ficaram diferentes** — o bloco de tokens do `:root` existe nos dois arquivos. Alterou num, altere no outro.

**`/api/conta/entrar` (ou qualquer outra rota) devolve 404** — confira se o `netlify.toml` está na raiz do projeto (não dentro de uma subpasta) e se o deploy foi feito a partir dessa raiz. É esse arquivo que traduz `/api/...` para o nome real da função.

**Quero desligar a área da cliente** — troque `contas: true` para `false` no `CONFIG` do `index.html`. O checkout como visitante continua funcionando normalmente.
