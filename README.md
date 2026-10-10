# Duna Cozinha & Bar - Sistema de Reservas

Este é o sistema oficial de reservas e gerenciamento do Duna Cozinha & Bar, construído com Next.js e Supabase.

## Funcionalidades

- **Reservas Online:** Clientes podem agendar mesas de forma intuitiva.
- **Painel Administrativo:** Gestão completa de reservas, confirmações e cancelamentos.
- **Integração Supabase:** Banco de dados em tempo real e autenticação segura.

## Desenvolvimento

### Pré-requisitos
- Node.js 22+ e npm.
- Para reconstrução e testes PostgreSQL: Docker.

### Banco e validação técnica

Consulte [Plano 1 — banco, migrações e testes isolados](docs/plano-1-banco.md)
para a fonte de verdade, bootstrap local, geração de tipos, verificações,
diferenças do histórico remoto e pendências conhecidas.

```bash
npm ci
npm run db:start
npm run db:compare
npm run db:types:check
npm run typecheck
npm run lint
npm test
npm run test:db
npm run db:stop
```

`test:db` executa também reproduções `TODO` de dois defeitos conhecidos;
consulte o relatório antes de interpretar seu código de saída como sucesso total.
`db:stop` descarta somente a stack local dedicada. O bootstrap não deve ser
aplicado ao banco existente.

### Instalação

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Configure as variáveis de ambiente no arquivo `.env.local`:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=sua_url
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sua_chave_publica
   ```

3. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

## Licença

Exclusivo Duna Cozinha & Bar.
