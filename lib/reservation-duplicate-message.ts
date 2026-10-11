export type DuplicateReservationChoice = 'add_to_existing' | 'create_another';

export function buildDuplicateReservationMessage(input: {
  choice: DuplicateReservationChoice;
  name: string;
  date: string;
  time: string;
  guests: number;
  existingTime: string;
  existingGuests: number;
}) {
  const dateParts = input.date.split('-').map(Number);
  const displayDate = dateParts.length === 3
    ? `${String(dateParts[2]).padStart(2, '0')}/${String(dateParts[1]).padStart(2, '0')}/${dateParts[0]}`
    : input.date;

  if (input.choice === 'add_to_existing') {
    return `Olá! Meu nome é ${input.name}. Tenho uma reserva para ${displayDate} às ${input.existingTime}, para ${input.existingGuests} pessoas, e gostaria de acrescentar mais ${input.guests} pessoas à mesma reserva. Poderiam verificar, por favor?`;
  }

  return `Olá! Meu nome é ${input.name}. Já tenho uma reserva para ${displayDate} às ${input.existingTime}, para ${input.existingGuests} pessoas, mas gostaria de fazer outra reserva separada para ${displayDate} às ${input.time}, para ${input.guests} pessoas. Poderiam verificar, por favor?`;
}
