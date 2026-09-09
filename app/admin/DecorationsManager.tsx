'use client';

import React, { useEffect, useState } from 'react';
import { ImagePlus, Loader2, Power, Plus, Trash2 } from 'lucide-react';

type Decoration = {
  id: string;
  name: string;
  image_url: string;
  image_path: string;
  active: boolean;
};

export default function DecorationsManager() {
  const [decorations, setDecorations] = useState<Decoration[]>([]);
  const [name, setName] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  const fetchDecorations = async () => {
    try {
      const response = await fetch('/api/admin/decorations', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível consultar as decorações.');
      setDecorations(result.decorations || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível consultar as decorações.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetchDecorations();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  const createDecoration = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setMessage('');

    try {
      const payload = new FormData();
      payload.set('name', name);
      if (image) payload.set('image', image);

      const response = await fetch('/api/admin/decorations', {
        method: 'POST',
        body: payload,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível criar a decoração.');

      setDecorations((currentDecorations) => [result.decoration, ...currentDecorations]);
      setName('');
      setImage(null);
      setMessage('Espaço adicionado e disponível para novas reservas.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível criar a decoração.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteDecoration = async (decoration: Decoration) => {
    if (!window.confirm(`Excluir "${decoration.name}" e remover sua imagem permanentemente?`)) return;

    try {
      const response = await fetch(`/api/admin/decorations?id=${encodeURIComponent(decoration.id)}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível excluir a decoração.');

      setDecorations((currentDecorations) => currentDecorations.filter((currentDecoration) => currentDecoration.id !== decoration.id));
      setMessage('Espaço e imagem excluídos.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível excluir a decoração.');
    }
  };

  const setActive = async (decoration: Decoration) => {
    try {
      const response = await fetch('/api/admin/decorations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: decoration.id, active: !decoration.active }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível atualizar a decoração.');

      setDecorations((currentDecorations) => currentDecorations.map((currentDecoration) => (
        currentDecoration.id === decoration.id ? result.decoration : currentDecoration
      )));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível atualizar a decoração.');
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[#D9CFC1] bg-white p-6 shadow-sm lg:p-8">
        <div className="mb-6 flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#F5F2ED] text-[#4A3728]"><ImagePlus size={22} /></div>
          <div>
            <h3 className="font-serif text-xl font-bold text-[#4A3728]">Novo espaço ou decoração</h3>
            <p className="mt-1 text-xs leading-relaxed text-[#4A3728]/60">Cadastre mesas e espaços para aniversários ou eventos. A imagem é enviada do seu dispositivo e removida do Storage ao excluir o cadastro.</p>
          </div>
        </div>
        <form onSubmit={createDecoration} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]">
          <input required value={name} onChange={(event) => setName(event.target.value)} maxLength={100} className="rounded-xl border border-[#D9CFC1] px-4 py-3 text-sm outline-none focus:border-[#4A3728]" placeholder="Ex.: Mesa varanda, Espaço aniversário" />
          <input required type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImage(event.target.files?.[0] || null)} className="rounded-xl border border-[#D9CFC1] bg-white px-4 py-3 text-sm text-[#4A3728] file:mr-3 file:border-0 file:bg-[#F5F2ED] file:px-3 file:py-1 file:text-xs file:font-bold file:text-[#4A3728]" />
          <button disabled={isSaving} className="flex items-center justify-center gap-2 rounded-xl bg-[#4A3728] px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-white disabled:opacity-50">
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Adicionar
          </button>
        </form>
        {message && <p className="mt-4 rounded-xl bg-[#F5F2ED] px-4 py-3 text-xs text-[#4A3728]">{message}</p>}
      </section>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[#4A3728]/40" /></div>
      ) : decorations.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#D9CFC1] bg-white px-6 py-14 text-center text-sm text-[#4A3728]/50">Nenhuma decoração cadastrada.</div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {decorations.map((decoration) => (
            <article key={decoration.id} className={`overflow-hidden rounded-3xl border bg-white shadow-sm ${decoration.active ? 'border-[#D9CFC1]' : 'border-[#D9CFC1]/60 opacity-60'}`}>
              <img src={decoration.image_url} alt={decoration.name} className="h-44 w-full object-cover" />
              <div className="flex items-center justify-between gap-3 p-5">
                <div>
                  <h3 className="font-bold text-[#4A3728]">{decoration.name}</h3>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-[#4A3728]/50">{decoration.active ? 'Disponível' : 'Indisponível'}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setActive(decoration)} className="rounded-xl border border-[#D9CFC1] bg-[#F5F2ED] p-3 text-[#4A3728]" title={decoration.active ? 'Desativar' : 'Ativar'}>
                    <Power size={17} />
                  </button>
                  <button onClick={() => deleteDecoration(decoration)} className="rounded-xl border border-red-100 bg-red-50 p-3 text-red-600" title="Excluir espaço e imagem">
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
