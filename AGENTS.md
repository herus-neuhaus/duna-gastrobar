# Duna — orientação permanente

## Produto e stack

O Duna é um SaaS comercial de gestão de restaurantes: clareza operacional,
confiabilidade financeira e eficiência da equipe importam mais que velocidade de
geração de código. Questione soluções ruins com evidências e alternativas, sem
inventar regras comerciais ou transformar sugestões em requisitos aprovados.

Stack: Next.js 15 App Router, React 19, TypeScript estrito, Tailwind CSS 4,
Tucano e componentes próprios; Supabase Auth/PostgreSQL/RPC/RLS/Storage;
Pagar.me e Resend. npm e `package-lock.json`; Node.js 22+. Não presumir Laravel.
Confirme versões atuais no lockfile antes de usar APIs de outra versão.

## Mapa e fontes

- `app/`: páginas e painel; `app/api/`: Route Handlers Next.js.
- `components/ui/`, `app/components/`, `hooks/`: interface compartilhada.
- `lib/`: helpers de domínio, autorização, pagamentos e clientes Supabase.
- `supabase/`: migrations, bootstrap exclusivamente local e inspeções históricas.
- `tests/`: Vitest; `tests/database/`: testes PostgreSQL isolados.
- Comece em `docs/funcionalidades/README.md` e consulte apenas os domínios afetados.
  `arquitetura.md`, `fluxos.md` e `permissoes.md` orientam o mapa e as fronteiras.
- Código, contratos e sequência final de migrations descrevem implementação;
  decisões aprovadas descrevem intenção. Se divergirem, registre e esclareça,
  não escolha silenciosamente. Tipos gerados não comprovam RLS nem produção.
- `docs/plano-*.md` são evidências históricas, não confirmação de implantação.
  Cardápio/comandas em `cardapio-digital.md` são planejados. Taxa de reserva não
  equivale automaticamente a sinal convertido em consumo.

## Princípios de desenvolvimento

1. Entenda código e regras existentes antes de propor alterações.
2. Reutilize componentes, funções e padrões; leia `components/ui/README.md`.
3. Não duplique lógica de negócio; valide invariantes em camada confiável.
4. Evite abstrações e novas camadas sem necessidade concreta.
5. Não implemente funcionalidades especulativas ou regras não aprovadas.
6. Preserve compatibilidade com dados, contratos e fluxos existentes.
7. Separe negócio de apresentação; não esconda mudanças comerciais em ajustes UX.
8. Priorize acessibilidade, responsividade, legibilidade e densidade equilibrada.
9. Código simples, legível e sustentável; TypeScript estrito, sem `any`/casts
   amplos para ocultar incompatibilidades; use o alias `@/*` quando consistente.
10. Verifique impacto nos módulos vizinhos, autorização, concorrência e financeiro.
11. Registre decisões relevantes, alternativas e motivos na documentação afetada.
12. Diferencie observado, aprovado, proposto, implementado e implantado.
13. Preserve alterações do usuário. Não faça refatorações ou instalações incidentais.
14. Nunca declare sucesso de testes não executados ou de verificações só estáticas.

## Segurança e operações

- Autorização na API/RLS/RPC; ocultar botão ou redirecionar não autoriza operações.
  Cliente privilegiado somente no servidor, após guarda explícita apropriada.
- Não leia/exponha credenciais, `.env`, tokens, CPF ou dados reais em logs/fixtures.
  Não suponha multi-tenant implementado: confirme isolamento antes de expandi-lo.
- Alterações remotas, deploy, cobranças e reparação de dados exigem tarefa e
  autorização específicas. Os agentes Duna não recebem escrita remota por padrão.
- `duna-database` é o executor de banco selecionado diretamente pelo usuário:
  metadados permitidos, SQL e migrations via MCP sob aprovação por operação.
  Os demais agentes continuam sem execução Supabase. Selecionar/criar o perfil
  não autoriza automaticamente aplicar alterações pendentes nem contornar negativas.
- Não altere a configuração global do MCP nem reinstale as skills Supabase.
  Exemplos externos não autorizam DDL remoto. Nunca aplique bootstrap local em
  banco existente ou envie toda a pasta histórica sem reconciliação aprovada.
- Fuso de negócio observado: `America/Porto_Velho`; não o substitua implicitamente.

## Fluxo e verificação

Para mudanças relevantes: Produto → UI/UX (se houver interface) → Engenharia →
Qualidade independente. Simplifique correções pequenas. O orquestrador delega
somente quando útil; cada especialista carrega suas skills pertinentes sob demanda.
Uso, permissões e validação da arquitetura: `.opencode/README.md`.

Conforme o escopo: `npm run typecheck`, `npm run lint`, `npm test` e revisão de
diff. Testes de banco dependem de ambiente isolado e procedimento revisado em
`docs/plano-1-banco.md`; há referências incrementais antigas apontadas na auditoria.
Não corrija essas pendências incidentalmente. Não inicie stack ou integração real
para substituir testes indisponíveis. Entregue critérios de aceite, evidências,
falhas, verificações não executadas e riscos residuais; compilar não basta.
