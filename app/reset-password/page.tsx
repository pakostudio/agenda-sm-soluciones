"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const updatePassword = async () => {
    const client = await getSupabaseBrowserClient();
    if (!client) {
      setMessage("Configura Supabase para cambiar contrasena.");
      return;
    }
    if (password.length < 8) {
      setMessage("Usa al menos 8 caracteres.");
      return;
    }

    const { error } = await client.auth.updateUser({ password });
    setMessage(error ? error.message : "Contrasena actualizada. Ya puedes entrar a SM Content Studio.");
  };

  return (
    <main className="login-page">
      <section className="login-panel">
        <Image className="login-logo" src="/logo-sm-soluciones.png" width={420} height={220} alt="SM Soluciones" priority />
        <h1>Cambiar contrasena</h1>
        <p className="muted">Despues del primer acceso, reemplaza el PIN temporal por una contrasena permanente.</p>
        <div className="grid" style={{ marginTop: 22 }}>
          <div className="field">
            <label>Nueva contrasena</label>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          <button className="btn primary" onClick={updatePassword}>Guardar contrasena</button>
          {message && <p className="muted">{message}</p>}
          <Link className="btn" href="/">Volver al login</Link>
        </div>
      </section>
    </main>
  );
}
