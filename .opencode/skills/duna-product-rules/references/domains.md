# Mapa de domínios e decisões

Caminhos de documentação abaixo são relativos a esta referência.

| Domínio | Fonte inicial | Perguntas e invariantes a investigar |
|---|---|---|
| Reservas, confirmação, cancelamento e capacidade | [Reservas e mesas](../../../../docs/funcionalidades/reservas-e-mesas.md) | Qual data/turno conta? Quais estados ocupam capacidade? Quem pode exceder e por quê? Como tratar reagendamento e legado? |
| Fila, walk-in e operação diária | [Fluxos](../../../../docs/funcionalidades/fluxos.md) e reservas | Ordem/prioridade, abandono, contato, chegada, conflito de mesa e impacto na capacidade; não equiparar walk-in à reserva pública sem evidência. |
| Áreas, mesas e horários | [Equipe/configurações](../../../../docs/funcionalidades/equipe-e-configuracoes.md) e reservas | Agenda semanal versus exceção de data, bloqueios, buffers, área inativa, turno e histórico. Configuração não deve reinterpretar dados antigos silenciosamente. |
| Pagamentos e relatórios financeiros | [Financeiro](../../../../docs/funcionalidades/pagamentos-e-financeiro.md) | Valor final, finalidade, tentativas, expiração, cancelamento, pagamento tardio, repetição/falha parcial e reconciliação; painel atual não é faturamento total. |
| Funcionários e permissões | [Permissões](../../../../docs/funcionalidades/permissoes.md) e equipe/configurações | Papel de acesso versus cargo operacional; autorizar cada ação e objeto, incluindo exceção de capacidade e consulta financeira. |
| Salão, cardápio, pedidos e comandas futuros | [Cardápio planejado](../../../../docs/funcionalidades/cardapio-digital.md) | Reserva não é atendimento; mesa não é comanda; produção, entrega e pagamento são independentes. Identificar decisões pendentes antes de implementar. |

## Sinal convertido em consumo

Trate como requisito a confirmar, não como comportamento da taxa atual. Defina
com o responsável: origem/finalidade do crédito, titular e estabelecimento,
momento de reconhecimento, vínculo com reserva/atendimento, uso parcial,
duplicidade, cancelamento, no-show, validade, estorno e saldo remanescente.
Exija trilha auditável e critérios que impeçam uso duplo; não escolha essas
políticas comerciais por conta própria nem adapte `reservation_payments`
automaticamente para consumo.

## Evidências e precedência

- [Arquitetura](../../../../docs/funcionalidades/arquitetura.md) localiza implementações.
- [Auditoria funcional](../../../../docs/funcionalidades/auditoria.md) registra riscos.
- [Auditoria de IA](../../../../docs/auditoria-agentes-skills-opencode.md) aponta
  documentos divergentes, incluindo CPF/e-mail, e procedimentos incrementais antigos.
- Confirme a versão final no código e registre divergência; correção documental
  não significa correção implantada. Não replique contagens ou defeitos históricos
  como se tivessem sido verificados agora.
