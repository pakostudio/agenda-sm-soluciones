export type Role = "admin" | "member" | "viewer";
export type AppointmentStatus = "pendiente" | "confirmada" | "realizada" | "cancelada" | "reagendada";
export type AppointmentType = "llamada" | "junta" | "visita" | "seguimiento" | "entrega" | "cobranza" | "otro";
export type AppointmentModality = "presencial" | "llamada" | "videollamada";

export type Profile = {
  id: string;
  full_name: string;
  primary_email: string;
  role: Role;
  avatar_url?: string | null;
  color: string;
  active: boolean;
  last_sign_in_at?: string | null;
  must_change_password?: boolean;
};

export type AdminUser = Profile & {
  secondary_emails: string[];
  pin_expires_at?: string | null;
  google_connected: boolean;
  working_hours: {
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_active: boolean;
  }[];
};

export type Client = {
  id: string;
  name: string;
  status: string;
  notes?: string | null;
};

export type Project = {
  id: string;
  client_id: string;
  name: string;
  status: string;
};

export type Contact = {
  id: string;
  client_id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  position?: string | null;
};

export type Appointment = {
  id: string;
  title: string;
  client_id?: string | null;
  project_id?: string | null;
  contact_id?: string | null;
  responsible_user_id: string;
  participant_ids: string[];
  start_at: string;
  end_at: string;
  duration_minutes: number;
  type: AppointmentType;
  modality: AppointmentModality;
  location_or_link?: string | null;
  status: AppointmentStatus;
  notes?: string | null;
  next_action?: string | null;
  next_action_due_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
};

export type WorkingHour = {
  id: string;
  user_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
};

export type TimeBlock = {
  id: string;
  user_id: string;
  title: string;
  start_at: string;
  end_at: string;
  source: "internal" | "google";
};

export type NotificationItem = {
  id: string;
  user_id: string;
  appointment_id?: string | null;
  type: string;
  title: string;
  message: string;
  channel: "in_app" | "email" | "whatsapp";
  status: "pending" | "sent" | "read" | "failed";
  read_at?: string | null;
  sent_at?: string | null;
  created_at: string;
};

export type AvailabilitySlot = {
  start: string;
  end: string;
  result: "Disponible" | "No disponible";
  participants: Record<string, "Libre" | "Ocupado" | "Sin horario">;
};
