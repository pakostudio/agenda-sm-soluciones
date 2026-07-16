"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  BarChart3,
  CalendarDays,
  Check,
  Clipboard,
  Download,
  Edit3,
  FileVideo,
  Filter,
  Image as ImageIcon,
  LayoutDashboard,
  Library,
  Loader2,
  LogOut,
  Plus,
  Save,
  Search,
  Settings,
  Share2,
  Shield,
  Sparkles,
  Upload,
  Users
} from "lucide-react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";

type Role = "admin" | "editor" | "viewer";
type Network = "instagram" | "linkedin" | "tiktok";
type PostStatus = "draft" | "review" | "approved" | "published";
type AssetType = "image" | "video";

type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  active: boolean;
};

type UserDraft = {
  id?: string;
  full_name: string;
  email: string;
  role: Role;
  active: boolean;
  password: string;
};

type Brand = {
  id: string;
  name: string;
  slug: string;
  networks: Network[];
  editorial_profile: string;
  voice_tone: string;
  audience: string;
  cta_style: string;
  active: boolean;
};

type MasterPrompt = {
  id: string;
  brand_id: string;
  network: Network;
  title: string;
  prompt: string;
};

type Asset = {
  id: string;
  brand_id: string;
  title: string;
  asset_type: AssetType;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  public_url?: string;
  notes: string | null;
};

type ContentItem = {
  id: string;
  brand_id: string;
  network: Network;
  topic: string;
  asset_id: string | null;
  status: PostStatus;
  scheduled_at: string | null;
  published_at: string | null;
  copy_text: string;
  hashtags: string;
  cta: string;
  video_script: string;
  on_screen_text: string;
  title: string;
  description: string;
  manual_metrics: Record<string, number>;
  updated_at?: string;
};

type SocialConnection = {
  id: string;
  brand_id: string;
  network: Network;
  provider: "meta" | "linkedin" | "tiktok";
  account_id: string;
  account_name: string;
  account_type: string;
  scopes: string[];
  status: string;
  last_error: string | null;
};

type View = "dashboard" | "generator" | "calendar" | "library" | "brands" | "connections" | "settings";

const nav: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "generator", label: "Generador", icon: Sparkles },
  { id: "calendar", label: "Calendario", icon: CalendarDays },
  { id: "library", label: "Biblioteca", icon: Library },
  { id: "brands", label: "Marcas", icon: Archive },
  { id: "connections", label: "Redes", icon: Share2 },
  { id: "settings", label: "Ajustes", icon: Settings }
];

const statusLabels: Record<PostStatus, string> = {
  draft: "Borrador",
  review: "Revisión",
  approved: "Aprobado",
  published: "Publicado"
};

const networkLabels: Record<Network, string> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  tiktok: "TikTok"
};

const maxBytes = {
  image: 10 * 1024 * 1024,
  video: 80 * 1024 * 1024
};

const emptyContent: ContentItem = {
  id: "",
  brand_id: "",
  network: "instagram",
  topic: "",
  asset_id: null,
  status: "draft",
  scheduled_at: "",
  published_at: "",
  copy_text: "",
  hashtags: "",
  cta: "",
  video_script: "",
  on_screen_text: "",
  title: "",
  description: "",
  manual_metrics: { impressions: 0, reach: 0, clicks: 0, likes: 0, comments: 0, shares: 0 }
};

const formatDate = (value?: string | null) => {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
};

const toInputDate = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const generateDraft = (brand: Brand, network: Network, topic: string, prompt?: MasterPrompt) => {
  const net = networkLabels[network];
  const isVideo = network === "tiktok" || network === "instagram";
  const base = prompt?.prompt || "Crea contenido claro, útil y accionable.";
  const audience = brand.audience || "clientes potenciales";
  const tone = brand.voice_tone || "profesional, directo y cercano";
  const title = `${topic} | ${brand.name}`;
  const cta = brand.cta_style || "Agenda una llamada y hablemos de tu siguiente paso.";
  return {
    title,
    description: `${brand.name} para ${audience}. Enfoque ${net}: ${topic}.`,
    copy_text: `${topic}\n\nPara ${audience}, el punto clave es convertir la idea en una acción concreta. ${brand.name} lo comunica con un tono ${tone}: primero claridad, luego valor, después el siguiente paso.\n\n${base}`,
    hashtags:
      network === "linkedin"
        ? "#Estrategia #Negocios #Marketing #Crecimiento"
        : "#Contenido #MarketingDigital #Marca #Estrategia",
    cta,
    video_script: isVideo
      ? `Hook (0-3s): ${topic} sin complicarlo.\nDesarrollo (4-20s): Explica el problema, muestra el material seleccionado y aterriza una recomendación práctica.\nCierre (21-30s): Refuerza el beneficio y termina con: ${cta}`
      : "",
    on_screen_text: isVideo
      ? `1. ${topic}\n2. Lo que debes saber\n3. Acción recomendada\n4. ${brand.name}`
      : ""
  };
};

