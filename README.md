# FinanceTracker Pro

**Dashboard pessoal de finanças em HTML, CSS e JavaScript puro.**

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![Chart.js](https://img.shields.io/badge/Chart.js-FF6384?style=flat&logo=chartdotjs&logoColor=white)
![localStorage](https://img.shields.io/badge/dados-localStorage-c8f564?style=flat)

Registro de entradas e saídas, saldo em tempo real, gráficos e relatórios — tudo no navegador, sem backend e sem cadastro. O projeto nasceu como primeiro trabalho de desenvolvimento web, para praticar estruturação de HTML, um sistema de design em CSS e manipulação de estado em JavaScript.

![Prévia do dashboard](preview.png)

## Funcionalidades

**Dashboard**
- Cards de entradas, saídas e saldo, com contagem de transações e indicador de saldo positivo ou negativo.
- Filtro de período: todos os períodos, este mês ou últimos sete dias.
- Gráfico de linha com o fluxo de caixa (entradas vs. saídas) agrupado por data.
- Gráfico de rosca com a distribuição das saídas por categoria.
- Lista das cinco últimas transações cadastradas.

**Adicionar**
- Descrição, valor, categoria, data (padrão: hoje) e observação opcional.
- Botões separados para registrar entrada ou saída.
- Validação de descrição e valor, com mensagem de erro no formulário.
- Confirmação por toast e limpeza automática dos campos após o registro.

**Transações**
- Histórico completo em ordem inversa de cadastro (o último registro aparece no topo).
- Busca por descrição e filtros por tipo (entrada/saída) e por categoria.
- Exclusão individual de cada transação.

**Relatórios**
- Resumo de entradas, saídas, saldo e total de transações.
- Taxa de comprometimento da renda (saídas sobre entradas).
- Ranking de gastos por categoria, com barras proporcionais.
- As cinco maiores despesas registradas.

**Outros**
- Persistência automática no `localStorage`: os dados sobrevivem ao recarregamento da página.
- Botão "Limpar tudo" com confirmação antes de apagar o histórico.
- Tema escuro, tipografia DM Serif Display + DM Sans e layout responsivo para telas menores.

## Stack

| Camada | Escolha |
| --- | --- |
| Interface | HTML5 sem framework |
| Estilo | CSS puro com variáveis de design (`:root`), Grid e Flexbox |
| Lógica | JavaScript ES6, organizado como módulo IIFE (`App`) |
| Gráficos | Chart.js via CDN (versão mais recente) |
| Persistência | `localStorage` |
| Fontes | Google Fonts (DM Serif Display e DM Sans) |

Sem etapa de build e sem dependências instaladas localmente: os dois recursos externos (Chart.js e as fontes) vêm por CDN.

## Estrutura

```text
.
├── index.html   # marcação das quatro seções (Dashboard, Adicionar, Transações, Relatórios)
├── style.css    # design tokens, layout, componentes, gráficos e responsividade
├── script.js    # estado, persistência, cálculos, gráficos, filtros e relatórios
└── preview.png  # captura do dashboard usada neste README
```

O `script.js` expõe apenas o necessário para os atributos `onclick` do HTML: `adicionar`, `excluir`, `limparTudo`, `atualizarTudo`, `renderizarLista` e `navegarPara`. O restante — estado, cálculos e renderização — fica encapsulado na IIFE.

## Como executar

Não há instalação. Basta abrir o `index.html` no navegador. Para servir por HTTP (recomendado, e necessário se você quiser usar o projeto a partir de outro dispositivo na mesma rede):

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

O `localStorage` é vinculado à origem: abrir via `file://` e via `http://localhost` cria dois armazenamentos separados. Escolha um modo e mantenha.

## Como os dados são guardados

Cada transação é um objeto com `id`, `tipo` (`entrada` ou `saida`), `descricao`, `valor` numérico, `categoria`, `data` no formato ISO (`AAAA-MM-DD`) e `observacao`. O array completo é serializado em JSON na chave `finance_transacoes` do `localStorage`, regravado a cada inclusão, exclusão ou limpeza.

Não há servidor, conta de usuário, telemetria ou requisição com os seus dados. As únicas conexões externas são o Chart.js e as fontes. Limpar os dados do site no navegador apaga o histórico.

## Limitações e próximos passos

- Uma única moeda (real brasileiro) e uma única carteira; não há contas separadas.
- Sem exportação ou importação de dados (CSV/JSON) e sem backup.
- Sem transações recorrentes, orçamentos, metas ou parcelamento.
- Os dados ficam no navegador e no dispositivo: não sincronizam entre máquinas.
- Abaixo de 900px a sidebar sai da tela e ainda não existe um botão para reabri-la.
- Sem autenticação — o projeto é de uso pessoal e local.

Evoluções naturais: menu mobile, exportação/importação em JSON, filtros de data personalizados, categorias editáveis e, se o projeto crescer, um backend com autenticação.

## Autor

Desenvolvido por **João Paulo** ([@Joaopaulo-devv](https://github.com/Joaopaulo-devv)).
