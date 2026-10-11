# Componentes de interface

Os componentes React deste diretório são a API compartilhada da interface. Eles
usam a folha do [Tucano](https://github.com/JuniorCarlini/tucano) para botões,
campos, etiquetas, avisos e navegação; os tokens em `app/globals.css` adaptam a
biblioteca à paleta existente da Duna.

## Convenções

- Use `Button` com uma variante (`primary`, `secondary`, `danger`, `success` ou
  `ghost`) e tamanho (`sm`, `md`, `lg` ou `icon`).
- Use `Input`, `Select`, `Textarea` e `FieldLabel` em formulários administrativos.
- Use `StatusBadge` para status; não defina cores de status por tela.
- Use `Card`, `PageHeader`, `MetricCard`, `EmptyState` e `Feedback` para
  estruturas e estados compartilhados.
- Mantenha componentes específicos quando tiverem comportamento visual próprio,
  mas componha-os com estes primitives sempre que possível.
- Os widgets JavaScript do Tucano não devem ser inicializados em campos React
  controlados sem uma integração explícita: React continua sendo a fonte do
  estado desses campos.

Não altere as cores de marca ao adicionar variantes. Mudanças de regras de
reservas, pagamentos ou permissões não pertencem a esta camada visual.
