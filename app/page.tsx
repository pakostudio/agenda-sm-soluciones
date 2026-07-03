"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock,
  LayoutDashboard,
  LogOut,
  Plus,
  Search,
  Shield,
  Settings,
  Users,
  XCircle
} from "lucide-react";
import { findAvailableSlots } from "@/lib/availability";
import {
  demoAppointments,
  demoBlocks,
  demoClients,
  demoContacts,
  demoNotifications,
  demoProfiles,
  demoProjects,
  demoWorkingHours
} from "@/lib/demo-data";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Appointment, AppointmentModality, AppointmentStatus, AppointmentType, AvailabilitySlot, Client, Contact, GoogleAvailability, Profile, Project, WorkingHour } from "@/lib/types";

type View = "dashboard" | "calendar" | "agenda" | "availability" | "clients" | "notifications" | "settings";

const navItems: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Inicio", icon: LayoutDashboard },
  { id: "calendar", label: "Calendario", icon: CalendarDays },
  { id: "availability", label: "Buscar horario", icon: Search },
  { id: "clients", label: "Clientes", icon: Users },
  { id: "settings", label: "Config", icon: Settings }
];

const fmtDateTime = (value: string) =>
  new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City"
  }).format(new Date(value));

const toInputDateTime = (value: string) => {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const todayKey = () => new Date().toISOString().slice(0, 10);

const blankAppointment = (userId: string): Appointment => {
  const start = new Date();
  start.setHours(start.getHours() + 1, 0, 0, 0);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + 60);

  return {
    id: `local-${crypto.randomUUID()}`,
    title: "",
    client_id: null,
    project_id: null,
    contact_id: null,
    responsible_user_id: userId,
    participant_ids: [userId],
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    duration_minutes: 60,
    type: "junta",
    modality: "videollamada",
    location_or_link: "",
    status: "pendiente",
    notes: "",
    next_action: "",
    next_action_due_at: ""
  };
};

