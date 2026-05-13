'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Plus, 
  Edit2, 
  Trash2, 
  Send, 
  ChevronRight, 
  Undo2,
  Check,
  Save,
  MessageCircle
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Database } from '@/lib/supabase/database.types';

type Template = Database['public']['Tables']['whatsapp_templates']['Row'];

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerName: string;
  customerPhone: string;
}

export default function WhatsAppModal({ isOpen, onClose, customerName, customerPhone }: WhatsAppModalProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState<Partial<Template> | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [undoTimeout, setUndoTimeout] = useState<NodeJS.Timeout | null>(null);
  
  const supabase = createClient();

  const fetchTemplates = React.useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('whatsapp_templates')
      .select('*')
      .order('created_at', { ascending: true });

    if (!error) {
      setTemplates(data || []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen, fetchTemplates]);

  const handleSave = async () => {
    if (!currentTemplate?.title || !currentTemplate?.content) return;

    const { error } = currentTemplate.id 
      ? await supabase.from('whatsapp_templates').update({ 
          title: currentTemplate.title, 
          content: currentTemplate.content,
          updated_at: new Date().toISOString()
        }).eq('id', currentTemplate.id)
      : await supabase.from('whatsapp_templates').insert([{ 
          title: currentTemplate.title, 
          content: currentTemplate.content 
        }]);

    if (!error) {
      fetchTemplates();
      setIsEditing(false);
      setCurrentTemplate(null);
    }
  };

  const handleDeleteClick = (id: string) => {
    // Optimistic UI: remove from list
    const originalTemplates = [...templates];
    setTemplates(templates.filter(t => t.id !== id));
    setDeletingId(id);

    // Set timeout for permanent deletion
    const timeout = setTimeout(async () => {
      await supabase.from('whatsapp_templates').delete().eq('id', id);
      setDeletingId(null);
    }, 5000);

    setUndoTimeout(timeout);
  };

  const handleUndo = () => {
    if (undoTimeout) {
      clearTimeout(undoTimeout);
      setUndoTimeout(null);
      setDeletingId(null);
      fetchTemplates(); // Restore original list
    }
  };

  const handleSend = (content: string) => {
    const message = content.replace(/{{nome}}/g, customerName);
    const phone = customerPhone.replace(/\D/g, '');
    const formattedPhone = phone.startsWith('55') ? phone : `55${phone}`;
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${formattedPhone}?text=${encodedMessage}`, '_blank');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#FDFBF7] w-full max-w-lg rounded-[32px] shadow-2xl border border-[#D9CFC1] overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 bg-[#4A3728] text-white flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl font-serif font-bold tracking-tight">Mensagens Rápidas</h2>
            <p className="text-[10px] uppercase tracking-widest opacity-60 font-medium mt-0.5">Cliente: {customerName}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          
          {deletingId && (
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl flex items-center justify-between animate-in slide-in-from-top-2">
              <p className="text-xs font-bold text-amber-800">Template removido</p>
              <button 
                onClick={handleUndo}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-800 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-amber-900 transition-colors"
              >
                <Undo2 size={14} /> Desfazer
              </button>
            </div>
          )}

          {isEditing ? (
            <div className="space-y-4 bg-white p-5 rounded-3xl border border-[#D9CFC1] shadow-sm animate-in slide-in-from-bottom-2">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#4A3728]/60 ml-1">Título do Template</label>
                <input 
                  type="text" 
                  value={currentTemplate?.title || ''}
                  onChange={(e) => setCurrentTemplate({ ...currentTemplate, title: e.target.value })}
                  placeholder="Ex: Confirmação de Reserva"
                  className="w-full bg-[#F5F2ED] border-none rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-[#4A3728]/20 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#4A3728]/60 ml-1">Mensagem (use {'{{nome}}'})</label>
                <textarea 
                  value={currentTemplate?.content || ''}
                  onChange={(e) => setCurrentTemplate({ ...currentTemplate, content: e.target.value })}
                  placeholder="Olá {{nome}}! Sua reserva está confirmada..."
                  className="w-full bg-[#F5F2ED] border-none rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-[#4A3728]/20 transition-all min-h-[120px] resize-none"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button 
                  onClick={() => { setIsEditing(false); setCurrentTemplate(null); }}
                  className="flex-1 py-3 rounded-2xl bg-[#F5F2ED] text-[#4A3728] text-xs font-bold uppercase tracking-widest hover:bg-[#EBE3D5] transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSave}
                  className="flex-1 py-3 rounded-2xl bg-[#4A3728] text-white text-xs font-bold uppercase tracking-widest hover:bg-[#3A2B1F] transition-colors flex items-center justify-center gap-2"
                >
                  <Save size={16} /> Salvar
                </button>
              </div>
            </div>
          ) : (
            <>
              {loading ? (
                <div className="flex flex-col items-center justify-center py-10 opacity-40">
                  <MessageCircle className="animate-pulse mb-2" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">Carregando...</p>
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-10 opacity-40">
                  <p className="text-sm font-medium">Nenhum template cadastrado.</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {templates.map((template) => (
                    <div 
                      key={template.id} 
                      className="group bg-white border border-[#D9CFC1] p-4 rounded-3xl hover:border-[#4A3728] hover:shadow-md transition-all relative overflow-hidden"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-sm text-[#4A3728]">{template.title}</h3>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => { setCurrentTemplate(template); setIsEditing(true); }}
                            className="p-1.5 text-[#4A3728]/40 hover:text-[#4A3728] hover:bg-[#F5F2ED] rounded-lg transition-colors"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            onClick={() => handleDeleteClick(template.id)}
                            className="p-1.5 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-[#4A3728]/60 line-clamp-2 pr-10">{template.content.replace(/{{nome}}/g, customerName)}</p>
                      
                      <button 
                        onClick={() => handleSend(template.content)}
                        className="absolute right-3 bottom-3 p-3 bg-[#4A3728] text-white rounded-2xl shadow-lg hover:scale-110 active:scale-95 transition-all group-hover:translate-x-0 lg:translate-x-12 opacity-100 lg:opacity-0 group-hover:opacity-100"
                      >
                        <Send size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button 
                onClick={() => { setCurrentTemplate({}); setIsEditing(true); }}
                className="w-full py-4 border-2 border-dashed border-[#D9CFC1] rounded-[24px] text-[#4A3728]/40 hover:text-[#4A3728] hover:border-[#4A3728]/40 hover:bg-white transition-all flex items-center justify-center gap-2 group"
              >
                <div className="p-1 bg-[#F5F2ED] rounded-full group-hover:bg-[#4A3728] group-hover:text-white transition-colors">
                  <Plus size={16} />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest">Novo Template</span>
              </button>
            </>
          )}
        </div>

        {/* Footer info */}
        <div className="p-4 bg-[#F5F2ED] border-t border-[#D9CFC1] shrink-0">
          <div className="flex items-center gap-2 text-[10px] text-[#4A3728]/50 font-bold uppercase tracking-widest">
            <Check size={14} className="text-green-600" />
            Variação {'{{nome}}'} é substituída automaticamente
          </div>
        </div>
      </div>
    </div>
  );
}
