# StockWise

**Demonstração online:** https://victin7.github.io/Stockwise/

Plataforma de gestão de estoque para pequenas e médias empresas, construída como projeto de portfólio. Funciona inteiramente no navegador, sem backend e sem banco de dados: os dados ficam no `localStorage`, atrás de uma camada de persistência que pode ser trocada no futuro.

O objetivo é mostrar um produto SaaS completo e coerente: regras de negócio consistentes, indicadores calculados a partir dos mesmos dados exibidos nas demais telas, interface responsiva com tema claro e escuro, e código organizado e testado.

## Funcionalidades

**Dashboard**
- Indicadores calculados em tempo real: produtos cadastrados, unidades em estoque, valor estimado, estoque baixo, sem estoque, vencimentos próximos, entradas e saídas no período e pedidos em aberto.
- Gráfico de entradas e saídas por dia (7, 30 ou 90 dias) e distribuição do valor por categoria.
- Lista de estoque crítico com atalho para reposição e últimas movimentações.

**Produtos**
- CRUD completo com SKU, código de barras, categoria, unidade, custo, preço de venda, mínimo, máximo, fornecedor, localização física e validade.
- Busca por nome, SKU e código de barras; filtros por categoria, situação do estoque e status; ordenação e paginação.
- SKU e código de barras únicos; valores monetários validados e armazenados em centavos.
- Saldo nunca é editado diretamente: o saldo inicial gera uma entrada e qualquer mudança posterior exige uma movimentação.
- Produtos com histórico não podem ser excluídos; a interface oferece a inativação.

**Categorias**
- CRUD com cor de identificação, contagem de produtos, valor e alertas por categoria.
- Excluir uma categoria com produtos exige escolher a categoria de destino para reclassificá-los.

**Estoque e movimentações**
- Entradas, saídas, ajustes positivos e negativos com motivo, responsável, data, observações e vínculo com pedido.
- Saídas acima do saldo são bloqueadas, com prévia do saldo resultante no formulário.
- Cada formulário gera um identificador de operação, e uma mesma operação nunca é aplicada duas vezes (por exemplo, em clique duplo).
- Filtros por período, produto, tipo e motivo. O histórico é preservado e não pode ser editado.

**Fornecedores**
- CRUD com nome empresarial, contato, e-mail, telefone, CNPJ fictício, endereço e observações, com máscaras e validação.
- Relacionamento com produtos e pedidos; fornecedores vinculados são inativados em vez de excluídos.

**Pedidos de compra**
- Fluxo rascunho → pendente → aprovado → parcialmente recebido → recebido, com cancelamento.
- Itens com quantidade e custo, total calculado automaticamente.
- Recebimentos parciais geram entradas no estoque vinculadas ao pedido; receber acima do pendente ou repetir um recebimento é bloqueado.
- Histórico de alterações por pedido. O cancelamento preserva o histórico e as entradas já recebidas.

**Relatórios**
- Posição do estoque, abaixo do mínimo (com sugestão de reposição), sem estoque, valor por categoria, entradas e saídas por período, movimentações por produto, compras por fornecedor e produtos mais movimentados.
- Filtros por período, categoria, produto e fornecedor conforme o relatório.
- Exportação em CSV (UTF-8 com BOM, tratando vírgulas, aspas e quebras de linha) e JSON, e layout próprio para impressão.

**Histórico de atividades**
- Registro de criação e edição de cadastros, movimentações, etapas dos pedidos e alterações de configuração, agrupado por dia e filtrável.
- É explicitamente demonstrativo: fica no navegador e não constitui auditoria inviolável.

**Configurações**
- Nome da empresa, responsável padrão, moeda (BRL), estoque mínimo padrão, antecedência para alerta de vencimento, tema, itens por página e tabelas compactas.
- Exportação de backup, importação validada com resumo e confirmação antes de substituir, restauração dos dados de demonstração e limpeza com confirmação digitada.

**Interface**
- Sidebar recolhível, menu lateral no celular, busca global (Ctrl + K) por produtos, fornecedores, pedidos e categorias, central de notificações derivada dos dados (ruptura, estoque baixo, validade, pedidos atrasados ou aguardando aprovação) e perfil demonstrativo.
- Tema claro, escuro ou do sistema; estados vazios, de carregamento e de erro; toasts de feedback; navegação por teclado e respeito a `prefers-reduced-motion`.

## Tecnologias

| Área | Biblioteca |
| --- | --- |
| Base | React 19, Vite, TypeScript (modo estrito) |
| Interface | Tailwind CSS 4, componentes no padrão shadcn/ui sobre Radix UI, Lucide React |
| Navegação | React Router 7 |
| Estado | Zustand |
| Formulários e validação | React Hook Form, Zod |
| Gráficos | Recharts |
| Datas | date-fns |
| Testes | Vitest, React Testing Library, jsdom |

## Como executar

Pré-requisito: Node.js 22 ou superior.

```bash
git clone https://github.com/Victin7/stockwise.git
cd stockwise
npm install
npm run dev
```

A aplicação abre em `http://localhost:5173` já com dados de demonstração.

Outros comandos:

```bash
npm run build      # verificação de tipos + build de produção em dist/
npm run preview    # serve o build de produção
npm run typecheck  # apenas a verificação de tipos
```

