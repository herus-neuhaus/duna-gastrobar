---
name: duna-product-rules
description: Investigue requisitos, regras e critérios de aceite do Duna para reservas, operação, financeiro, configurações e permissões; use antes de propor mudanças comerciais ou esclarecer divergências.
---

# Produto e regras do Duna

Use para analisar necessidade e comportamento, não para implementar sugestões
sem aprovação. Questione regras incoerentes e ofereça alternativas com impacto,
sem transformar padrões genéricos de restaurante em decisões do Duna.

Leia [mapa de domínios e perguntas](references/domains.md) e selecione apenas as
fontes do domínio afetado. Todos os caminhos `../../../` partem desta skill para
a raiz do repositório. Comece no [índice funcional](../../../docs/funcionalidades/README.md).

## Investigação obrigatória

1. **Atual:** quem usa, qual tarefa realiza e qual comportamento está implementado?
   Leia tela, handler/helper, RPC/migration final e testes pertinentes. Identifique
   evidência e data; documento histórico não comprova produção.
2. **Problema:** qual falha, esforço, perda, risco ou inconsistência foi observado?
   Separe sintoma, causa provável e hipótese ainda não validada.
3. **Esperado:** descreva resultado útil ao cliente/equipe, atores, entradas,
   estados e transições. Separe regra aprovada de proposta e dúvida pendente.
4. **Regras:** fonte, precedência de exceções, capacidade/agenda, financeiro,
   autorização por ação e auditoria. Se documento e código divergem, registre
   ambos e confirme a intenção antes de alterar o negócio.
5. **Extremos:** concorrência, repetição, falha parcial, cancelamento, atraso,
   indisponibilidade, histórico legado, permissões insuficientes e mudança de turno.
6. **Impactos:** reservas ↔ operação ↔ mesas ↔ cobrança ↔ equipe/configurações;
   dados existentes, privacidade, treinamento, relatórios e compatibilidade.
7. **Aceite:** critérios observáveis no formato Dado/Quando/Então quando útil;
   inclua caminho feliz, negativo, fronteiras, autorização e preservação histórica.

## Saída

Entregue problema/ator, história de usuário quando agregar valor, regra atual e
proposta, decisões pendentes, impactos, critérios de aceite e prioridade com
justificativa (valor, frequência, risco e esforço estimado). Uma sugestão deve
permanecer rotulada como sugestão. Não prometa prazo ou conformidade não avaliada.

Não misture taxa de reserva, sinal, consumo e receita contábil. Não assuma
multi-estabelecimento implementado nem invente política de estorno, tolerância,
conversão de sinal ou permissões financeiras. Documente decisões relevantes no
domínio correspondente quando uma tarefa posterior autorizar a escrita.
