---
name: duna-frontend
description: Implemente interfaces aprovadas no Duna com React 19, Next.js App Router, TypeScript, Tailwind e Tucano, reutilizando componentes e validando estados, acessibilidade e responsividade.
---

# Frontend sustentável

Antes de editar, leia as [convenções UI](../../../components/ui/README.md), a tela,
componentes consumidores, estilos e testes afetados. Caminhos de código citados
sem links são relativos à raiz do repositório. Consulte o lockfile; não use APIs
do Next.js 16 porque uma dependência de lint tem esse major.

## Implementação

1. Confirme critérios e escopo aprovado. Preserve comportamento não solicitado;
   divergências de produto/UX exigem esclarecimento, não uma regra improvisada.
2. Reutilize `Button`, controles de formulário, `StatusBadge`, `PageHeader`,
   `Card`, `MetricCard`, `EmptyState` e `Feedback` quando pertinentes; não envolva
   tudo em cards. Preserve tokens/marca e a densidade planejada.
3. Respeite fronteiras Server/Client Components. Use `use client` apenas na
   fronteira interativa necessária; não leve cliente privilegiado, segredos ou
   dados desnecessários ao bundle do navegador.
4. Estado no menor escopo útil; distinga rascunho, filtro aplicado, dados remotos,
   loading e erro. Derive valores em vez de duplicá-los; efeitos precisam de
   dependências corretas e proteção contra respostas obsoletas quando aplicável.
5. Formulários: labels, tipos, mensagens próximas ao campo, submissão pendente,
   prevenção de repetição acidental e preservação de dados em erro. Validação
   client-side ajuda UX, nunca substitui a validação/autorização confiável.
6. Dados tipados e contratos existentes; trate `null`, vazio e falha explicitamente.
   Não use `any`, casts amplos ou defaults que escondam inconsistência financeira.
7. Evite consultas duplicadas, listas ilimitadas e renders custosos demonstráveis.
   Não adicione memoização, biblioteca de estado ou abstração por antecipação.
8. Mantenha React como fonte do estado de campos controlados; não inicialize
   widgets Tucano JS sem integração explícita.

## Verificação e entrega

- Testes de comportamento/estados e contratos afetados; `npm run typecheck`,
  `npm run lint`, `npm test` conforme escopo e aprovação de execução.
- Teclado, foco, nomes acessíveis, leitura sem cor e comportamento responsivo.
  Faça QA visual quando houver ambiente disponível/autorizado; sem ele, declare
  limitação. Teste Node não comprova interação renderizada.
- Consulte consumidor vizinho; uma alteração de primitive afeta várias telas.
- Documente mudanças de padrão e reporte critérios, arquivos, comandos reais,
  resultados e riscos. Não corrija regra comercial incidentalmente em um layout.