Não há variáveis de ambiente obrigatórias. `VITE_BASE_PATH` define o caminho base do build (padrão `/`); o deploy usa `/Stockwise/`.

## Deploy no GitHub Pages

O workflow `.github/workflows/deploy.yml` roda a cada push no `main`: instala as dependências, executa os testes, gera o build com o caminho base do repositório e publica no GitHub Pages. Um push com testes falhando não é publicado.

Como é uma SPA, o workflow copia `index.html` para `404.html`, permitindo abrir qualquer rota (por exemplo, `/Stockwise/produtos`) diretamente ou recarregar a página.

Para ativar em um fork: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Testes

```bash
npm test           # executa todos os testes uma vez
npm run test:watch # modo observação
```

A suíte cobre:

- criação e edição de produtos, SKU e código de barras duplicados, validação de valores;
- cálculo do saldo, bloqueio de saídas inválidas e de operações duplicadas;
- pedidos de compra: totais, recebimento parcial, recebimento duplicado, transições de status e cancelamento;
- indicadores do dashboard e relatórios;
- exportação e importação de backup, escape de CSV;
- recuperação de armazenamento corrompido, migração de versão e falhas de gravação;
- coerência dos dados de demonstração (o saldo de cada produto é igual à soma das suas movimentações);
- fluxos de interface: cadastro de produto, erro de SKU duplicado, validação de formulário, saída acima do saldo e clique duplo.

## Estrutura de pastas

```
src/
  app/                 # store (Zustand), providers, rotas e layout (sidebar, header, busca)
  components/
    ui/                # componentes base no padrão shadcn/ui
    shared/            # tabela de dados, medidor de estoque, diálogos, cards
  features/            # uma pasta por módulo (página + formulários + detalhes)
    dashboard/ products/ categories/ inventory/ suppliers/
    purchase-orders/ reports/ activity-log/ settings/
  domain/
    entities/          # tipos das entidades
    rules/             # regras puras (situação do estoque, transições, totais, limites)
    services/          # operações de domínio: validam tudo e devolvem um novo estado
    schemas.ts         # schemas Zod do formato persistido
    labels.ts          # rótulos em português
  infrastructure/
    storage/
      storage-adapter.ts        # interface + adaptador em memória
      local-storage.adapter.ts  # adaptador do localStorage com tratamento de falhas
      app-data.repository.ts    # leitura/gravação validadas, recuperação
      migrations.ts             # versionamento do formato
      backup.ts                 # exportação e importação
      seed.ts                   # dados de demonstração fictícios
  hooks/  lib/  tests/
```

### Decisões de arquitetura

- **Operações de domínio puras.** Cada operação recebe o estado atual, valida todas as regras e devolve um novo estado completo (ou lança `DomainError`). A store só grava e publica o resultado se a operação inteira for válida, então uma falha nunca deixa o estado pela metade.
- **Uma única fonte de verdade.** Dashboard, relatórios, notificações e tabelas leem o mesmo estado; não há números fixos.
- **Saldo derivado de movimentações.** O saldo do produto só muda via `registerMovement`, que também registra o saldo após cada lançamento.
- **Valores em centavos.** Evita erros de arredondamento de ponto flutuante.
- **Persistência isolada.** Componentes nunca acessam o `localStorage`; tudo passa pelo `AppDataRepository`, que depende apenas da interface `StorageAdapter`.
- **Dados de demonstração gerados pelas próprias regras.** O seed aplica as operações de domínio em ordem cronológica, garantindo relacionamentos e indicadores coerentes.

## Persistência local e suas limitações

- Os dados ficam na chave `stockwise:v1` do `localStorage` do navegador. Outro navegador, outro dispositivo ou a limpeza dos dados do site não terão acesso a eles; use o backup em JSON.
- O formato é versionado (`schemaVersion`) e migrado automaticamente ao carregar. Dados inválidos ou corrompidos são substituídos pelos dados de demonstração, e uma cópia do conteúdo anterior é guardada em `stockwise:v1:corrompido`.
- O `localStorage` não oferece transações nem controle de concorrência. A aplicação valida tudo antes de gravar e recarrega os dados quando outra aba os altera, mas isso não equivale às garantias de um banco de dados.
- O espaço é limitado (normalmente cerca de 5 MB). O histórico de atividades guarda os 500 eventos mais recentes e o de movimentações, os 3.000 mais recentes.
- O histórico de atividades é demonstrativo e pode ser alterado por quem tiver acesso ao navegador.

## Dados de demonstração

Todos os nomes de empresas, pessoas, CNPJs, e-mails (domínio `.example`), telefones e endereços são fictícios. O conjunto inclui 32 produtos, 8 categorias, 8 fornecedores, cerca de 190 movimentações nos últimos 90 dias e 13 pedidos de compra em todos os status. As datas são geradas em relação ao dia atual.

## Capturas de tela

_A adicionar._

| Tela | Imagem |
| --- | --- |
| Dashboard | _em breve_ |
| Produtos | _em breve_ |
| Pedidos de compra | _em breve_ |
| Relatórios | _em breve_ |
| Tema escuro | _em breve_ |

## Licença

A definir.
