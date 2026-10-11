# Funcionalidades do Duna

Documentação funcional e técnica do sistema existente, baseada na leitura do código, migrations, tipos e testes do repositório. O objetivo é explicar responsabilidades, conexões e pontos de atenção; este material não altera regras de negócio.

## Índice

- [Arquitetura e inventário](arquitetura.md) — páginas, controllers (Route Handlers), serviços/helpers, banco e integrações.
- [Fluxos entre módulos](fluxos.md) — caminhos principais entre interface, API, serviços e persistência.
- [Reservas, disponibilidade e mesas](reservas-e-mesas.md) — criação, gestão, capacidade, alocação e operação.
- [Cardápio digital, atendimento e comandas](cardapio-digital.md) — desenho confirmado do módulo planejado de QR, pedidos, produção, caixa e fechamento.
- [Pagamentos e financeiro](pagamentos-e-financeiro.md) — PIX, Pagar.me, webhook e consulta financeira.
- [Equipe, tarefas e configurações](equipe-e-configuracoes.md) — usuários, checklist, datas, decorações e recursos administrativos.
- [Permissões e segurança](permissoes.md) — autenticação, autorização, RLS e fronteiras de confiança.
- [Auditoria e duplicações candidatas](auditoria.md) — sobreposições, riscos, lacunas e itens a validar.

## Leitura e limites

- “Controller” é usado aqui como referência informal aos **Route Handlers** do Next.js (`app/api/**/route.ts`); o projeto não segue MVC estrito.
- `lib/` contém helpers/serviços pequenos, não uma camada uniforme de serviços de domínio.
- A definição de schema vem principalmente do histórico de migrations e dos tipos gerados em `lib/supabase/database.types.ts`. O catálogo em `supabase/inspection/` é ferramenta de comparação, não o schema declarativo completo.
- Não se inferiu comportamento apenas pelo nome de uma tela ou tabela. Onde há incerteza (por exemplo, privilégios concedidos via RLS ou conteúdo operacional do banco remoto), ela é marcada para confirmação.
- Esta documentação descreve o estado do repositório inspecionado. Mudanças de código ou migrations exigem atualização dos documentos relacionados.

## Atalhos

- Para localizar uma tela: `app/admin/page.tsx` e `app/admin/AdminLayoutShell.tsx`.
- Para localizar endpoint: consulte a tabela de `arquitetura.md` e depois o `route.ts` correspondente.
- Para localizar regra persistente: pesquise RPCs/triggers nas migrations e confirme a migration final que substitui versões anteriores.
- Para verificar cobertura: veja os testes listados em cada documento e execute `npm test` / `npm run test:db` quando o ambiente de banco local estiver configurado.
