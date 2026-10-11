# Equipe, tarefas e configurações

## Login e gestão de pessoas

- `/login` autentica via Supabase Auth com senha.
- Perfis em `profiles` carregam papel e flag `force_password_change`; quando habilitada, recursos de troca forçada estão em `ForcePasswordChangeModal` e `/api/account/password`.
- `POST /api/admin/employees` cria usuário Auth e perfil, valida nome/e-mail/senha e limita os cargos aceitos nesse endpoint.
- `FuncionariosManager` também consulta e altera `profiles`/`employee_roles` diretamente usando cliente Supabase. A autorização efetiva dessas chamadas depende de RLS e funções SQL; não há um endpoint central para toda mutação de perfil.
- Cargo operacional (`employee_roles`) não deve ser confundido automaticamente com papel de acesso (`profiles.role`).

## Tarefas e checklist

Tabelas: `tasks`, `task_categories`, `task_completions`, `employee_roles`, `profiles`.

- `TarefasManager` cria/edita/remove categorias e tarefas; pode atribuir tarefa a funcionário, cargo operacional ou grupo geral e configurar data/recorrência diária.
- `app/funcionario/checklist/page.tsx` seleciona tarefas aplicáveis à data e ao funcionário/cargo, consulta conclusões do dia e permite marcar início/conclusão e editar nome de perfil.
- `ProdutividadeDashboard` lê conclusões e mostra métricas/estado para gestão.
- Há acesso direto do navegador às tabelas. Funções `can_access_task` e `can_start_task` e políticas de RLS são parte essencial do comportamento, não apenas a filtragem no React.
- Atenção: checklist busca tarefas e filtra em JavaScript conforme comentário do código; verificar a política que restringe o conjunto realmente entregue ao usuário, sem assumir que filtro de UI é controle de segurança.

## Permissões de capacidade

`FuncionariosManager` apresenta gerenciamento de permissões excepcionais; API `/api/admin/capacity-permissions` restringe concessão/consulta ao dono. As tabelas guardam concessão/revogação, auditoria e usos/nonce. Funções SQL de hardening verificam ator, escopo, uso e trilha. Ver `permissoes.md`.

## Datas da agenda

- `SpecialDatesManager` mantém `special_dates`, com descrição e campos como taxa/quantidade incluída.
- `BlockedDatesManager` mantém `blocked_dates`, com data e motivo.
- As telas acessam banco diretamente por Supabase client; disponibilidade pública consulta ambas pelo endpoint.
- Há validação de data no cliente e no fluxo de disponibilidade, mas confirmar políticas RLS para escrita é necessário para conhecer o limite real de autorização.

## Decorações

- `DecorationsManager` chama `/api/admin/decorations`.
- Backend limita tipos/tamanho de arquivo, gerencia bucket `decorations` e metadados em `decorations`.
- `/api/decorations` publica itens ativos e disponibilidade condicionada a data/hora.
- RPC `get_reservation_decoration_availability` e migration de conflitos de período protegem o uso concorrente.

## WhatsApp

`app/components/WhatsAppModal.tsx` faz operações CRUD diretas em `whatsapp_templates`. Este inventário comprova o cadastro/modelo de templates na interface, mas não confirma envio automatizado por provedor de WhatsApp.

## Navegação e shell

`AdminLayoutShell` organiza grupos/views no painel, autentica a sessão e exibe mudança obrigatória de senha. A visibilidade de um item de navegação não é autorização: endpoints e RLS devem ser a barreira real.