export default function AgendaSMApp() {
  const [sessionEmail, setSessionEmail] = useState("");
  const [pin, setPin] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeUser, setActiveUser] = useState<Profile>(demoProfiles[0]);
  const [profiles, setProfiles] = useState<Profile[]>(isSupabaseConfigured ? [] : demoProfiles);
  const [workingHours, setWorkingHours] = useState<WorkingHour[]>(isSupabaseConfigured ? [] : demoWorkingHours);
  const [clients, setClients] = useState<Client[]>(isSupabaseConfigured ? [] : demoClients);
  const [projects, setProjects] = useState<Project[]>(isSupabaseConfigured ? [] : demoProjects);
  const [contacts, setContacts] = useState<Contact[]>(isSupabaseConfigured ? [] : demoContacts);
  const [view, setView] = useState<View>("dashboard");
  const [appointments, setAppointments] = useState<Appointment[]>(isSupabaseConfigured ? [] : demoAppointments);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [memberFilter, setMemberFilter] = useState("all");
  const [availabilityParticipants, setAvailabilityParticipants] = useState<string[]>(["u-pako", "u-billy"]);
  const [duration, setDuration] = useState(60);
  const [rangeStart, setRangeStart] = useState(`${todayKey()}T09:00`);
  const [rangeEnd, setRangeEnd] = useState(`${todayKey()}T18:00`);
  const [googleWarning, setGoogleWarning] = useState("");
  const [googleAvailability, setGoogleAvailability] = useState<GoogleAvailability>({});
  const [createMeet, setCreateMeet] = useState(false);

  const loadAppData = async (profile: Profile) => {
    if (!supabase) return;
    const [profileRows, appointmentRows, participantRows, hoursRows, clientRows, projectRows, contactRows] = await Promise.all([
      supabase.from("profiles").select("id, full_name, primary_email, role, color, active, last_sign_in_at, must_change_password").eq("active", true).order("full_name"),
      supabase.from("appointments").select("*").order("start_at", { ascending: true }),
      supabase.from("appointment_participants").select("appointment_id, user_id"),
      supabase.from("working_hours").select("id, user_id, day_of_week, start_time, end_time, is_active"),
      supabase.from("clients").select("id, name, status, notes").order("name"),
      supabase.from("projects").select("id, client_id, name, status").order("name"),
      supabase.from("contacts").select("id, client_id, name, email, phone, position").order("name")
    ]);

    const loadedProfiles = (profileRows.data as Profile[] | null) || [profile];
    const participantsByAppointment = new Map<string, string[]>();
    (participantRows.data || []).forEach((item) => {
      participantsByAppointment.set(item.appointment_id, [...(participantsByAppointment.get(item.appointment_id) || []), item.user_id]);
    });
    const loadedAppointments = (appointmentRows.data || []).map((item) => ({
      ...item,
      participant_ids: participantsByAppointment.get(item.id) || [item.responsible_user_id]
    })) as Appointment[];

    setProfiles(loadedProfiles);
    setWorkingHours((hoursRows.data as WorkingHour[] | null) || []);
    setAppointments(loadedAppointments);
    setClients((clientRows.data as Client[] | null) || []);
    setProjects((projectRows.data as Project[] | null) || []);
    setContacts((contactRows.data as Contact[] | null) || []);
    setAvailabilityParticipants((current) => current.filter((id) => loadedProfiles.some((item) => item.id === id)).length ? current.filter((id) => loadedProfiles.some((item) => item.id === id)) : [profile.id]);
  };

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    const restoreSession = async () => {
      const { data } = await client.auth.getSession();
      const session = data.session;
      const email = session?.user.email;
      if (email) {
        const { data: profile } = await client.from("profiles").select("id, full_name, primary_email, role, color, active, last_sign_in_at, must_change_password").eq("id", session.user.id).single();
        if (profile?.active === false) {
          await client.auth.signOut();
          return;
        }
        if (profile) {
          setActiveUser(profile as Profile);
          await loadAppData(profile as Profile);
        }
        setSessionEmail(email);
        setIsAuthenticated(true);
      }
    };
    restoreSession();
  }, []);

  const visibleAppointments = useMemo(() => {
    if (activeUser.role === "admin" && memberFilter === "all") return appointments;
    const userId = memberFilter === "all" ? activeUser.id : memberFilter;
    return appointments.filter((appointment) => appointment.responsible_user_id === userId || appointment.participant_ids.includes(userId));
  }, [activeUser, appointments, memberFilter]);

  const dashboard = useMemo(() => {
    const now = new Date();
    const today = todayKey();
    const active = visibleAppointments.filter((item) => item.status !== "cancelada");
    return {
      today: active.filter((item) => item.start_at.slice(0, 10) === today),
      upcoming: active.filter((item) => new Date(item.start_at) > now).slice(0, 6),
      pendingFollowups: active.filter((item) => item.next_action && item.next_action_due_at && new Date(item.next_action_due_at) >= now),
      overdue: active.filter((item) => item.status !== "realizada" && new Date(item.end_at) < now)
    };
  }, [visibleAppointments]);

  const availability = useMemo(
    () =>
      findAvailableSlots({
        participantIds: availabilityParticipants,
        durationMinutes: duration,
        rangeStart: new Date(rangeStart).toISOString(),
        rangeEnd: new Date(rangeEnd).toISOString(),
        workdayStart: "09:00",
        workdayEnd: "18:00",
        appointments,
        workingHours,
        blocks: isSupabaseConfigured ? [] : demoBlocks,
        googleAvailability,
        stepMinutes: 30
      }).slice(0, 24),
    [appointments, availabilityParticipants, duration, googleAvailability, rangeEnd, rangeStart, workingHours]
  );

  const login = async () => {
    if (isSupabaseConfigured && supabase && sessionEmail && pin) {
      const { data, error } = await supabase.auth.signInWithPassword({ email: sessionEmail, password: pin });
      if (error) alert("PIN incorrecto o usuario no registrado.");
      if (!error && data.user) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name, primary_email, role, color, active, last_sign_in_at, must_change_password")
          .eq("id", data.user.id)
          .single();
        if (profileError || !profile) {
          alert("No existe perfil activo para este usuario.");
          await supabase.auth.signOut();
          return;
        }
        if (!profile.active) {
          alert("Este usuario esta inactivo. Contacta al administrador.");
          await supabase.auth.signOut();
          return;
        }
        await supabase.from("profiles").update({ last_sign_in_at: new Date().toISOString() }).eq("id", data.user.id);
        setActiveUser(profile as Profile);
        await loadAppData(profile as Profile);
        setIsAuthenticated(true);
      }
      return;
    }

    const matched = demoProfiles.find((profile) => profile.primary_email.toLowerCase() === sessionEmail.toLowerCase()) || demoProfiles[0];
    setActiveUser(matched);
    setIsAuthenticated(true);
  };

  const saveAppointment = async (appointment: Appointment) => {
    const start = new Date(appointment.start_at);
    const end = new Date(appointment.end_at);
    if (!appointment.title.trim()) {
      alert("Agrega un titulo para la cita.");
      return;
    }
    if (end <= start) {
      alert("La hora fin debe ser posterior a la hora inicio.");
      return;
    }

    let normalized: Appointment = {
      ...appointment,
      duration_minutes: Math.round((end.getTime() - start.getTime()) / 60_000),
      updated_by: activeUser.id
    };

    if (isSupabaseConfigured && supabase) {
      const isNew = normalized.id.startsWith("local-");
      let meetData: { meet_url?: string | null; google_event_id?: string | null } = {};
      if (createMeet) {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (token) {
          const response = await fetch("/api/google/create-meet", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              responsible_user_id: normalized.responsible_user_id,
              title: normalized.title,
              start_at: normalized.start_at,
              end_at: normalized.end_at,
              notes: normalized.notes
            })
          });
          const payload = await response.json();
          if (response.ok) meetData = payload;
          else alert(payload.error || "La cita se creo, pero no se pudo generar Meet.");
        }
      }

      const dbPayload = {
        title: normalized.title,
        client_id: normalized.client_id || null,
        project_id: normalized.project_id || null,
        contact_id: normalized.contact_id || null,
        responsible_user_id: normalized.responsible_user_id,
        start_at: normalized.start_at,
        end_at: normalized.end_at,
        duration_minutes: normalized.duration_minutes,
        type: normalized.type,
        modality: normalized.modality,
        location_or_link: meetData.meet_url || normalized.location_or_link || null,
        meet_url: meetData.meet_url || normalized.meet_url || null,
        google_event_id: meetData.google_event_id || normalized.google_event_id || null,
        status: normalized.status,
        notes: normalized.notes || null,
        next_action: normalized.next_action || null,
        next_action_due_at: normalized.next_action_due_at || null,
        updated_by: activeUser.id,
        ...(isNew ? { created_by: activeUser.id } : {})
      };

      const result = isNew
        ? await supabase.from("appointments").insert(dbPayload).select("*").single()
        : await supabase.from("appointments").update(dbPayload).eq("id", normalized.id).select("*").single();
      if (result.error || !result.data) {
        alert(result.error?.message || "No se pudo guardar la cita.");
        return;
      }

      await supabase.from("appointment_participants").delete().eq("appointment_id", result.data.id);
      const participantIds = Array.from(new Set([normalized.responsible_user_id, ...normalized.participant_ids]));
      if (participantIds.length) {
        await supabase.from("appointment_participants").insert(participantIds.map((userId) => ({ appointment_id: result.data.id, user_id: userId })));
      }
      normalized = { ...(result.data as Appointment), participant_ids: participantIds, updated_by: activeUser.id };
    }

    setAppointments((current) => {
      const exists = current.some((item) => item.id === normalized.id);
      return exists ? current.map((item) => (item.id === normalized.id ? normalized : item)) : [normalized, ...current];
    });
    setCreateMeet(false);
    setIsModalOpen(false);
  };

  const changeStatus = (appointment: Appointment, status: AppointmentStatus) => {
    saveAppointment({ ...appointment, status, updated_by: activeUser.id });
  };

  const openNew = (slot?: AvailabilitySlot) => {
    const appointment = blankAppointment(activeUser.id);
    if (slot) {
      appointment.start_at = slot.start;
      appointment.end_at = slot.end;
      appointment.duration_minutes = duration;
      appointment.participant_ids = availabilityParticipants;
      appointment.responsible_user_id = availabilityParticipants[0] || activeUser.id;
    }
    setSelected(appointment);
    setIsModalOpen(true);
  };

  const testGoogleFreeBusy = async () => {
    setGoogleWarning("");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
    }
    const response = await fetch("/api/google/freebusy", {
      method: "POST",
      headers,
      body: JSON.stringify({ timeMin: new Date(rangeStart).toISOString(), timeMax: new Date(rangeEnd).toISOString(), userIds: availabilityParticipants })
    });
    const data = await response.json();
    if (data.users) setGoogleAvailability(data.users);
    setGoogleWarning(data.warning || (response.ok ? "Google Free/Busy consultado." : data.error || "No se pudo consultar Google Free/Busy."));
  };

  if (!isAuthenticated) {
    return (
      <main className="login-page">
        <section className="login-panel">
          <Image className="login-logo" src="/logo-sm-soluciones.png" width={420} height={220} alt="SM Soluciones" priority />
          <h1>Agenda SM</h1>
          <p className="muted">Agenda privada para citas, disponibilidad y seguimiento del equipo.</p>
          <div className="grid" style={{ marginTop: 22 }}>
            <div className="field">
              <label>Email</label>
              <input value={sessionEmail} onChange={(event) => setSessionEmail(event.target.value)} placeholder="pako@smsoluciones.com" />
            </div>
            <div className="field">
              <label>PIN individual</label>
              <input value={pin} onChange={(event) => setPin(event.target.value)} type="password" inputMode="numeric" placeholder="PIN" />
            </div>
            <button className="btn primary" onClick={login}>
              Entrar
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app">
      <aside className="sidebar">
        <div className="brand">
          <Image src="/logo-sm-soluciones.png" width={84} height={70} alt="SM Soluciones" />
          <span>Agenda SM</span>
        </div>
        <Nav view={view} setView={setView} />
        {activeUser.role === "admin" && (
          <a className="btn primary" href="/admin/users">
            <Shield size={16} /> Panel Admin
          </a>
        )}
        <div className="card" style={{ marginTop: "auto" }}>
          <strong>{activeUser.full_name}</strong>
          <p className="muted">{activeUser.role}</p>
          <button className="btn" onClick={async () => { await supabase?.auth.signOut(); setIsAuthenticated(false); }}>
            <LogOut size={16} /> Cerrar sesion
          </button>
        </div>
      </aside>

      <section className="main">
        <header className="topbar">
          <div>
            <h1>{titleFor(view)}</h1>
            <p>Zona horaria America/Mexico_City. Google Calendar se usa solo como Free/Busy.</p>
          </div>
          <div className="toolbar">
            <select value={memberFilter} onChange={(event) => setMemberFilter(event.target.value)}>
              <option value="all">Todos los miembros</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.full_name}
                </option>
              ))}
            </select>
            <button className="btn primary" onClick={() => openNew()}>
              <Plus size={18} /> Nueva cita
            </button>
          </div>
        </header>

        {view === "dashboard" && <Dashboard dashboard={dashboard} openAppointment={(item) => { setSelected(item); setIsModalOpen(true); }} />}
        {view === "calendar" && <CalendarView appointments={visibleAppointments} profiles={profiles} onSelect={(item) => { setSelected(item); setIsModalOpen(true); }} />}
        {view === "agenda" && <AgendaList appointments={visibleAppointments} onSelect={(item) => { setSelected(item); setIsModalOpen(true); }} />}
        {view === "availability" && (
          <AvailabilityView
            participantIds={availabilityParticipants}
            setParticipantIds={setAvailabilityParticipants}
            duration={duration}
            setDuration={setDuration}
            rangeStart={rangeStart}
            setRangeStart={setRangeStart}
            rangeEnd={rangeEnd}
            setRangeEnd={setRangeEnd}
            availability={availability}
            profiles={profiles}
            googleWarning={googleWarning}
            testGoogleFreeBusy={testGoogleFreeBusy}
            createFromSlot={openNew}
          />
        )}
        {view === "clients" && <ClientsView clients={clients} projects={projects} contacts={contacts} />}
        {view === "notifications" && <NotificationsView />}
        {view === "settings" && <SettingsView activeUser={activeUser} profiles={profiles} setActiveUser={setActiveUser} />}
      </section>

      <nav className="mobile-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}>
              <Icon size={20} />
              {item.label.replace("Buscar horario", "Horario")}
            </button>
          );
        })}
      </nav>

      {isModalOpen && selected && (
        <AppointmentModal
          appointment={selected}
          setAppointment={setSelected}
          saveAppointment={saveAppointment}
          changeStatus={changeStatus}
          profiles={profiles}
          clients={clients}
          projects={projects}
          contacts={contacts}
          createMeet={createMeet}
          setCreateMeet={setCreateMeet}
          close={() => setIsModalOpen(false)}
        />
      )}
    </main>
  );
}

