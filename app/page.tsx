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
import type { Appointment, AppointmentModality, AppointmentStatus, AppointmentType, AvailabilitySlot, Profile } from "@/lib/types";

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
    client_id: demoClients[0]?.id,
    project_id: demoProjects[0]?.id,
    contact_id: demoContacts[0]?.id,
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
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeUser, setActiveUser] = useState<Profile>(demoProfiles[0]);
  const [view, setView] = useState<View>("dashboard");
  const [appointments, setAppointments] = useState<Appointment[]>(demoAppointments);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [memberFilter, setMemberFilter] = useState("all");
  const [availabilityParticipants, setAvailabilityParticipants] = useState<string[]>(["u-pako", "u-billy"]);
  const [duration, setDuration] = useState(60);
  const [rangeStart, setRangeStart] = useState(`${todayKey()}T09:00`);
  const [rangeEnd, setRangeEnd] = useState(`${todayKey()}T18:00`);
  const [googleWarning, setGoogleWarning] = useState("");

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
        if (profile) setActiveUser(profile as Profile);
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
        workingHours: demoWorkingHours,
        blocks: demoBlocks,
        stepMinutes: 30
      }).slice(0, 24),
    [appointments, availabilityParticipants, duration, rangeEnd, rangeStart]
  );

  const login = async () => {
    if (isSupabaseConfigured && supabase && sessionEmail && password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email: sessionEmail, password });
      if (error) alert(error.message);
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
        setIsAuthenticated(true);
      }
      return;
    }

    const matched = demoProfiles.find((profile) => profile.primary_email.toLowerCase() === sessionEmail.toLowerCase()) || demoProfiles[0];
    setActiveUser(matched);
    setIsAuthenticated(true);
  };

  const saveAppointment = (appointment: Appointment) => {
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

    const normalized = {
      ...appointment,
      duration_minutes: Math.round((end.getTime() - start.getTime()) / 60_000),
      updated_by: activeUser.id
    };

    setAppointments((current) => {
      const exists = current.some((item) => item.id === normalized.id);
      return exists ? current.map((item) => (item.id === normalized.id ? normalized : item)) : [normalized, ...current];
    });
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
    const response = await fetch("/api/google/freebusy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timeMin: new Date(rangeStart).toISOString(), timeMax: new Date(rangeEnd).toISOString(), users: availabilityParticipants })
    });
    const data = await response.json();
    setGoogleWarning(data.warning || "Google Free/Busy listo para conectar por usuario.");
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
              <label>Contrasena</label>
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Supabase Auth" />
            </div>
            <button className="btn primary" onClick={login}>
              Entrar
            </button>
            <p className="muted">Sin variables de Supabase, la app usa datos locales para desarrollo y QA visual.</p>
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
          <button className="btn" onClick={() => setIsAuthenticated(false)}>
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
              {demoProfiles.map((profile) => (
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
        {view === "calendar" && <CalendarView appointments={visibleAppointments} onSelect={(item) => { setSelected(item); setIsModalOpen(true); }} />}
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
            googleWarning={googleWarning}
            testGoogleFreeBusy={testGoogleFreeBusy}
            createFromSlot={openNew}
          />
        )}
        {view === "clients" && <ClientsView />}
        {view === "notifications" && <NotificationsView />}
        {view === "settings" && <SettingsView activeUser={activeUser} setActiveUser={setActiveUser} />}
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

function CalendarView({ appointments, onSelect }: { appointments: Appointment[]; onSelect: (item: Appointment) => void }) {
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
          backgroundColor: demoProfiles.find((profile) => profile.id === item.responsible_user_id)?.color || "#104080",
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
              {demoProfiles.filter((profile) => profile.active).map((profile) => (
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
              {props.participantIds.map((id) => <th key={id}>{demoProfiles.find((profile) => profile.id === id)?.full_name}</th>)}
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

function ClientsView() {
  return (
    <div className="grid two">
      <EntityList title="Clientes" rows={demoClients.map((item) => `${item.name} - ${item.status}`)} />
      <EntityList title="Proyectos y contactos" rows={[...demoProjects.map((item) => item.name), ...demoContacts.map((item) => `${item.name} / ${item.email}`)]} />
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

function SettingsView({ activeUser, setActiveUser }: { activeUser: Profile; setActiveUser: (profile: Profile) => void }) {
  return (
    <div className="grid two">
      <section className="card">
        <div className="section-title"><h2>Miembros y roles</h2></div>
        <div className="list">
          {demoProfiles.map((profile) => (
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
          <label><input type="checkbox" /> Google Calendar Free/Busy activo</label>
        </div>
      </section>
    </div>
  );
}

function AppointmentModal({ appointment, setAppointment, saveAppointment, changeStatus, close }: {
  appointment: Appointment;
  setAppointment: (appointment: Appointment) => void;
  saveAppointment: (appointment: Appointment) => void;
  changeStatus: (appointment: Appointment, status: AppointmentStatus) => void;
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
          <div className="field"><label>Cliente</label><select value={appointment.client_id || ""} onChange={(event) => update("client_id", event.target.value)}>{demoClients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
          <div className="field"><label>Proyecto</label><select value={appointment.project_id || ""} onChange={(event) => update("project_id", event.target.value)}>{demoProjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
          <div className="field"><label>Contacto</label><select value={appointment.contact_id || ""} onChange={(event) => update("contact_id", event.target.value)}>{demoContacts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
          <div className="field"><label>Responsable</label><select value={appointment.responsible_user_id} onChange={(event) => update("responsible_user_id", event.target.value)}>{demoProfiles.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select></div>
          <div className="field"><label>Inicio</label><input type="datetime-local" value={toInputDateTime(appointment.start_at)} onChange={(event) => update("start_at", new Date(event.target.value).toISOString())} /></div>
          <div className="field"><label>Fin</label><input type="datetime-local" value={toInputDateTime(appointment.end_at)} onChange={(event) => update("end_at", new Date(event.target.value).toISOString())} /></div>
          <div className="field"><label>Tipo</label><select value={appointment.type} onChange={(event) => update("type", event.target.value as AppointmentType)}>{["llamada", "junta", "visita", "seguimiento", "entrega", "cobranza", "otro"].map((item) => <option key={item}>{item}</option>)}</select></div>
          <div className="field"><label>Modalidad</label><select value={appointment.modality} onChange={(event) => update("modality", event.target.value as AppointmentModality)}>{["presencial", "llamada", "videollamada"].map((item) => <option key={item}>{item}</option>)}</select></div>
          <div className="field"><label>Estatus</label><select value={appointment.status} onChange={(event) => update("status", event.target.value as AppointmentStatus)}>{["pendiente", "confirmada", "realizada", "cancelada", "reagendada"].map((item) => <option key={item}>{item}</option>)}</select></div>
          <div className="field"><label>Lugar o link</label><input value={appointment.location_or_link || ""} onChange={(event) => update("location_or_link", event.target.value)} /></div>
          <div className="field full"><label>Participantes internos</label><select multiple value={appointment.participant_ids} onChange={(event) => update("participant_ids", Array.from(event.target.selectedOptions).map((option) => option.value))}>{demoProfiles.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select></div>
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
