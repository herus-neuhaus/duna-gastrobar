'use client';

export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { Calendar, Users, Clock, MessageSquare, User, CheckCircle2, ChevronDown, AlertCircle, Loader2, MapPin, Instagram, MessageCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function DunaGastrobarReservation() {
  const [activeStep, setActiveStep] = useState(1);
  const [date, setDate] = useState('');
  const [guests, setGuests] = useState<number | null>(null);
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [formData, setFormData] = useState({ name: '', email: '', whatsapp: '' });
  const [formErrors, setFormErrors] = useState({ name: '', email: '', whatsapp: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const supabase = createClient();

  const validateForm = () => {
    let valid = true;
    const errors = { name: '', email: '', whatsapp: '' };

    if (!formData.name.trim()) {
      errors.name = 'Nome é obrigatório.';
      valid = false;
    }

    if (!formData.email.trim()) {
      errors.email = 'E-mail é obrigatório.';
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'E-mail inválido.';
      valid = false;
    }

    if (!formData.whatsapp.trim()) {
      errors.whatsapp = 'WhatsApp é obrigatório.';
      valid = false;
    } else if (!/^\(?\d{2}\)?[\s-]?\d{4,5}-?\d{4}$/.test(formData.whatsapp)) {
      errors.whatsapp = 'Formato inválido. Ex: (11) 99999-9999';
      valid = false;
    }

    setFormErrors(errors);
    return valid;
  };

  const dates = [
    { label: 'Hoje, 04/05', value: '2026-05-04', available: true },
    { label: 'Amanhã, 05/05', value: '2026-05-05', available: true },
    { label: 'Qua, 06/05', value: '2026-05-06', available: true },
    { label: 'Qui, 07/05', value: '2026-05-07', available: true },
    { label: 'Sex, 08/05', value: '2026-05-08', available: true },
    { label: 'Sáb, 09/05', value: '2026-05-09', available: true },
  ];

  const times = ['19:00', '19:30', '20:00', '21:00', '21:30'];
  const guestOptions = Array.from({ length: 20 }, (_, i) => i + 1);

  const handleNext = (step: number) => {
    setActiveStep(step + 1);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    const { error } = await supabase
      .from('reservations')
      .insert([
        {
          name: formData.name,
          email: formData.email,
          whatsapp: formData.whatsapp,
          reservation_date: date,
          reservation_time: time,
          num_guests: guests,
          notes: notes,
          payment_status: (guests && guests >= 15) ? 'pending' : 'not_required',
          payment_amount: (guests && guests >= 15) ? 100 : 0,
        },
      ]);

    if (error) {
      alert('Erro ao enviar reserva: ' + error.message);
    } else {
      setIsSuccess(true);
    }
    setIsSubmitting(false);
  };

  const renderStepHeader = (stepNum: number, Icon: any, title: string, value: string | undefined | null) => {
    const isActive = activeStep === stepNum;
    const isCompleted = activeStep > stepNum;
    
    return (
      <div 
        className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${isActive ? 'bg-[#F5F2ED]' : 'hover:bg-[#F5F2ED]/50'}`}
        onClick={() => setActiveStep(stepNum)}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full flex items-center justify-center ${isActive ? 'bg-[#4A3728] text-white' : isCompleted ? 'bg-[#EBE3D5] text-[#4A3728]' : 'bg-[#EBE3D5]/50 text-[#4A3728]/50'}`}>
            <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
          </div>
          <div>
            <h3 className={`text-xs font-bold uppercase tracking-wider ${isActive ? 'text-[#4A3728]' : 'text-[#4A3728]/70'}`}>{title}</h3>
            {value && !isActive && <p className="text-[10px] text-[#4A3728]/80 mt-0.5 tracking-wide">{value}</p>}
          </div>
        </div>
        <div>
          {isCompleted && !isActive ? (
            <CheckCircle2 className="text-[#4A3728]/80" size={18} />
          ) : (
            <ChevronDown className={`text-[#4A3728]/50 transition-transform ${isActive ? 'rotate-180' : ''}`} size={18} />
          )}
        </div>
      </div>
    );
  };

  const getConfirmationText = () => {
    if (guests && guests >= 15) return "Pagar R$100 e Reservar";
    return "Confirmar Reserva";
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#EBE3D5] flex items-center justify-center p-4 font-sans text-[#4A3728]">
        <div className="w-full max-w-[420px] bg-[#FDFBF7] rounded-[32px] shadow-2xl overflow-hidden border border-[#D9CFC1] p-12 text-center">
          <div className="bg-green-100 text-green-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} />
          </div>
          <h1 className="text-2xl font-serif font-bold mb-2">Reserva Solicitada!</h1>
          <p className="text-sm opacity-70 mb-8">Recebemos seu pedido. Você receberá uma confirmação via WhatsApp em breve.</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-4 bg-[#4A3728] text-white rounded-2xl font-bold uppercase tracking-wider text-xs"
          >
            Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EBE3D5] flex flex-col items-center justify-start py-6 px-4 font-sans text-[#4A3728] overflow-x-hidden">
      <div className="w-full max-w-[420px] bg-[#FDFBF7] rounded-[32px] shadow-2xl overflow-hidden border border-[#D9CFC1] flex flex-col shrink-0">
        
        {/* Header */}
        <div className="bg-[#4A3728] text-white p-5 pt-8 text-center">
          <h1 className="text-xl sm:text-2xl font-serif tracking-[2px] sm:tracking-[4px] uppercase leading-tight">Duna Cozinha & Bar</h1>
        </div>

        {/* Accordion Container */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#D9CFC1]">
          
          {/* Step 1: Date */}
          <div className="bg-[#FDFBF7]">
            {renderStepHeader(1, Calendar, "Qual a data?", date ? dates.find(d => d.value === date)?.label : '')}
            {activeStep === 1 && (
              <div className="p-4 pt-0 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="space-y-2">
                  {dates.map((d) => (
                    <button
                      key={d.value}
                      disabled={!d.available}
                      onClick={() => { setDate(d.value); handleNext(1); }}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                        !d.available 
                          ? 'border-[#D9CFC1] opacity-40 cursor-not-allowed' 
                          : date === d.value 
                            ? 'border-[#4A3728] bg-[#4A3728] text-white' 
                            : 'border-[#D9CFC1] hover:bg-[#F5F2ED] text-[#4A3728]'
                      }`}
                    >
                      <span className="text-sm font-bold uppercase tracking-wide">{d.label}</span>
                      {!d.available && <span className="text-[9px] uppercase tracking-wider bg-[#D9CFC1]/30 px-2 py-1 rounded text-[#4A3728]">Esgotado</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Step 2: People */}
          <div className="bg-[#FDFBF7]">
            {renderStepHeader(2, Users, "Quantas pessoas?", guests ? `${guests} pessoa${guests > 1 ? 's' : ''}` : '')}
            {activeStep === 2 && (
              <div className="p-5 pt-0 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="grid grid-cols-5 gap-2 mb-4">
                  {guestOptions.map((num) => (
                    <button
                      key={num}
                      onClick={() => setGuests(num)}
                      className={`py-2 rounded-lg text-xs font-medium border transition-all ${
                        guests === num
                          ? 'border-[#4A3728] bg-[#4A3728] text-white'
                          : 'border-[#D9CFC1] text-[#4A3728] hover:bg-[#F5F2ED]'
                      }`}
                    >
                      {num}
                      {num === 20 && '+'}
                    </button>
                  ))}
                </div>

                {guests && guests >= 15 && (
                  <div className="mt-3 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 animate-in fade-in zoom-in duration-300">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] leading-relaxed text-amber-800">
                      <strong>Reserva de Grupo:</strong> Acima de 15 pessoas requer pagamento de R$ 100,00 (100% revertido em consumação).
                    </p>
                  </div>
                )}

                <button 
                  disabled={!guests}
                  onClick={() => handleNext(2)}
                  className="w-full bg-[#4A3728] text-white rounded-xl py-3 text-xs font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#3d2d21] transition-colors"
                >
                  Continuar
                </button>
              </div>
            )}
          </div>

          {/* Step 3: Time */}
          <div className="bg-[#FDFBF7]">
            {renderStepHeader(3, Clock, "Qual o horário?", time)}
            {activeStep === 3 && (
              <div className="p-5 pt-0 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {times.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTime(t)}
                      className={`py-3 rounded-xl border text-sm font-medium transition-all ${
                        time === t
                          ? 'border-[#4A3728] bg-[#4A3728] text-white'
                          : 'border-[#D9CFC1] text-[#4A3728] hover:bg-[#F5F2ED]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <button 
                  disabled={!time}
                  onClick={() => handleNext(3)}
                  className="w-full bg-[#4A3728] text-white rounded-xl py-3 text-xs font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#3d2d21] transition-colors"
                >
                  Continuar
                </button>
              </div>
            )}
          </div>

          {/* Step 4: Notes */}
          <div className="bg-[#FDFBF7]">
            {renderStepHeader(4, MessageSquare, "Alguma observação?", notes ? 'Adicionada' : 'Nenhuma')}
            {activeStep === 4 && (
              <div className="p-5 pt-0 animate-in fade-in slide-in-from-top-2 duration-300">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Aniversário, cadeira de rodas, alguma alergia grave..."
                  className="w-full px-4 py-3 bg-white border border-[#D9CFC1] rounded-xl text-base focus:ring-1 focus:ring-[#4A3728] focus:border-[#4A3728] outline-none resize-none h-24 mb-4 placeholder:text-[#4A3728]/50 text-[#4A3728]"
                ></textarea>
                <button 
                  onClick={() => handleNext(4)}
                  className="w-full bg-[#4A3728] text-white rounded-xl py-3 text-xs font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#3d2d21] transition-colors"
                >
                  Continuar
                </button>
              </div>
            )}
          </div>

          {/* Step 5: User Data */}
          <div className="bg-[#FDFBF7]">
            {renderStepHeader(5, User, "Seus dados", formData.name)}
            {activeStep === 5 && (
              <div className="p-5 pt-0 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="space-y-3 mb-6">
                  <div>
                    <input
                      type="text"
                      className={`w-full px-4 py-3 bg-white border rounded-xl text-base focus:ring-1 outline-none placeholder:text-[#4A3728]/50 text-[#4A3728] ${
                        formErrors.name ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-[#D9CFC1] focus:ring-[#4A3728] focus:border-[#4A3728]'
                      }`}
                      value={formData.name}
                      onChange={(e) => {
                        setFormData({...formData, name: e.target.value});
                        if (formErrors.name) setFormErrors({...formErrors, name: ''});
                      }}
                      placeholder="Nome completo"
                    />
                    {formErrors.name && <p className="text-red-500 text-[10px] mt-1 ml-1">{formErrors.name}</p>}
                  </div>
                  <div>
                    <input
                      type="email"
                      className={`w-full px-4 py-3 bg-white border rounded-xl text-base focus:ring-1 outline-none placeholder:text-[#4A3728]/50 text-[#4A3728] ${
                        formErrors.email ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-[#D9CFC1] focus:ring-[#4A3728] focus:border-[#4A3728]'
                      }`}
                      value={formData.email}
                      onChange={(e) => {
                        setFormData({...formData, email: e.target.value});
                        if (formErrors.email) setFormErrors({...formErrors, email: ''});
                      }}
                      placeholder="E-mail: joao@email.com"
                    />
                    {formErrors.email && <p className="text-red-500 text-[10px] mt-1 ml-1">{formErrors.email}</p>}
                  </div>
                  <div>
                    <input
                      type="tel"
                      className={`w-full px-4 py-3 bg-white border rounded-xl text-base focus:ring-1 outline-none placeholder:text-[#4A3728]/50 text-[#4A3728] ${
                        formErrors.whatsapp ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-[#D9CFC1] focus:ring-[#4A3728] focus:border-[#4A3728]'
                      }`}
                      value={formData.whatsapp}
                      onChange={(e) => {
                        setFormData({...formData, whatsapp: e.target.value});
                        if (formErrors.whatsapp) setFormErrors({...formErrors, whatsapp: ''});
                      }}
                      placeholder="WhatsApp: (11) 99999-9999"
                    />
                    {formErrors.whatsapp && <p className="text-red-500 text-[10px] mt-1 ml-1">{formErrors.whatsapp}</p>}
                  </div>
                </div>
                <button 
                  onClick={() => {
                    if (validateForm()) {
                      handleNext(5);
                    }
                  }}
                  className="w-full bg-[#4A3728] text-white rounded-xl py-3 text-xs font-bold uppercase tracking-wider hover:bg-[#3d2d21] transition-colors"
                >
                  Finalizar
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Step 6: Confirmation Footer */}
        {activeStep === 6 && (
            <div className="p-6 pt-5 bg-[#FDFBF7] border-t border-[#D9CFC1] animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex flex-col gap-2 text-[11px] text-[#4A3728] mb-6 bg-white p-4 rounded-xl border border-[#D9CFC1] shadow-sm">
                <p><strong>Data:</strong> {dates.find(d => d.value === date)?.label}</p>
                <p><strong>Horário:</strong> {time}</p>
                <p><strong>Pessoas:</strong> {guests} pessoa{guests !== 1 ? 's' : ''}</p>
                <p><strong>Em nome de:</strong> {formData.name}</p>
                {notes && <p><strong>Observações:</strong> {notes}</p>}
              </div>
              <button 
                disabled={isSubmitting}
                className="w-full py-4 bg-[#4A3728] text-white rounded-2xl font-bold uppercase tracking-[2px] text-xs shadow-xl hover:bg-[#3d2d21] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                onClick={handleSubmit}
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : getConfirmationText()}
                {!isSubmitting && <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>}
              </button>
              <p className="text-center text-[9px] mt-4 opacity-50 uppercase tracking-widest text-[#4A3728]">
                Duna Cozinha & Bar © 2024 • Política de Cancelamento
              </p>
            </div>
        )}

      </div>

      {/* Footer Info */}
      <div className="mt-12 w-full max-w-[400px] flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
        <a 
          href="https://maps.app.goo.gl/2zmtd2zZ4wrSxxCT7" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-start gap-4 p-5 bg-white/50 backdrop-blur-sm rounded-2xl border border-[#D9CFC1] hover:bg-white/80 transition-all group"
        >
          <div className="w-10 h-10 flex items-center justify-center bg-[#4A3728] text-white rounded-xl shadow-lg group-hover:scale-110 transition-transform">
            <MapPin size={20} />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A3728]/60 mb-1">Localização</p>
            <p className="text-xs font-medium leading-relaxed">
              Av. Pinheiro Machado, 1356 - São Cristóvão, Porto Velho - RO, 76820-838
            </p>
          </div>
        </a>

        <a 
          href="https://wa.me/5569992564637" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-4 p-5 bg-white/50 backdrop-blur-sm rounded-2xl border border-[#D9CFC1] hover:bg-white/80 transition-all group"
        >
          <div className="w-10 h-10 flex items-center justify-center bg-[#25D366] text-white rounded-xl shadow-lg group-hover:scale-110 transition-transform">
            <MessageCircle size={20} />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A3728]/60 mb-1">WhatsApp</p>
            <p className="text-sm font-bold tracking-tight">(69) 9 9256-4637</p>
          </div>
        </a>

        <a 
          href="https://www.instagram.com/dunacozinhabar/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-4 p-5 bg-white/50 backdrop-blur-sm rounded-2xl border border-[#D9CFC1] hover:bg-white/80 transition-all group"
        >
          <div className="w-10 h-10 flex items-center justify-center bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white rounded-xl shadow-lg group-hover:scale-110 transition-transform">
            <Instagram size={20} />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A3728]/60 mb-1">Instagram</p>
            <p className="text-sm font-bold tracking-tight">@dunacozinhabar</p>
          </div>
        </a>
        
        <p className="text-center text-[10px] opacity-40 uppercase tracking-[4px] mt-4 mb-8">
          Experiência Gastronômica • Porto Velho
        </p>
      </div>
    </div>
  );
}