function Nav({ view, setView }: { view: View; setView: (view: View) => void }) {
  return (
    <nav className="nav">
      {[...navItems.slice(0, 3), { id: "agenda" as View, label: "Mi agenda", icon: Clock }, { id: "notifications" as View, label: "Notificaciones", icon: Bell }, ...navItems.slice(3)].map((item) => {
        const Icon = item.icon;
        return (
          <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}>
            <Icon size={18} /> {item.label}
          </button>
        );
      })}
    </nav>
  );
}

function titleFor(view: View) {
  return {
    dashboard: "Dashboard",
    calendar: "Calendario general",
    agenda: "Mi agenda",
    availability: "Buscar horario disponible",
    clients: "Clientes y proyectos",
    notifications: "Notificaciones",
    settings: "Configuracion"
  }[view];
}

function Dashboard({ dashboard, openAppointment }: { dashboard: { today: Appointment[]; upcoming: Appointment[]; pendingFollowups: Appointment[]; overdue: Appointment[] }; openAppointment: (item: Appointment) => void }) {
  return (
    <div className="grid">
      <div className="grid cards">
        <Metric label="Citas de hoy" value={dashboard.today.length} />
        <Metric label="Proximas citas" value={dashboard.upcoming.length} />
        <Metric label="Seguimientos" value={dashboard.pendingFollowups.length} />
        <Metric label="Vencidas" value={dashboard.overdue.length} />
      </div>
      <div className="grid two">
        <AppointmentList title="Hoy y proximas" appointments={[...dashboard.today, ...dashboard.upcoming]} onSelect={openAppointment} />
        <AppointmentList title="Pendientes y vencidas" appointments={[...dashboard.pendingFollowups, ...dashboard.overdue]} onSelect={openAppointment} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <article className="card metric">
      <span className="muted">{label}</span>
      <strong>{value}</strong>
      <span className="badge">{value === 1 ? "registro" : "registros"}</span>
    </article>
  );
}

