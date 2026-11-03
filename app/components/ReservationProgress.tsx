import { Check } from 'lucide-react';

type ReservationStep = 'reservation' | 'details' | 'payment' | 'complete';

export default function ReservationProgress({ current, requiresPayment }: {
  current: ReservationStep;
  requiresPayment: boolean;
}) {
  const steps = [
    { id: 'reservation', label: 'Reserva' },
    { id: 'details', label: 'Seus dados' },
    ...(requiresPayment ? [{ id: 'payment', label: 'Pagamento' }] : []),
  ];
  const currentIndex = current === 'complete' ? steps.length : steps.findIndex((step) => step.id === current);

  return (
    <ol aria-label="Etapas da reserva" className={`mb-6 grid gap-2 text-[11px] sm:gap-3 sm:text-sm ${requiresPayment ? 'grid-cols-3' : 'grid-cols-2'}`}>
      {steps.map((step, index) => (
        <li key={step.id} aria-current={index === currentIndex ? 'step' : undefined}
          className={`border-t-4 pt-3 ${index === currentIndex ? 'border-[#a56818]' : index < currentIndex ? 'border-[#4a3728]' : 'border-[#d9cfc1] text-[#76695e]'}`}>
          <span className="flex flex-wrap items-center gap-1 font-semibold">
            {index < currentIndex ? <Check size={14} className="shrink-0" /> : <span>{index + 1}.</span>}
            {step.label}
            {index < currentIndex && <span className="sr-only"> — etapa concluída</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