export default function SMContentStudio() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<Profile | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [prompts, setPrompts] = useState<MasterPrompt[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [selected, setSelected] = useState<ContentItem>(emptyContent);
  const [selectedConnectionId, setSelectedConnectionId] = useState("");
  const [filters, setFilters] = useState({ q: "", brand: "all", network: "all", status: "all", date: "" });
  const [brandDraft, setBrandDraft] = useState<Partial<Brand>>({});
  const [promptDraft, setPromptDraft] = useState<Partial<MasterPrompt>>({});
  const [userDraft, setUserDraft] = useState<UserDraft>({ full_name: "", email: "", role: "editor", active: true, password: "" });

  const clientReady = isSupabaseConfigured;
  const selectedBrand = brands.find((brand) => brand.id === selected.brand_id) || brands[0];
  const brandAssets = assets.filter((asset) => asset.brand_id === selected.brand_id);

  const loadData = async () => {
    const client = await getSupabaseBrowserClient();
    if (!client) {
      setLoading(false);
      return;
    }

    const session = await client.auth.getSession();
    if (!session.data.session?.user) {
      setUser(null);
      setLoading(false);
      return;
    }

    const authUser = session.data.session.user;
    const [profileRes, profilesRes, brandsRes, promptsRes, assetsRes, itemsRes] = await Promise.all([
      client.from("profiles").select("*").eq("id", authUser.id).single(),
      client.from("profiles").select("*").order("full_name"),
      client.from("brands").select("*").order("name"),
      client.from("master_prompts").select("*").order("network"),
      client.from("media_assets").select("*").order("created_at", { ascending: false }),
      client.from("content_items").select("*").order("updated_at", { ascending: false })
    ]);

    if (profileRes.error || !profileRes.data?.active) {
      await client.auth.signOut();
      setNotice("Tu usuario no tiene un perfil activo.");
      setUser(null);
      setLoading(false);
      return;
    }

    const signed = await Promise.all(
      ((assetsRes.data || []) as Asset[]).map(async (asset) => {
        const { data } = await client.storage.from("content-media").createSignedUrl(asset.storage_path, 3600);
        return { ...asset, public_url: data?.signedUrl };
      })
    );

    setUser(profileRes.data as Profile);
    setProfiles((profilesRes.data || []) as Profile[]);
    setBrands((brandsRes.data || []) as Brand[]);
    setPrompts((promptsRes.data || []) as MasterPrompt[]);
    setAssets(signed);
    setItems((itemsRes.data || []) as ContentItem[]);
    const token = session.data.session.access_token;
    const connectionRes = await fetch("/api/social/connections", { headers: { Authorization: `Bearer ${token}` } });
    if (connectionRes.ok) {
      const connectionPayload = await connectionRes.json();
      setConnections(connectionPayload.connections || []);
    }
    const firstBrand = (brandsRes.data || [])[0] as Brand | undefined;
    setSelected((current) => ({
      ...current,
      brand_id: current.brand_id || firstBrand?.id || "",
      network: firstBrand?.networks?.[0] || "instagram"
    }));
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const text = `${item.topic} ${item.title} ${item.copy_text}`.toLowerCase();
      return (
        (!filters.q || text.includes(filters.q.toLowerCase())) &&
        (filters.brand === "all" || item.brand_id === filters.brand) &&
        (filters.network === "all" || item.network === filters.network) &&
        (filters.status === "all" || item.status === filters.status) &&
        (!filters.date || item.scheduled_at?.slice(0, 10) === filters.date)
      );
    });
  }, [filters, items]);

  const stats = useMemo(
    () => ({
      draft: items.filter((item) => item.status === "draft").length,
      review: items.filter((item) => item.status === "review").length,
      approved: items.filter((item) => item.status === "approved").length,
      published: items.filter((item) => item.status === "published").length
    }),
    [items]
  );

  const signIn = async () => {
    setBusy(true);
    setNotice("");
    const client = await getSupabaseBrowserClient();
    if (!client) return setBusy(false);
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      setNotice("No fue posible iniciar sesión. Revisa correo y contraseña.");
      setBusy(false);
      return;
    }
    await loadData();
    setBusy(false);
  };

  const signOut = async () => {
    const client = await getSupabaseBrowserClient();
    await client?.auth.signOut();
    setUser(null);
  };

  const saveContent = async (nextStatus?: PostStatus) => {
    const client = await getSupabaseBrowserClient();
    if (!client || !user || !selectedBrand) return;
    if (!selected.topic.trim()) return setNotice("Escribe un tema para guardar el contenido.");
    setBusy(true);
    const payload = {
      brand_id: selected.brand_id,
      network: selected.network,
      topic: selected.topic.trim(),
      asset_id: selected.asset_id || null,
      status: nextStatus || selected.status,
      scheduled_at: selected.scheduled_at || null,
      published_at: nextStatus === "published" ? new Date().toISOString() : selected.published_at || null,
      copy_text: selected.copy_text,
      hashtags: selected.hashtags,
      cta: selected.cta,
      video_script: selected.video_script,
      on_screen_text: selected.on_screen_text,
      title: selected.title,
      description: selected.description,
      manual_metrics: selected.manual_metrics || {},
      updated_by: user.id
    };

    const result = selected.id
      ? await client.from("content_items").update(payload).eq("id", selected.id).select("*").single()
      : await client.from("content_items").insert(payload).select("*").single();

    if (result.error) {
      setNotice(result.error.message);
    } else {
      const saved = result.data as ContentItem;
      await client.from("content_history").insert({
        content_item_id: saved.id,
        changed_by: user.id,
        change_type: selected.id ? "update" : "create",
        snapshot: saved
      });
      setSelected(saved);
      setNotice("Contenido guardado.");
      await loadData();
    }
    setBusy(false);
  };

  const generateContent = () => {
    if (!selectedBrand || !selected.topic.trim()) return setNotice("Elige marca y escribe un tema.");
    const prompt = prompts.find((item) => item.brand_id === selectedBrand.id && item.network === selected.network);
    setSelected((current) => ({ ...current, ...generateDraft(selectedBrand, current.network, current.topic, prompt) }));
    setNotice("Contenido generado y listo para edición manual.");
  };

  const uploadAsset = async (file: File) => {
    const client = await getSupabaseBrowserClient();
    if (!client || !selectedBrand || !user) return;
    const type: AssetType = file.type.startsWith("video/") ? "video" : "image";
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) return setNotice("Solo se aceptan imágenes o videos.");
    if (file.size > maxBytes[type]) return setNotice(`El archivo supera el límite de ${type === "image" ? "10 MB" : "80 MB"}.`);
    setBusy(true);
    const path = `${selectedBrand.slug}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    const upload = await client.storage.from("content-media").upload(path, file, { upsert: false, contentType: file.type });
    if (upload.error) {
      setNotice(upload.error.message);
      setBusy(false);
      return;
    }
    const saved = await client.from("media_assets").insert({
      brand_id: selectedBrand.id,
      uploaded_by: user.id,
      title: file.name,
      asset_type: type,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type,
      file_size: file.size
    });
    setNotice(saved.error ? saved.error.message : "Archivo subido a Supabase Storage.");
    await loadData();
    setBusy(false);
  };

  const saveBrand = async () => {
    const client = await getSupabaseBrowserClient();
    if (!client || !user || user.role === "viewer") return;
    if (!brandDraft.name || !brandDraft.slug) return setNotice("Nombre y slug son obligatorios.");
    const payload = {
      name: brandDraft.name,
      slug: brandDraft.slug,
      networks: brandDraft.networks || ["instagram"],
      editorial_profile: brandDraft.editorial_profile || "",
      voice_tone: brandDraft.voice_tone || "",
      audience: brandDraft.audience || "",
      cta_style: brandDraft.cta_style || "",
      active: true
    };
    const result = brandDraft.id
      ? await client.from("brands").update(payload).eq("id", brandDraft.id)
      : await client.from("brands").insert(payload);
    setNotice(result.error ? result.error.message : "Marca guardada.");
    setBrandDraft({});
    await loadData();
  };

  const savePrompt = async () => {
    const client = await getSupabaseBrowserClient();
    if (!client || !user || user.role === "viewer") return;
    if (!promptDraft.brand_id || !promptDraft.network || !promptDraft.prompt) return setNotice("Completa marca, red y prompt.");
    const result = promptDraft.id
      ? await client.from("master_prompts").update(promptDraft).eq("id", promptDraft.id)
      : await client.from("master_prompts").insert(promptDraft);
    setNotice(result.error ? result.error.message : "Prompt guardado.");
    setPromptDraft({});
    await loadData();
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text || "");
    setNotice("Texto copiado.");
  };

  const authHeaders = async () => {
    const client = await getSupabaseBrowserClient();
    const session = await client?.auth.getSession();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.data.session?.access_token || ""}`
    };
  };

  const startOAuth = async (provider: "meta" | "linkedin" | "tiktok", brandId: string) => {
    const response = await fetch(`/api/oauth/${provider}/start`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ brand_id: brandId })
    });
    const payload = await response.json();
    if (!response.ok) return setNotice(payload.error || "No fue posible iniciar OAuth.");
    window.location.href = payload.url;
  };

  const publishNow = async () => {
    if (!selected.id) return setNotice("Guarda el contenido antes de publicar.");
    if (!selectedConnectionId) return setNotice("Elige una cuenta conectada.");
    setBusy(true);
    const response = await fetch("/api/social/publish", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ content_item_id: selected.id, social_connection_id: selectedConnectionId })
    });
    const payload = await response.json();
    setNotice(response.ok ? "Publicado en la red conectada." : payload.error || "No fue posible publicar.");
    await loadData();
    setBusy(false);
  };

  const schedulePublish = async () => {
    if (!selected.id) return setNotice("Guarda el contenido antes de programar.");
    if (!selected.scheduled_at) return setNotice("Elige fecha de programación interna.");
    if (!selectedConnectionId) return setNotice("Elige una cuenta conectada.");
    setBusy(true);
    const response = await fetch("/api/social/schedule", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ content_item_id: selected.id, social_connection_id: selectedConnectionId, run_at: selected.scheduled_at })
    });
    const payload = await response.json();
    setNotice(response.ok ? "Publicación programada." : payload.error || "No fue posible programar.");
    setBusy(false);
  };

  const saveUser = async () => {
    const client = await getSupabaseBrowserClient();
    if (!client || user?.role !== "admin") return setNotice("Solo admin puede gestionar usuarios.");
    if (!userDraft.full_name.trim() || !userDraft.email.trim()) return setNotice("Nombre y correo son obligatorios.");
    if (!userDraft.id && userDraft.password.length < 8) return setNotice("La contraseña temporal debe tener al menos 8 caracteres.");
    setBusy(true);
    const session = await client.auth.getSession();
    const response = await fetch(userDraft.id ? `/api/users/${userDraft.id}` : "/api/users", {
      method: userDraft.id ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.data.session?.access_token || ""}`
      },
      body: JSON.stringify(userDraft)
    });
    const result = await response.json();
    setNotice(response.ok ? "Usuario guardado." : result.error || "No fue posible guardar el usuario.");
    if (response.ok) {
      setUserDraft({ full_name: "", email: "", role: "editor", active: true, password: "" });
      await loadData();
    }
    setBusy(false);
  };

  if (!clientReady) {
    return (
      <main className="login-page">
        <section className="login-panel">
          <Shield size={34} />
          <h1>SM Content Studio</h1>
          <p>Configura Supabase para activar login, base de datos, Storage y RLS. Esta app no usa datos simulados.</p>
        </section>
      </main>
    );
  }

  if (loading) {
    return <main className="loading"><Loader2 className="spin" /> Cargando SM Content Studio...</main>;
  }

  if (!user) {
    return (
      <main className="login-page">
        <section className="login-panel">
          <div className="mark">SM</div>
          <h1>SM Content Studio</h1>
          <p>Acceso privado para producción editorial de GPC, SM Soluciones y LEM.</p>
          <label>Correo<input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
          <label>Contraseña<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>
          <button className="btn primary" onClick={signIn} disabled={busy}>{busy ? <Loader2 className="spin" /> : <Shield size={18} />} Entrar</button>
          {notice && <p className="notice">{notice}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="app">
      <aside className="sidebar">
        <div className="brand"><div className="mark">SM</div><div><strong>Content Studio</strong><span>Producción editorial</span></div></div>
        <nav className="nav">
          {nav.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}><item.icon size={18} />{item.label}</button>)}
        </nav>
        <div className="userbox"><strong>{user.full_name}</strong><span>{user.role}</span><button onClick={signOut}><LogOut size={16} />Salir</button></div>
      </aside>

      <section className="main">
        <header className="topbar">
          <div><h1>{nav.find((item) => item.id === view)?.label}</h1><p>Flujo: marca, tema, red, material, generar, editar, aprobar y publicar.</p></div>
          {notice && <button className="notice" onClick={() => setNotice("")}>{notice}</button>}
        </header>

        {view === "dashboard" && (
          <div className="grid">
            <section className="metrics">
              <article><span>Borradores</span><strong>{stats.draft}</strong></article>
              <article><span>En revisión</span><strong>{stats.review}</strong></article>
              <article><span>Aprobados</span><strong>{stats.approved}</strong></article>
              <article><span>Publicados</span><strong>{stats.published}</strong></article>
            </section>
            <Filters filters={filters} setFilters={setFilters} brands={brands} />
            <ContentTable items={filteredItems} brands={brands} assets={assets} onSelect={(item) => { setSelected({ ...emptyContent, ...item, scheduled_at: toInputDate(item.scheduled_at), published_at: item.published_at }); setView("generator"); }} />
          </div>
        )}

        {view === "generator" && (
          <div className="workspace">
            <section className="panel">
              <h2>Generador de contenido</h2>
              <label>Marca<select value={selected.brand_id} onChange={(e) => {
                const brand = brands.find((item) => item.id === e.target.value);
                setSelected({ ...emptyContent, brand_id: e.target.value, network: brand?.networks?.[0] || "instagram" });
              }}>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
              <label>Tema<textarea value={selected.topic} onChange={(e) => setSelected({ ...selected, topic: e.target.value })} /></label>
              <label>Red social<select value={selected.network} onChange={(e) => setSelected({ ...selected, network: e.target.value as Network })}>{(selectedBrand?.networks || []).map((network) => <option key={network} value={network}>{networkLabels[network]}</option>)}</select></label>
              <label>Material<select value={selected.asset_id || ""} onChange={(e) => setSelected({ ...selected, asset_id: e.target.value || null })}><option value="">Sin material</option>{brandAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.title}</option>)}</select></label>
              <div className="actions">
                <button className="btn" onClick={() => fileRef.current?.click()}><Upload size={18} />Subir material</button>
                <button className="btn primary" onClick={generateContent}><Sparkles size={18} />Generar</button>
              </div>
              <input ref={fileRef} type="file" accept="image/*,video/*" hidden onChange={(e) => e.target.files?.[0] && uploadAsset(e.target.files[0])} />
              <AssetPreview asset={assets.find((asset) => asset.id === selected.asset_id)} />
            </section>

            <section className="panel editor">
              <div className="row"><h2>Editor manual</h2><StatusPill status={selected.status} /></div>
              <label>Título<input value={selected.title} onChange={(e) => setSelected({ ...selected, title: e.target.value })} /></label>
              <label>Descripción<textarea value={selected.description} onChange={(e) => setSelected({ ...selected, description: e.target.value })} /></label>
              <CopyField label="Copy" value={selected.copy_text} setValue={(value) => setSelected({ ...selected, copy_text: value })} copy={copy} />
              <CopyField label="Hashtags" value={selected.hashtags} setValue={(value) => setSelected({ ...selected, hashtags: value })} copy={copy} />
              <CopyField label="CTA" value={selected.cta} setValue={(value) => setSelected({ ...selected, cta: value })} copy={copy} />
              <CopyField label="Guion de video" value={selected.video_script} setValue={(value) => setSelected({ ...selected, video_script: value })} copy={copy} />
              <CopyField label="Textos en pantalla" value={selected.on_screen_text} setValue={(value) => setSelected({ ...selected, on_screen_text: value })} copy={copy} />
              <label>Programación interna<input type="datetime-local" value={selected.scheduled_at || ""} onChange={(e) => setSelected({ ...selected, scheduled_at: e.target.value })} /></label>
              <label>Cuenta conectada<select value={selectedConnectionId} onChange={(e) => setSelectedConnectionId(e.target.value)}><option value="">Elegir cuenta</option>{connections.filter((connection) => connection.brand_id === selected.brand_id && connection.network === selected.network && connection.status === "connected").map((connection) => <option key={connection.id} value={connection.id}>{connection.account_name} · {connection.provider}</option>)}</select></label>
              <MetricsEditor item={selected} setItem={setSelected} />
              <div className="actions sticky-actions">
                <button className="btn" onClick={() => saveContent("draft")} disabled={busy}><Save size={18} />Guardar</button>
                <button className="btn" onClick={() => saveContent("review")} disabled={busy}><Edit3 size={18} />Revisión</button>
                <button className="btn success" onClick={() => saveContent("approved")} disabled={busy}><Check size={18} />Aprobar</button>
                <button className="btn dark" onClick={() => saveContent("published")} disabled={busy}><BarChart3 size={18} />Publicado</button>
                <button className="btn primary" onClick={publishNow} disabled={busy}><Share2 size={18} />Publicar ahora</button>
                <button className="btn" onClick={schedulePublish} disabled={busy}><CalendarDays size={18} />Programar red</button>
              </div>
            </section>
          </div>
        )}

        {view === "calendar" && <CalendarView items={filteredItems} brands={brands} onSelect={(item) => { setSelected({ ...emptyContent, ...item, scheduled_at: toInputDate(item.scheduled_at) }); setView("generator"); }} />}
        {view === "library" && <LibraryView assets={assets} brands={brands} onUpload={() => fileRef.current?.click()} />}
        {view === "brands" && <BrandsView brands={brands} prompts={prompts} brandDraft={brandDraft} setBrandDraft={setBrandDraft} saveBrand={saveBrand} promptDraft={promptDraft} setPromptDraft={setPromptDraft} savePrompt={savePrompt} />}
        {view === "connections" && <ConnectionsView brands={brands} connections={connections} startOAuth={startOAuth} />}
        {view === "settings" && <SettingsView user={user} profiles={profiles} userDraft={userDraft} setUserDraft={setUserDraft} saveUser={saveUser} busy={busy} />}
      </section>
    </main>
  );
}

function Filters({ filters, setFilters, brands }: { filters: any; setFilters: (value: any) => void; brands: Brand[] }) {
  return <section className="filters"><Search size={18} /><input placeholder="Buscar contenido" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} /><select value={filters.brand} onChange={(e) => setFilters({ ...filters, brand: e.target.value })}><option value="all">Todas las marcas</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select><select value={filters.network} onChange={(e) => setFilters({ ...filters, network: e.target.value })}><option value="all">Todas las redes</option>{Object.entries(networkLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="all">Todos los estados</option>{Object.entries(statusLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><input type="date" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} /><Filter size={18} /></section>;
}

function ContentTable({ items, brands, assets, onSelect }: { items: ContentItem[]; brands: Brand[]; assets: Asset[]; onSelect: (item: ContentItem) => void }) {
  return <section className="panel"><h2>Registro de contenido</h2><div className="table">{items.map((item) => <button key={item.id} className="table-row" onClick={() => onSelect(item)}><span><strong>{item.title || item.topic}</strong><small>{brands.find((brand) => brand.id === item.brand_id)?.name} · {networkLabels[item.network]}</small></span><span>{assets.find((asset) => asset.id === item.asset_id)?.asset_type === "video" ? <FileVideo size={18} /> : <ImageIcon size={18} />}</span><span>{formatDate(item.scheduled_at)}</span><StatusPill status={item.status} /></button>)}</div></section>;
}

function StatusPill({ status }: { status: PostStatus }) {
  return <span className={`pill ${status}`}>{statusLabels[status]}</span>;
}

function CopyField({ label, value, setValue, copy }: { label: string; value: string; setValue: (value: string) => void; copy: (value: string) => void }) {
  return <label>{label}<div className="copy-field"><textarea value={value} onChange={(e) => setValue(e.target.value)} /><button type="button" onClick={() => copy(value)} title={`Copiar ${label}`}><Clipboard size={18} /></button></div></label>;
}

function AssetPreview({ asset }: { asset?: Asset }) {
  if (!asset) return <div className="preview empty">Sin material seleccionado</div>;
  return <div className="preview">{asset.asset_type === "video" ? <video src={asset.public_url} controls /> : <img src={asset.public_url} alt={asset.title} />}<a className="btn" href={asset.public_url} download={asset.file_name}><Download size={18} />Descargar</a></div>;
}

function MetricsEditor({ item, setItem }: { item: ContentItem; setItem: (item: ContentItem) => void }) {
  const keys = ["impressions", "reach", "clicks", "likes", "comments", "shares"];
  return <div className="metric-grid">{keys.map((key) => <label key={key}>{key}<input type="number" min="0" value={item.manual_metrics?.[key] || 0} onChange={(e) => setItem({ ...item, manual_metrics: { ...item.manual_metrics, [key]: Number(e.target.value) } })} /></label>)}</div>;
}

function CalendarView({ items, brands, onSelect }: { items: ContentItem[]; brands: Brand[]; onSelect: (item: ContentItem) => void }) {
  const scheduled = items.filter((item) => item.scheduled_at);
  return <section className="panel"><h2>Calendario editorial</h2><div className="calendar-list">{scheduled.map((item) => <button key={item.id} onClick={() => onSelect(item)}><CalendarDays size={18} /><span><strong>{formatDate(item.scheduled_at)}</strong>{item.topic} · {brands.find((brand) => brand.id === item.brand_id)?.name} · {networkLabels[item.network]}</span><StatusPill status={item.status} /></button>)}</div></section>;
}

function LibraryView({ assets, brands, onUpload }: { assets: Asset[]; brands: Brand[]; onUpload: () => void }) {
  return <section className="panel"><div className="row"><h2>Biblioteca de imágenes y videos</h2><button className="btn primary" onClick={onUpload}><Upload size={18} />Subir</button></div><div className="asset-grid">{assets.map((asset) => <article key={asset.id}><AssetPreview asset={asset} /><strong>{asset.title}</strong><small>{brands.find((brand) => brand.id === asset.brand_id)?.name} · {(asset.file_size / 1024 / 1024).toFixed(2)} MB</small></article>)}</div></section>;
}

function BrandsView(props: { brands: Brand[]; prompts: MasterPrompt[]; brandDraft: Partial<Brand>; setBrandDraft: (value: Partial<Brand>) => void; saveBrand: () => void; promptDraft: Partial<MasterPrompt>; setPromptDraft: (value: Partial<MasterPrompt>) => void; savePrompt: () => void }) {
  const { brands, prompts, brandDraft, setBrandDraft, saveBrand, promptDraft, setPromptDraft, savePrompt } = props;
  return <div className="workspace"><section className="panel"><h2>Gestión de marcas</h2>{brands.map((brand) => <button key={brand.id} className="brand-card" onClick={() => setBrandDraft(brand)}><strong>{brand.name}</strong><span>{brand.networks.map((n) => networkLabels[n]).join(", ")}</span><small>{brand.editorial_profile}</small></button>)}<label>Nombre<input value={brandDraft.name || ""} onChange={(e) => setBrandDraft({ ...brandDraft, name: e.target.value })} /></label><label>Slug<input value={brandDraft.slug || ""} onChange={(e) => setBrandDraft({ ...brandDraft, slug: e.target.value })} /></label><label>Redes<select multiple value={brandDraft.networks || []} onChange={(e) => setBrandDraft({ ...brandDraft, networks: Array.from(e.target.selectedOptions).map((option) => option.value as Network) })}>{Object.entries(networkLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><label>Perfil editorial<textarea value={brandDraft.editorial_profile || ""} onChange={(e) => setBrandDraft({ ...brandDraft, editorial_profile: e.target.value })} /></label><label>Tono de voz<textarea value={brandDraft.voice_tone || ""} onChange={(e) => setBrandDraft({ ...brandDraft, voice_tone: e.target.value })} /></label><label>Audiencia<textarea value={brandDraft.audience || ""} onChange={(e) => setBrandDraft({ ...brandDraft, audience: e.target.value })} /></label><label>CTA base<textarea value={brandDraft.cta_style || ""} onChange={(e) => setBrandDraft({ ...brandDraft, cta_style: e.target.value })} /></label><button className="btn primary" onClick={saveBrand}><Save size={18} />Guardar marca</button></section><section className="panel"><h2>Prompts maestros</h2>{prompts.map((prompt) => <button key={prompt.id} className="brand-card" onClick={() => setPromptDraft(prompt)}><strong>{prompt.title}</strong><span>{brands.find((brand) => brand.id === prompt.brand_id)?.name} · {networkLabels[prompt.network]}</span></button>)}<label>Marca<select value={promptDraft.brand_id || ""} onChange={(e) => setPromptDraft({ ...promptDraft, brand_id: e.target.value })}><option value="">Elegir marca</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label><label>Red<select value={promptDraft.network || "instagram"} onChange={(e) => setPromptDraft({ ...promptDraft, network: e.target.value as Network })}>{Object.entries(networkLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><label>Título<input value={promptDraft.title || ""} onChange={(e) => setPromptDraft({ ...promptDraft, title: e.target.value })} /></label><label>Prompt<textarea value={promptDraft.prompt || ""} onChange={(e) => setPromptDraft({ ...promptDraft, prompt: e.target.value })} /></label><button className="btn primary" onClick={savePrompt}><Save size={18} />Guardar prompt</button></section></div>;
}

function ConnectionsView({ brands, connections, startOAuth }: { brands: Brand[]; connections: SocialConnection[]; startOAuth: (provider: "meta" | "linkedin" | "tiktok", brandId: string) => void }) {
  const providerForNetwork = (network: Network) => network === "instagram" ? "meta" : network === "linkedin" ? "linkedin" : "tiktok";
  return <section className="panel"><h2>Conectar redes sociales</h2><div className="asset-grid">{brands.map((brand) => <article key={brand.id}><strong>{brand.name}</strong><small>{brand.networks.map((network) => networkLabels[network]).join(", ")}</small>{brand.networks.map((network) => { const provider = providerForNetwork(network); const brandConnections = connections.filter((connection) => connection.brand_id === brand.id && connection.network === network); return <div className="connection-row" key={network}><span>{networkLabels[network]}</span><button className="btn" onClick={() => startOAuth(provider, brand.id)}><Share2 size={18} />Conectar {provider}</button>{brandConnections.map((connection) => <small key={connection.id}>{connection.account_name} · {connection.status}{connection.last_error ? ` · ${connection.last_error}` : ""}</small>)}</div>; })}</article>)}</div></section>;
}

function SettingsView(props: { user: Profile; profiles: Profile[]; userDraft: UserDraft; setUserDraft: (value: UserDraft) => void; saveUser: () => void; busy: boolean }) {
  const { user, profiles, userDraft, setUserDraft, saveUser, busy } = props;
  return <div className="workspace"><section className="panel"><h2>Configuración general</h2><div className="settings-grid"><article><Shield size={22} /><strong>Seguridad</strong><p>Supabase Auth, RLS por usuario activo y políticas por rol.</p></article><article><Users size={22} /><strong>Usuarios</strong><p>{profiles.length} perfiles registrados. Tu rol: {user.role}.</p></article><article><Library size={22} /><strong>Storage</strong><p>Bucket privado content-media con URLs firmadas, imágenes hasta 10 MB y videos hasta 80 MB.</p></article><article><Sparkles size={22} /><strong>APIs futuras</strong><p>La tabla social_connections queda lista para Meta, LinkedIn, TikTok y programadores externos.</p></article></div></section><section className="panel"><h2>Usuarios y roles</h2>{profiles.map((profile) => <button key={profile.id} className="brand-card" onClick={() => setUserDraft({ id: profile.id, full_name: profile.full_name, email: profile.email, role: profile.role, active: profile.active, password: "" })}><strong>{profile.full_name}</strong><span>{profile.email} · {profile.role} · {profile.active ? "activo" : "inactivo"}</span></button>)}{user.role === "admin" && <><label>Nombre<input value={userDraft.full_name} onChange={(e) => setUserDraft({ ...userDraft, full_name: e.target.value })} /></label><label>Correo<input type="email" value={userDraft.email} onChange={(e) => setUserDraft({ ...userDraft, email: e.target.value })} /></label><label>Rol<select value={userDraft.role} onChange={(e) => setUserDraft({ ...userDraft, role: e.target.value as Role })}><option value="admin">Admin</option><option value="editor">Editor</option><option value="viewer">Viewer</option></select></label><label>Contraseña temporal<input type="password" value={userDraft.password} onChange={(e) => setUserDraft({ ...userDraft, password: e.target.value })} placeholder={userDraft.id ? "Opcional para reemplazar" : "Mínimo 8 caracteres"} /></label><label className="check"><input type="checkbox" checked={userDraft.active} onChange={(e) => setUserDraft({ ...userDraft, active: e.target.checked })} /> Usuario activo</label><div className="actions"><button className="btn primary" onClick={saveUser} disabled={busy}><Save size={18} />Guardar usuario</button><button className="btn" onClick={() => setUserDraft({ full_name: "", email: "", role: "editor", active: true, password: "" })}>Nuevo</button></div></>}</section></div>;
}
