import type { Appointment, Client, Contact, NotificationItem, Profile, Project, TimeBlock, WorkingHour } from "./types";

const today = new Date();
const isoDate = (hour: number, minute = 0, offsetDays = 0) => {
  const value = new Date(today);
  value.setDate(today.getDate() + offsetDays);
  value.setHours(hour, minute, 0, 0);
  return value.toISOString();
};

export const demoProfiles: Profile[] = [
  { id: "u-pako", full_name: "Pako Studio", primary_email: "pako@smsoluciones.com", role: "admin", color: "#104080", active: true },
  { id: "u-billy", full_name: "Billy", primary_email: "billy@smsoluciones.com", role: "member", color: "#30A0E0", active: true },
  { id: "u-juan", full_name: "Juan", primary_email: "juan@smsoluciones.com", role: "member", color: "#0F9D58", active: true },
  { id: "u-admin", full_name: "Administracion", primary_email: "admin@smsoluciones.com", role: "member", color: "#6D5BD0", active: true },
  { id: "u-lectura", full_name: "Lectura", primary_email: "lectura@smsoluciones.com", role: "viewer", color: "#4B5563", active: true }
];

export const demoClients: Client[] = [
  { id: "c-1", name: "Cliente Norte", status: "activo", notes: "Proyecto de optimizacion operativa." },
  { id: "c-2", name: "Grupo Centro", status: "activo", notes: "Seguimientos comerciales y entregables." }
];

export const demoProjects: Project[] = [
  { id: "p-1", client_id: "c-1", name: "Diagnostico base", status: "activo" },
  { id: "p-2", client_id: "c-2", name: "Control 360", status: "activo" }
];

export const demoContacts: Contact[] = [
  { id: "ct-1", client_id: "c-1", name: "Laura Martinez", email: "laura@example.com", phone: "555-0101", position: "Direccion" },
  { id: "ct-2", client_id: "c-2", name: "Carlos Ruiz", email: "carlos@example.com", phone: "555-0202", position: "Operaciones" }
];

export const demoAppointments: Appointment[] = [
  {
    id: "a-1",
    title: "Revision diagnostico Cliente Norte",
    client_id: "c-1",
    project_id: "p-1",
    contact_id: "ct-1",
    responsible_user_id: "u-pako",
    participant_ids: ["u-pako", "u-billy"],
    start_at: isoDate(10),
    end_at: isoDate(11),
    duration_minutes: 60,
    type: "junta",
    modality: "videollamada",
    location_or_link: "https://meet.google.com/demo",
    status: "confirmada",
    notes: "Validar avances y acuerdos.",
    next_action: "Enviar minuta",
    next_action_due_at: isoDate(17)
  },
  {
    id: "a-2",
    title: "Seguimiento cobranza Grupo Centro",
    client_id: "c-2",
    project_id: "p-2",
    contact_id: "ct-2",
    responsible_user_id: "u-juan",
    participant_ids: ["u-juan"],
    start_at: isoDate(13, 30),
    end_at: isoDate(14),
    duration_minutes: 30,
    type: "cobranza",
    modality: "llamada",
    status: "pendiente",
    notes: "Confirmar fecha de pago.",
    next_action: "Actualizar seguimiento",
    next_action_due_at: isoDate(12, 0, -1)
  },
  {
    id: "a-3",
    title: "Entrega tablero operativo",
    client_id: "c-2",
    project_id: "p-2",
    contact_id: "ct-2",
    responsible_user_id: "u-billy",
    participant_ids: ["u-billy", "u-admin"],
    start_at: isoDate(9, 30, 1),
    end_at: isoDate(10, 30, 1),
    duration_minutes: 60,
    type: "entrega",
    modality: "presencial",
    location_or_link: "Oficina cliente",
    status: "confirmada",
    notes: "Llevar checklist impreso."
  }
];

export const demoWorkingHours: WorkingHour[] = demoProfiles.flatMap((profile) =>
  [1, 2, 3, 4, 5].map((day) => ({
    id: `wh-${profile.id}-${day}`,
    user_id: profile.id,
    day_of_week: day,
    start_time: "09:00",
    end_time: "18:00",
    is_active: true
  }))
);

export const demoBlocks: TimeBlock[] = [
  { id: "b-1", user_id: "u-billy", title: "Bloqueo interno", start_at: isoDate(12), end_at: isoDate(13), source: "internal" },
  { id: "b-2", user_id: "u-pako", title: "Google ocupado", start_at: isoDate(15), end_at: isoDate(16), source: "google" }
];

export const demoNotifications: NotificationItem[] = [
  {
    id: "n-1",
    user_id: "u-pako",
    appointment_id: "a-1",
    type: "appointment_assigned",
    title: "Cita confirmada",
    message: "Revision diagnostico Cliente Norte hoy a las 10:00.",
    channel: "in_app",
    status: "pending",
    created_at: new Date().toISOString()
  }
];
