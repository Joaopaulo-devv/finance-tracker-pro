# FinanceTracker Pro

Dashboard pessoal de finanças em HTML, CSS e JavaScript puro.

![Dashboard do FinanceTracker Pro](preview.png)

Registro de entradas e saídas, saldo em tempo real, carteiras separadas, orçamentos, metas, recorrências, parcelamento, gráficos e relatórios — tudo no navegador, sem backend e sem cadastro. O projeto nasceu como primeiro trabalho de desenvolvimento web e evoluiu para um app completo de finanças pessoais, com tema claro e escuro.

## Funcionalidades

### Dashboard

- Cards de entradas, saídas e saldo, com contagem de transações e indicador de saldo positivo ou negativo.
- Filtro de período: todos os períodos, este mês ou últimos sete dias.
- Faixa de orçamento do mês, com total gasto, limite e as categorias mais comprometidas.
- Gráfico de linha com o fluxo de caixa (entradas vs. saídas) agrupado por data.
- Gráfico de rosca com a distribuição das saídas por categoria.
- Lista das cinco transações mais recentes, ordenadas por data.

### Adicionar

- Descrição, valor, categoria, carteira, data (padrão: hoje), parcelas, repetição e observação opcional.
- Valor aceita vírgula ou ponto: `1.234,56`, `1234,56` e `1234.56` são interpretados corretamente. Milhares com ponto (`10.000`) também são reconhecidos.
- Botões separados para registrar entrada ou saída.
- **Parcelamento**: de 1 a 36 parcelas mensais para saídas, com cada parcela lançada na data correspondente e marcada como `1/3`, `2/3` etc.
- **Recorrência**: semanal, mensal ou anual. A próxima ocorrência é lançada automaticamente quando o app é aberto.
- Validação de descrição e valor, com mensagem de erro no formulário.
- Confirmação por toast e limpeza automática dos campos após o registro.

### Transações

- Histórico completo ordenado por data, do mais recente para o mais antigo.
- Busca por descrição e filtros por tipo (entrada/saída) e por categoria.
- Filtro global por carteira, aplicado a todas as seções.
- Transações futuras (parcelas e recorrências ainda não vencidas) aparecem com o selo **prevista** e ficam fora dos totais realizados.
- Exclusão individual de cada transação.

### Orçamentos

- Limite mensal por categoria, editável direto na lista.
- Barra de progresso com gasto do mês, percentual consumido e destaque em vermelho quando o limite é ultrapassado.
- O consumo considera o mês atual e a carteira ativa.
- Resumo do orçamento também aparece no dashboard.

### Metas

- Criação de metas com nome, valor alvo e prazo opcional.
- Depósitos incrementais em cada meta, com percentual e quanto falta para concluir.
- Exclusão individual com confirmação.

### Relatórios

- Resumo de entradas, saídas, saldo e total de transações.
- Taxa de comprometimento da renda (saídas sobre entradas).
- Ranking de gastos por categoria, com barras proporcionais.
- As cinco maiores despesas registradas.
- Saldo por carteira.

### Ajustes

- **Carteiras**: criar, renomear, trocar a cor e excluir. Ao excluir, as transações e recorrências da carteira são movidas para a primeira carteira restante.
- **Categorias**: criar com ícone e nome, renomear, trocar o ícone e excluir. Ao excluir, os lançamentos vão para **Outros**, que não pode ser removida.
- **Recorrências**: listar, ativar/desativar e excluir.
- **Dados**: exportar JSON, importar JSON e apagar todos os dados financeiros.

### Backup e restauração

- Exportação de todo o estado (transações, carteiras, categorias, orçamentos, metas e recorrências) em JSON, com data no nome do arquivo.
- Importação com validação e escolha entre **mesclar** (mantém os dados atuais e adiciona os do arquivo) ou **substituir** (troca tudo pelo backup).
- Compatível com o formato antigo (`finance_transacoes`), com migração automática na primeira abertura.

### Outros

- **Tema claro e escuro**, alternável no menu e persistido no navegador, sem flash de tema errado no carregamento.
- Persistência automática no `localStorage`: os dados sobrevivem ao recarregamento da página.
- Layout responsivo com menu lateral em drawer, botão de abrir/fechar, overlay, botão de fechar e fechamento por Esc.
- Navegação por teclado nas seções e link "Pular para o conteúdo".
- Botão "Apagar tudo" com confirmação antes de limpar o histórico financeiro.
- Tipografia DM Serif Display + DM Sans, números tabulares nos valores e respeito a `prefers-reduced-motion`.

## Stack

| Camada | Escolha |
| --- | --- |
| Interface | HTML5 sem framework |
| Estilo | CSS puro com variáveis de design (`:root`), Grid e Flexbox |
| Lógica | JavaScript ES6, organizado como módulo IIFE (`App`) |
| Gráficos | Chart.js via CDN |
| Persistência | `localStorage` (chave `finance-tracker-pro-v2`) |
| Fontes | Google Fonts (DM Serif Display e DM Sans) |

Sem etapa de build e sem dependências instaladas localmente: os dois recursos externos (Chart.js e as fontes) vêm por CDN.

## Estrutura

