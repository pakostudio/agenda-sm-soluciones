"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Mail, Plus, RefreshCw, Shield, UserCog, XCircle } from "lucide-react";
import { demoProfiles, demoWorkingHours } from "@/lib/demo-data";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";
import type { AdminUser, Role } from "@/lib/types";

type UserForm = {
  id?: string;
  full_name: string;
  primary_email: string;
  secondary_emails: string;
  role: Role;
  pin: string;
  color: string;
  active: boolean;
  work_start: string;
  work_end: string;
};

const emptyForm = (): UserForm => ({
  full_name: "",
  primary_email: "",
  secondary_emails: "",
  role: "member",
  pin: "",
  color: "#104080",
  active: true,
  work_start: "09:00",
  work_end: "18:00"
});

const demoUsers: AdminUser[] = demoProfiles.map((profile) => ({
  ...profile,
  secondary_emails: [],
  pin_expires_at: null,
  google_connected: profile.id === "u-pako",
  last_sign_in_at: profile.id === "u-pako" ? new Date().toISOString() : null,
  must_change_password: false,
  working_hours: demoWorkingHours.filter((item) => item.user_id === profile.id)
}));

const generatePin = () => String(Math.floor(100000 + Math.random() * 900000));
const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Sin acceso";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [form, setForm] = useState<UserForm>(emptyForm());
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRealApi, setIsRealApi] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const formRef = useRef<HTMLElement | null>(null);

  const selectedUser = useMemo(() => users.find((user) => user.id === form.id), [form.id, users]);

  const showMessage = (text: string) => {
    setMessage(text);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const authHeaders = async () => {
    const client = await getSupabaseBrowserClient();
    if (!client) return null;
    const { data } = await client.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : null;
  };

  const loadUsers = async () => {
    setIsLoading(true);
    setMessage("");
    try {
      const headers = await authHeaders();
      const client = await getSupabaseBrowserClient();
      if (!client || !isSupabaseConfigured) {
        setIsRealApi(false);
        setUsers(demoUsers);
        setMessage("Modo local: agrega variables Supabase y entra como Admin para operar con la Admin API.");
        return;
      }
      if (!headers) {
        setIsRealApi(false);
        setUsers([]);
        setMessage("Inicia sesion como Admin para operar con la Admin API.");
        return;
      }

      const { data: sessionData } = await client.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) {
        setAccessDenied(true);
        setMessage("Acceso denegado: inicia sesion como Admin.");
        return;
      }
      const { data: profile } = await client
        .from("profiles")
        .select("role, active")
        .eq("id", userId)
        .single();
      if (profile?.role !== "admin" || !profile.active) {
        setAccessDenied(true);
        setMessage("Acceso denegado: solo usuarios Admin activos pueden entrar al Panel Admin.");
        return;
      }
      setAccessDenied(false);

      const response = await fetch("/api/admin/users", { headers });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudieron cargar usuarios.");
      setUsers(data.users);
      setIsRealApi(true);
    } catch (error) {
      setIsRealApi(false);
      setMessage(error instanceof Error ? error.message : "No se pudieron cargar usuarios.");
    } finally {
      setIsLoading(false);
    }
  };

  const saveUser = async () => {
    setIsLoading(true);
    setMessage("");
    const working_hours = [1, 2, 3, 4, 5].map((day) => ({
      day_of_week: day,
      start_time: form.work_start,
      end_time: form.work_end,
      is_active: true
    }));

    const payload = {
      full_name: form.full_name,
      primary_email: form.primary_email,
      secondary_emails: form.secondary_emails.split(",").map((email) => email.trim()).filter(Boolean),
      role: form.role,
      pin: form.pin || generatePin(),
      color: form.color,
      active: form.active,
      working_hours
    };

    try {
      const headers = await authHeaders();
      const client = await getSupabaseBrowserClient();
      if (!client || !isSupabaseConfigured) {
        const localUser: AdminUser = {
          id: form.id || `local-${crypto.randomUUID()}`,
          full_name: payload.full_name,
          primary_email: payload.primary_email,
          role: payload.role,
          color: payload.color,
          active: payload.active,
          secondary_emails: payload.secondary_emails,
          pin_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          google_connected: false,
          last_sign_in_at: null,
          must_change_password: false,
          working_hours
        };
        setUsers((current) => form.id ? current.map((item) => item.id === form.id ? localUser : item) : [localUser, ...current]);
        setMessage(`Usuario creado correctamente. PIN temporal: ${payload.pin}`);
        setForm(emptyForm());
        return;
      }
      if (!headers) {
        setMessage("Sesion requerida para crear usuarios reales.");
        return;
      }

      const url = form.id ? `/api/admin/users/${form.id}` : "/api/admin/users";
      const response = await fetch(url, {
        method: form.id ? "PATCH" : "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo guardar usuario.");
      setMessage(data.temporary_pin ? `${data.message || "Usuario creado correctamente"} PIN temporal: ${data.temporary_pin}` : "Usuario actualizado.");
      setForm(emptyForm());
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar usuario.");
    } finally {
      setIsLoading(false);
    }
  };

  const editUser = (user: AdminUser) => {
    const firstHour = user.working_hours[0];
    setForm({
      id: user.id,
      full_name: user.full_name,
      primary_email: user.primary_email,
      secondary_emails: user.secondary_emails.join(", "),
      role: user.role,
      pin: "",
      color: user.color,
      active: user.active,
      work_start: firstHour?.start_time?.slice(0, 5) || "09:00",
      work_end: firstHour?.end_time?.slice(0, 5) || "18:00"
    });
    setMessage(`Editando a ${user.full_name}. Revisa el formulario de arriba y presiona Guardar cambios.`);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const patchUser = async (user: AdminUser, patch: Partial<UserForm>) => {
    setIsLoading(true);
    setMessage(`${patch.active === false ? "Desactivando" : "Actualizando"} a ${user.full_name}...`);
    const payload = {
      full_name: patch.full_name ?? user.full_name,
      primary_email: patch.primary_email ?? user.primary_email,
      secondary_emails: user.secondary_emails,
      role: patch.role ?? user.role,
      color: patch.color ?? user.color,
      active: patch.active ?? user.active,
      working_hours: user.working_hours.length ? user.working_hours : [1, 2, 3, 4, 5].map((day) => ({
        day_of_week: day,
        start_time: "09:00",
        end_time: "18:00",
        is_active: true
      }))
    };

    try {
      const headers = await authHeaders();
      const client = await getSupabaseBrowserClient();
      if (!client || !isSupabaseConfigured) {
        setUsers((current) => current.map((item) => item.id === user.id ? { ...item, ...payload } : item));
        showMessage(`Usuario ${payload.active ? "activado" : "desactivado"} localmente.`);
        return;
      }
      if (!headers) {
        showMessage("Sesion requerida para editar usuarios reales.");
        return;
      }

      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      showMessage(response.ok ? `Usuario ${payload.active ? "activado" : "desactivado"} correctamente.` : data.error);
      await loadUsers();
    } finally {
      setIsLoading(false);
    }
  };

  const resetPin = async (user: AdminUser) => {
    setIsLoading(true);
    setMessage(`Generando PIN temporal para ${user.full_name}...`);
    try {
      const headers = await authHeaders();
      const client = await getSupabaseBrowserClient();
      if (!client || !isSupabaseConfigured) {
        const pin = generatePin();
        showMessage(`PIN temporal local para ${user.full_name}: ${pin}`);
        return;
      }
      if (!headers) {
        showMessage("Sesion requerida para resetear PIN.");
        return;
      }
      const response = await fetch(`/api/admin/users/${user.id}/reset-pin`, { method: "POST", headers });
      const data = await response.json();
      showMessage(response.ok ? `PIN temporal para ${user.full_name}: ${data.temporary_pin}` : data.error);
      await loadUsers();
    } finally {
      setIsLoading(false);
    }
  };

  const sendInvite = async (user?: AdminUser) => {
    const target = user || selectedUser;
    if (!target) {
      showMessage("Selecciona o guarda un usuario antes de enviar invitacion.");
      return;
    }
    setIsLoading(true);
    setMessage(`Preparando invitacion para ${target.primary_email}...`);
    try {
      const headers = await authHeaders();
      const client = await getSupabaseBrowserClient();
      if (!client || !isSupabaseConfigured) {
        showMessage(`Invitacion preparada para ${target.primary_email}. Configura Supabase/Resend para enviarla.`);
        return;
      }
      if (!headers) {
        showMessage("Sesion requerida para enviar invitacion.");
        return;
      }
      const response = await fetch(`/api/admin/users/${target.id}/invite`, { method: "POST", headers });
      const data = await response.json();
      if (!response.ok) {
        showMessage(data.error || "No se pudo enviar invitacion.");
        return;
      }
      showMessage(data.sent ? `Invitacion enviada a ${target.primary_email}.` : data.warning || "Resend no configurado; usuario creado sin envío de invitación");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="main admin-page">
      <header className="topbar">
        <div className="brand">
          <Image src="/logo-sm-soluciones.png" width={82} height={64} alt="SM Soluciones" />
          <div>
            <h1>Panel Admin</h1>
            <p>Gestion de usuarios, PIN temporal, colores, horarios y estado de Agenda SM.</p>
          </div>
        </div>
        <div className="toolbar">
          <Link className="btn" href="/">Volver a agenda</Link>
          <button className="btn" onClick={loadUsers}><RefreshCw size={16} /> Actualizar</button>
        </div>
      </header>

      {message && <div className="admin-status" role="status">{message}</div>}

      {accessDenied ? (
        <section className="card">
          <div className="section-title">
            <h2>Acceso denegado</h2>
            <span className="badge cancelada">Admin requerido</span>
          </div>
          <p className="muted">{message}</p>
        </section>
      ) : (
        <>

      <section className="card" ref={formRef}>
        <div className="section-title">
          <h2>{form.id ? "Editar usuario" : "Nuevo usuario"}</h2>
          <span className={`badge ${isRealApi ? "confirmada" : "pendiente"}`}>{isRealApi ? "Supabase Admin activo" : "Modo local"}</span>
        </div>
        <div className="form-grid">
          <div className="field"><label>Nombre completo</label><input value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} /></div>
          <div className="field"><label>Email principal</label><input type="email" value={form.primary_email} onChange={(event) => setForm({ ...form, primary_email: event.target.value })} /></div>
          <div className="field full"><label>Emails secundarios</label><input value={form.secondary_emails} onChange={(event) => setForm({ ...form, secondary_emails: event.target.value })} placeholder="correo1@dominio.com, correo2@dominio.com" /></div>
          <div className="field"><label>Rol</label><select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as Role })}><option value="admin">Admin</option><option value="member">Miembro</option><option value="viewer">Lectura</option></select></div>
          <div className="field"><label>Estado</label><select value={String(form.active)} onChange={(event) => setForm({ ...form, active: event.target.value === "true" })}><option value="true">Activo</option><option value="false">Inactivo</option></select></div>
          <div className="field"><label>Color calendario</label><input type="color" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} /></div>
          <div className="field"><label>PIN temporal</label><input value={form.pin} onChange={(event) => setForm({ ...form, pin: event.target.value })} placeholder="6 digitos" /></div>
          <div className="field"><label>Inicio horario laboral</label><input type="time" value={form.work_start} onChange={(event) => setForm({ ...form, work_start: event.target.value })} /></div>
          <div className="field"><label>Fin horario laboral</label><input type="time" value={form.work_end} onChange={(event) => setForm({ ...form, work_end: event.target.value })} /></div>
        </div>
        <div className="toolbar" style={{ marginTop: 14 }}>
          <button className="btn" onClick={() => setForm({ ...form, pin: generatePin() })}><Shield size={16} /> Generar PIN</button>
          <button className="btn primary" disabled={isLoading} onClick={saveUser}><Plus size={16} /> {form.id ? "Guardar cambios" : "Nuevo usuario"}</button>
          <button className="btn" onClick={() => sendInvite()}><Mail size={16} /> Enviar invitacion por email</button>
          {form.id && <button className="btn" onClick={() => setForm(emptyForm())}>Limpiar</button>}
        </div>
        <p className="muted">Nuevo usuario crea el acceso en Supabase Auth con email confirmado y no envia correo automatico.</p>
      </section>

      <section className="card table-scroll">
        <div className="section-title">
          <h2>Usuarios</h2>
          <span className="badge">{users.length}</span>
        </div>
        <table className="availability-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email principal</th>
              <th>Rol</th>
              <th>Color</th>
              <th>Estado</th>
              <th>Google Calendar</th>
              <th>Ultimo acceso</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.full_name}</td>
                <td>{user.primary_email}</td>
                <td><span className="badge">{user.role}</span></td>
                <td><span className="color-chip" style={{ background: user.color }} /> {user.color}</td>
                <td>{user.active ? <span className="badge confirmada"><CheckCircle2 size={14} /> Activo</span> : <span className="badge cancelada"><XCircle size={14} /> Inactivo</span>}</td>
                <td>{user.google_connected ? "Conectado" : "No conectado"}</td>
                <td>{formatDate(user.last_sign_in_at)}</td>
                <td>
                  <div className="toolbar">
                    <button className="btn" title="Carga este usuario en el formulario superior para editarlo." onClick={() => editUser(user)}><UserCog size={16} /> Editar</button>
                    <button className="btn danger" disabled={isLoading} title={user.active ? "Bloquea el acceso de este usuario." : "Reactiva el acceso de este usuario."} onClick={() => patchUser(user, { active: !user.active })}>{user.active ? "Desactivar" : "Activar"}</button>
                    <button className="btn" disabled={isLoading} title="Genera un PIN temporal nuevo y lo muestra arriba." onClick={() => resetPin(user)}>Resetear PIN</button>
                    <button className="btn" disabled={isLoading} title="Envia invitacion por Resend cuando RESEND_API_KEY y EMAIL_FROM esten configurados." onClick={() => sendInvite(user)}>Invitar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
        </>
      )}
    </main>
  );
}
