'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Erro de interface:', error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FDFBF7] p-6 text-center text-[#4A3728]">
      <div className="max-w-md rounded-3xl border border-[#D9CFC1] bg-white p-8 shadow-sm">
        <h1 className="font-serif text-3xl font-bold">Algo não saiu como esperado</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#4A3728]/65">Atualize a página ou tente novamente. Se o problema continuar, fale com a equipe.</p>
        <button onClick={reset} className="mt-6 rounded-xl bg-[#4A3728] px-5 py-3 text-xs font-bold uppercase tracking-widest text-white">Tentar novamente</button>
      </div>
    </main>
  );
}