```
.
├── index.html          # marcação das sete seções e do menu mobile
├── style.css           # design tokens, temas, layout, componentes e responsividade
├── script.js           # estado, persistência, cálculos, gráficos, filtros e backup
├── preview.png         # captura do dashboard usada neste README
├── preview-claro.png   # captura do dashboard no tema claro
└── preview-mobile.png  # captura da versão mobile
```

O `script.js` expõe apenas o necessário para os atributos `onclick` do HTML: `adicionar`, `excluir`, `limparTudo`, `atualizarTudo`, `renderizarLista`, `navegarPara`, `exportar`, `importar`, `alternarTema`, `trocarCarteira`, `salvarOrcamento`, funções de metas, carteiras, categorias e recorrências. O restante — estado, cálculos e renderização — fica encapsulado na IIFE.

## Como executar

Não há instalação. Basta abrir o `index.html` no navegador. Para servir por HTTP (recomendado, e necessário se você quiser usar o projeto a partir de outro dispositivo na mesma rede):

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

O `localStorage` é vinculado à origem: abrir via `file://` e via `http://localhost` cria dois armazenamentos separados. Escolha um modo e mantenha.

## Como os dados são guardados

O estado completo fica em um único objeto JSON na chave `finance-tracker-pro-v2` do `localStorage`, regravado a cada alteração. O formato é:

```json
{
  "versao": 2,
  "tema": "dark",
  "carteiras": [{ "id": "principal", "nome": "Conta principal", "cor": "#c9f75d" }],
  "carteiraAtiva": "todas",
  "categorias": [{ "id": "alimentacao", "nome": "Alimentação", "emoji": "🍔", "cor": "#ff9f68" }],
  "transacoes": [
    {
      "id": "1732300000000",
      "tipo": "saida",
      "descricao": "Notebook",
      "valor": 1100,
      "categoriaId": "lazer",
      "carteiraId": "cartao",
      "data": "2026-11-05",
      "observacao": "",
      "parcela": { "atual": 2, "total": 10 }
    }
  ],
  "orcamentos": { "alimentacao": 1200 },
  "metas": [{ "id": "meta-1", "nome": "Reserva", "alvo": 20000, "guardado": 11400, "prazo": "2027-06-30", "cor": "#c9f75d" }],
  "recorrencias": [
    {
      "id": "rec-1",
      "tipo": "saida",
      "descricao": "Aluguel",
      "valor": 2200,
      "categoriaId": "moradia",
      "carteiraId": "principal",
      "frequencia": "mensal",
      "proxima": "2027-01-05",
      "ativa": true
    }
  ]
}
```

Na primeira abertura, se existir a chave antiga `finance_transacoes`, o app migra as transações automaticamente para o novo formato, criando a carteira "Conta principal" e associando cada `categoria` antiga à categoria correspondente.

A exportação gera um arquivo `finance-tracker-AAAA-MM-DD.json` com o formato:

```json
{
  "app": "finance-tracker-pro",
  "versao": 2,
  "exportadoEm": "2026-11-22T20:00:00.000Z",
  "estado": { "versao": 2, "carteiras": [], "categorias": [], "transacoes": [], "orcamentos": {}, "metas": [], "recorrencias": [] }
}
```

A importação aceita esse arquivo, um objeto de estado direto ou o formato antigo com um array de transações. Cada item passa por validação, ids inválidos são regenerados e campos desconhecidos são descartados. **Mesclar** adiciona os itens do arquivo aos atuais; **substituir** troca o estado inteiro.

Textos digitados são escapados antes de entrar no DOM, e o valor é validado como número positivo. Não há servidor, conta de usuário, telemetria ou requisição com os seus dados — as únicas conexões externas são o Chart.js e as fontes. Limpar os dados do site no navegador apaga o histórico.

## Limitações e próximos passos

- Uma única moeda (real brasileiro). Há várias carteiras, mas todas na mesma moeda; não há conversão cambial.
- A mesclagem de importação adiciona todos os itens do arquivo, sem deduplicação. Reimportar o mesmo backup duplica lançamentos; para restaurar um backup exato, use **substituir**.
- Recorrências lançam automaticamente as ocorrências vencidas até a data atual (com limite de segurança), mas não é possível editar o valor de uma série existente nem pausá-la por um período — é preciso excluir e recriar.
- Parcelamento disponível apenas para saídas e sem juros ou taxas; o valor informado é o de cada parcela.
- Orçamentos são mensais e por categoria, não por carteira, e não há orçamento anual.
- Relatórios não têm exportação em CSV/PDF nem intervalo de datas personalizado.
- Os dados ficam no navegador e no dispositivo: não sincronizam entre máquinas. O JSON de exportação é o caminho para migrar ou fazer backup.
- Sem autenticação — o projeto é de uso pessoal e local. Sincronização real entre dispositivos e login exigem um backend, que está fora do escopo de um app estático.

Evoluções naturais: backend com autenticação e sincronização, suporte a múltiplas moedas, orçamento por carteira, edição de séries recorrentes, exportação de relatórios e intervalos de data personalizados.

## Autor

Desenvolvido por João Paulo (@Joaopaulo-devv).
