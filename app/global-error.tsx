'use client';

export default function GlobalError() {
  return (
    <html lang="pt-BR">
      <body>
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px', fontFamily: 'sans-serif', textAlign: 'center' }}>
          <div>
            <h1>Não foi possível carregar a página</h1>
            <button onClick={() => window.location.reload()}>Recarregar</button>
          </div>
        </main>
      </body>
    </html>
  );
}
