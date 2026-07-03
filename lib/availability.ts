import type { Appointment, AvailabilitySlot, GoogleAvailability, TimeBlock, WorkingHour } from "./types";

type Input = {
  participantIds: string[];
  durationMinutes: number;
  rangeStart: string;
  rangeEnd: string;
  workdayStart: string;
  workdayEnd: string;
  appointments: Appointment[];
  workingHours: WorkingHour[];
  blocks: TimeBlock[];
  googleAvailability?: GoogleAvailability;
  stepMinutes?: number;
};

const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60_000);
const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) => aStart < bEnd && aEnd > bStart;
const timeParts = (value: string) => value.split(":").map(Number) as [number, number];

const withTime = (date: Date, time: string) => {
  const [hours, minutes] = timeParts(time);
  const next = new Date(date);
  next.setHours(hours, minutes, 0, 0);
  return next;
};

const isInsideWorkingHours = (userId: string, start: Date, end: Date, hours: WorkingHour[], fallbackStart: string, fallbackEnd: string) => {
  const day = start.getDay();
  const rule = hours.find((item) => item.user_id === userId && item.day_of_week === day && item.is_active);
  const startBoundary = withTime(start, rule?.start_time || fallbackStart);
  const endBoundary = withTime(start, rule?.end_time || fallbackEnd);
  return start >= startBoundary && end <= endBoundary;
};

const userIsBusyAgenda = (userId: string, start: Date, end: Date, appointments: Appointment[], blocks: TimeBlock[]) => {
  const busyAppointments = appointments.filter((appointment) => {
    if (appointment.status === "cancelada" || appointment.status === "realizada") return false;
    return appointment.responsible_user_id === userId || appointment.participant_ids.includes(userId);
  });

  const busyBlocks = blocks.filter((block) => block.user_id === userId && block.source === "internal");

  return busyAppointments.some((appointment) => overlaps(start, end, new Date(appointment.start_at), new Date(appointment.end_at))) ||
    busyBlocks.some((block) => overlaps(start, end, new Date(block.start_at), new Date(block.end_at)));
};

const userIsBusyGoogle = (userId: string, start: Date, end: Date, googleAvailability?: GoogleAvailability) =>
  Boolean(googleAvailability?.[userId]?.busy.some((item) => overlaps(start, end, new Date(item.start), new Date(item.end))));

export function findAvailableSlots(input: Input): AvailabilitySlot[] {
  const step = input.stepMinutes || 30;
  const rangeStart = new Date(input.rangeStart);
  const rangeEnd = new Date(input.rangeEnd);
  const results: AvailabilitySlot[] = [];

  for (let cursor = new Date(rangeStart); cursor < rangeEnd; cursor = addMinutes(cursor, step)) {
    const slotStart = withTime(cursor, input.workdayStart);
    const dayEnd = withTime(cursor, input.workdayEnd);

    for (let slot = new Date(slotStart); addMinutes(slot, input.durationMinutes) <= dayEnd; slot = addMinutes(slot, step)) {
      if (slot < rangeStart || slot >= rangeEnd) continue;
      const slotEnd = addMinutes(slot, input.durationMinutes);
      const participants: AvailabilitySlot["participants"] = {};

      for (const userId of input.participantIds) {
        const inHours = isInsideWorkingHours(userId, slot, slotEnd, input.workingHours, input.workdayStart, input.workdayEnd);
        if (!inHours) {
          participants[userId] = "Fuera de horario laboral";
          continue;
        }

        if (userIsBusyAgenda(userId, slot, slotEnd, input.appointments, input.blocks)) {
          participants[userId] = "Ocupado por Agenda SM";
          continue;
        }

        const google = input.googleAvailability?.[userId];
        if (google && userIsBusyGoogle(userId, slot, slotEnd, input.googleAvailability)) {
          participants[userId] = "Ocupado por Google Calendar";
          continue;
        }

        participants[userId] = google?.connected === false ? "Google Calendar no conectado" : "Libre";
      }

      const result = Object.values(participants).every((value) => value === "Libre" || value === "Google Calendar no conectado") ? "Disponible" : "No disponible";
      results.push({ start: slot.toISOString(), end: slotEnd.toISOString(), result, participants });
    }

    cursor.setHours(23, 59, 59, 999);
  }

  return results.sort((a, b) => Number(b.result === "Disponible") - Number(a.result === "Disponible") || a.start.localeCompare(b.start));
}
