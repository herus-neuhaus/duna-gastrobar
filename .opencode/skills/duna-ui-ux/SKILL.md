---
name: duna-ui-ux
description: Audite e especifique UI/UX do Duna, navegação, tabelas, formulários, densidade, design system e microcopy; use para eliminar layouts genéricos ou inchados sem sacrificar acessibilidade.
---

# UI/UX operacional do Duna

Leia as [convenções de componentes](../../../components/ui/README.md), os tokens
em `app/globals.css` (caminho na raiz) e a tela/shell afetados. Consulte o domínio
para entender atores, frequência, urgência e permissões. Não copie produtos de
referência; use maturidade de organização e eficiência como padrão de qualidade.

## Método

1. Identifique tarefa principal, informação necessária e ação mais frequente.
   Examine navegação, hierarquia, quantidade de passos e manutenção de contexto.
2. Registre evidência: screenshot/navegador e viewport quando disponíveis;
   caso contrário, rotule análise de código e não infira aparência renderizada.
3. Aplique o [checklist de interface](references/checklist.md). Classifique
   impacto **alto** (bloqueio/erro/acesso), **médio** (atrito recorrente), **baixo**
   (polimento). Não confunda gosto pessoal com defeito observado.
4. Proponha alteração concreta por achado: layout, agrupamento, ação contextual,
   componente reutilizado, espaçamento/hierarquia e comportamento responsivo.
5. Especifique loading, vazio inicial, vazio filtrado, erro recuperável, sucesso,
   indisponibilidade e falta de permissão. Preserve filtros e contexto após ações.
6. Verifique teclado, foco, labels, mensagens, contraste e leitura em zoom;
   referências: WCAG 2.2 AA, sem declarar conformidade sem avaliação.

## Diretrizes

- Tabelas para comparação/tabulação; cards para resumo e indicadores úteis.
- Layout compacto, não apertado: escalas existentes, texto legível, alvos de
  toque adequados; WCAG 2.2 AA prevê 24×24 CSS px ou exceções aplicáveis para
  alvos, não uma licença para reduzir todos os controles ao mínimo.
- Campos com largura proporcional ao conteúdo, agrupamento lógico e labels
  persistentes. Não use placeholder como único rótulo.
- Ação primária inequívoca, secundárias contextuais, destrutivas diferenciadas.
- Microcopy em português claro: o que aconteceu, consequência e próximo passo;
  evite jargão técnico, redundância e promessas que o backend não garante.
- Preserve marca, tokens e componentes Tucano/React já adotados. Não inicie
  widgets JS em campos controlados nem proponha biblioteca nova sem necessidade.

## Entrega

Por achado: local + evidência → impacto operacional → proposta concreta →
componente/padrão existente → critério verificável. Inclua organização dos dados,
ações, estados, desktop/tablet/celular e limitações da inspeção. Questões de negócio
voltam a produto; esta skill não autoriza alterar capacidade, valores ou acesso.