function CalendarView({ appointments, profiles, onSelect }: { appointments: Appointment[]; profiles: Profile[]; onSelect: (item: Appointment) => void }) {
  return (
    <section className="card">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek" }}
        locale="es"
        height="auto"
        nowIndicator
        editable={false}
        selectable
        events={appointments.map((item) => ({
          id: item.id,
          title: item.title,
          start: item.start_at,
          end: item.end_at,
          backgroundColor: profiles.find((profile) => profile.id === item.responsible_user_id)?.color || "#104080",
          borderColor: "transparent"
        }))}
        eventClick={(info) => {
          const item = appointments.find((appointment) => appointment.id === info.event.id);
          if (item) onSelect(item);
        }}
      />
    </section>
  );
}

function AgendaList({ appointments, onSelect }: { appointments: Appointment[]; onSelect: (item: Appointment) => void }) {
  return <AppointmentList title="Citas visibles" appointments={appointments} onSelect={onSelect} />;
}

function AppointmentList({ title, appointments, onSelect }: { title: string; appointments: Appointment[]; onSelect: (item: Appointment) => void }) {
  return (
    <section className="card">
      <div className="section-title">
        <h2>{title}</h2>
        <span className="badge">{appointments.length}</span>
      </div>
      <div className="list">
        {appointments.length === 0 && <p className="muted">No hay citas para mostrar.</p>}
        {appointments.map((appointment) => (
          <button className="item" key={appointment.id} onClick={() => onSelect(appointment)}>
            <h3>{appointment.title}</h3>
            <p className="muted">{fmtDateTime(appointment.start_at)} - {fmtDateTime(appointment.end_at)}</p>
            <span className={`badge ${appointment.status}`}>{appointment.status}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function AvailabilityView(props: {
  participantIds: string[];
  setParticipantIds: (ids: string[]) => void;
  duration: number;
  setDuration: (value: number) => void;
  rangeStart: string;
  setRangeStart: (value: string) => void;
  rangeEnd: string;
  setRangeEnd: (value: string) => void;
  availability: AvailabilitySlot[];
  profiles: Profile[];
  googleWarning: string;
  testGoogleFreeBusy: () => void;
  createFromSlot: (slot: AvailabilitySlot) => void;
}) {
  const best = props.availability.find((slot) => slot.result === "Disponible");
  return (
    <div className="grid">
      <section className="card">
        <div className="form-grid">
          <div className="field">
            <label>Participantes internos</label>
            <select multiple value={props.participantIds} onChange={(event) => props.setParticipantIds(Array.from(event.target.selectedOptions).map((option) => option.value))}>
              {props.profiles.filter((profile) => profile.active).map((profile) => (
                <option key={profile.id} value={profile.id}>{profile.full_name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Duracion</label>
            <select value={props.duration} onChange={(event) => props.setDuration(Number(event.target.value))}>
              {[15, 30, 45, 60, 90, 120].map((value) => <option key={value} value={value}>{value} min</option>)}
            </select>
          </div>
          <div className="field">
            <label>Desde</label>
            <input type="datetime-local" value={props.rangeStart} onChange={(event) => props.setRangeStart(event.target.value)} />
          </div>
          <div className="field">
            <label>Hasta</label>
            <input type="datetime-local" value={props.rangeEnd} onChange={(event) => props.setRangeEnd(event.target.value)} />
          </div>
        </div>
        <div className="toolbar" style={{ marginTop: 14 }}>
          <button className="btn" onClick={props.testGoogleFreeBusy}>Probar Free/Busy</button>
          {props.googleWarning && <span className="badge">{props.googleWarning}</span>}
        </div>
      </section>

      <div className="grid cards">
        <article className="card metric">
          <span className="muted">Mejor horario</span>
          <strong style={{ fontSize: 18 }}>{best ? fmtDateTime(best.start) : "Sin opcion"}</strong>
        </article>
        <Metric label="Alternativas" value={props.availability.filter((slot) => slot.result === "Disponible").length} />
        <Metric label="Conflictos" value={props.availability.filter((slot) => slot.result === "No disponible").length} />
        <article className="card metric">
          <span className="muted">Fuente</span>
          <strong style={{ fontSize: 18 }}>Agenda SM + Free/Busy</strong>
        </article>
      </div>

      <section className="card table-scroll">
        <table className="availability-table">
          <thead>
            <tr>
              <th>Hora</th>
              {props.participantIds.map((id) => <th key={id}>{props.profiles.find((profile) => profile.id === id)?.full_name}</th>)}
              <th>Resultado</th>
              <th>Accion</th>
            </tr>
          </thead>
          <tbody>
            {props.availability.map((slot) => (
              <tr key={`${slot.start}-${slot.end}`}>
                <td>{fmtDateTime(slot.start)}</td>
                {props.participantIds.map((id) => <td key={id}>{slot.participants[id]}</td>)}
                <td><span className={`badge ${slot.result.replace(" ", "-")}`}>{slot.result}</span></td>
                <td><button className="btn" disabled={slot.result !== "Disponible"} onClick={() => props.createFromSlot(slot)}>Crear cita</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function ClientsView({ clients, projects, contacts }: { clients: Client[]; projects: Project[]; contacts: Contact[] }) {
  return (
    <div className="grid two">
      <EntityList title="Clientes" rows={clients.length ? clients.map((item) => `${item.name} - ${item.status}`) : ["Sin clientes registrados"]} />
      <EntityList title="Proyectos y contactos" rows={projects.length || contacts.length ? [...projects.map((item) => item.name), ...contacts.map((item) => `${item.name} / ${item.email || "sin email"}`)] : ["Sin proyectos ni contactos registrados"]} />
    </div>
  );
}

function EntityList({ title, rows }: { title: string; rows: string[] }) {
  return (
    <section className="card">
      <div className="section-title"><h2>{title}</h2><button className="btn"><Plus size={16} /> Nuevo</button></div>
      <div className="list">{rows.map((row) => <div className="item" key={row}>{row}</div>)}</div>
    </section>
  );
}

function NotificationsView() {
  return (
    <section className="card">
      <div className="section-title"><h2>Panel de notificaciones</h2><span className="badge">{demoNotifications.length}</span></div>
      <div className="list">
        {demoNotifications.map((item) => (
          <div className="item" key={item.id}>
            <h3>{item.title}</h3>
            <p className="muted">{item.message}</p>
            <span className="badge">{item.channel}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function SettingsView({ activeUser, profiles, setActiveUser }: { activeUser: Profile; profiles: Profile[]; setActiveUser: (profile: Profile) => void }) {
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleMessage, setGoogleMessage] = useState("");

  useEffect(() => {
    const loadStatus = async () => {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const response = await fetch("/api/google/status", { headers: { Authorization: `Bearer ${token}` } });
      const status = await response.json();
      setGoogleConnected(Boolean(status.connected));
    };
    loadStatus();
  }, []);

  const connectGoogle = async () => {
    setGoogleMessage("");
    if (!supabase) {
      setGoogleMessage("Supabase no configurado.");
      return;
    }
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setGoogleMessage("Sesion requerida.");
      return;
    }
    const response = await fetch("/api/google/connect", { headers: { Authorization: `Bearer ${token}` } });
    const payload = await response.json();
    if (!response.ok) {
      setGoogleMessage(payload.error || "Google Calendar no configurado.");
      return;
    }
    window.location.href = payload.authUrl;
  };

  return (
    <div className="grid two">
      <section className="card">
        <div className="section-title"><h2>Miembros y roles</h2></div>
        <div className="list">
          {profiles.map((profile) => (
            <button className="item" key={profile.id} onClick={() => setActiveUser(profile)}>
              <h3>{profile.full_name}</h3>
              <p className="muted">{profile.primary_email}</p>
              <span className="badge">{profile.role}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="card">
        <div className="section-title"><h2>Preferencias</h2></div>
        <div className="form-grid">
          <div className="field"><label>Usuario activo</label><input value={activeUser.full_name} readOnly /></div>
          <div className="field"><label>Rol</label><input value={activeUser.role} readOnly /></div>
          <div className="field"><label>Horario laboral</label><input value="09:00 - 18:00" readOnly /></div>
          <div className="field"><label>Correo secundario</label><input placeholder="correo@empresa.com" /></div>
          <label><input type="checkbox" defaultChecked /> Notificaciones in-app</label>
          <label><input type="checkbox" defaultChecked /> Email con Resend</label>
          <label><input type="checkbox" /> WhatsApp preparado para futuro</label>
          <label><input type="checkbox" checked={googleConnected} readOnly /> Google Calendar Free/Busy activo</label>
          <button className="btn primary" onClick={connectGoogle}>Conectar Google Calendar</button>
          {googleMessage && <p className="muted">{googleMessage}</p>}
        </div>
      </section>
    </div>
  );
}

function AppointmentModal({ appointment, setAppointment, saveAppointment, changeStatus, profiles, clients, projects, contacts, createMeet, setCreateMeet, close }: {
  appointment: Appointment;
  setAppointment: (appointment: Appointment) => void;
  saveAppointment: (appointment: Appointment) => void;
  changeStatus: (appointment: Appointment, status: AppointmentStatus) => void;
  profiles: Profile[];
  clients: Client[];
  projects: Project[];
  contacts: Contact[];
  createMeet: boolean;
  setCreateMeet: (value: boolean) => void;
  close: () => void;
}) {
  const update = <K extends keyof Appointment>(key: K, value: Appointment[K]) => setAppointment({ ...appointment, [key]: value });

  return (
    <div className="modal-backdrop">
      <section className="modal">
        <div className="section-title">
          <h2>{appointment.title || "Nueva cita"}</h2>
          <button className="btn" onClick={close}>Cerrar</button>
        </div>
        <div className="form-grid">
          <div className="field full"><label>Titulo</label><input value={appointment.title} onChange={(event) => update("title", event.target.value)} /></div>
          <div className="field"><label>Cliente</label><select value={appointment.client_id || ""} onChange={(event) => update("client_id", event.target.value || null)}><option value="">Sin cliente</option>{clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
          <div className="field"><label>Proyecto</label><select value={appointment.project_id || ""} onChange={(event) => update("project_id", event.target.value || null)}><option value="">Sin proyecto</option>{projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
          <div className="field"><label>Contacto</label><select value={appointment.contact_id || ""} onChange={(event) => update("contact_id", event.target.value || null)}><option value="">Sin contacto</option>{contacts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
          <div className="field"><label>Responsable</label><select value={appointment.responsible_user_id} onChange={(event) => update("responsible_user_id", event.target.value)}>{profiles.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select></div>
          <div className="field"><label>Inicio</label><input type="datetime-local" value={toInputDateTime(appointment.start_at)} onChange={(event) => update("start_at", new Date(event.target.value).toISOString())} /></div>
          <div className="field"><label>Fin</label><input type="datetime-local" value={toInputDateTime(appointment.end_at)} onChange={(event) => update("end_at", new Date(event.target.value).toISOString())} /></div>
          <div className="field"><label>Tipo</label><select value={appointment.type} onChange={(event) => update("type", event.target.value as AppointmentType)}>{["llamada", "junta", "visita", "seguimiento", "entrega", "cobranza", "otro"].map((item) => <option key={item}>{item}</option>)}</select></div>
          <div className="field"><label>Modalidad</label><select value={appointment.modality} onChange={(event) => update("modality", event.target.value as AppointmentModality)}>{["presencial", "llamada", "videollamada"].map((item) => <option key={item}>{item}</option>)}</select></div>
          <div className="field"><label>Estatus</label><select value={appointment.status} onChange={(event) => update("status", event.target.value as AppointmentStatus)}>{["pendiente", "confirmada", "realizada", "cancelada", "reagendada"].map((item) => <option key={item}>{item}</option>)}</select></div>
          <div className="field"><label>Lugar o link</label><input value={appointment.location_or_link || ""} onChange={(event) => update("location_or_link", event.target.value)} /></div>
          <label><input type="checkbox" checked={createMeet} onChange={(event) => setCreateMeet(event.target.checked)} /> Crear Google Meet</label>
          <div className="field full"><label>Participantes internos</label><select multiple value={appointment.participant_ids} onChange={(event) => update("participant_ids", Array.from(event.target.selectedOptions).map((option) => option.value))}>{profiles.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select></div>
          <div className="field full"><label>Notas internas</label><textarea value={appointment.notes || ""} onChange={(event) => update("notes", event.target.value)} /></div>
          <div className="field"><label>Siguiente accion</label><input value={appointment.next_action || ""} onChange={(event) => update("next_action", event.target.value)} /></div>
          <div className="field"><label>Fecha siguiente accion</label><input type="datetime-local" value={appointment.next_action_due_at ? toInputDateTime(appointment.next_action_due_at) : ""} onChange={(event) => update("next_action_due_at", event.target.value ? new Date(event.target.value).toISOString() : "")} /></div>
        </div>
        <div className="toolbar" style={{ marginTop: 16 }}>
          <button className="btn primary" onClick={() => saveAppointment(appointment)}><CheckCircle2 size={18} /> Guardar</button>
          <button className="btn success" onClick={() => changeStatus(appointment, "realizada")}>Completar</button>
          <button className="btn danger" onClick={() => changeStatus(appointment, "cancelada")}><XCircle size={18} /> Cancelar cita</button>
        </div>
      </section>
    </div>
  );
}
