/**
 * Mi Perfil — User profile management with avatar upload to R2
 */
import { useOutletContext, useFetcher, useLoaderData, redirect } from "react-router";
import type { Route } from "./+types/configuracion.perfil";
import type { ConfigContext } from "../configuracion";
import { createSupabaseServerClient, createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { logAuditEvent, getClientIP } from "~/lib/audit";
import { Camera, Save, User, Moon, Sun, Monitor, Globe, Bell, BellOff, Smartphone, Laptop, MapPin, Clock } from "lucide-react";
import { useState, useRef } from "react";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { supabase, headers } = createSupabaseServerClient(request, env);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/", { headers });

  const admin = createSupabaseAdminClient(env);

  // Get user preferences
  const { data: prefs } = await admin.from("user_preferences")
    .select("key, value")
    .eq("user_id", user.id);

  const preferences: Record<string, any> = {};
  (prefs || []).forEach((p: any) => { preferences[p.key] = p.value; });

  // Get login history
  const { data: loginHistory } = await admin.from("login_history")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  return Response.json({
    user: {
      id: user.id,
      email: user.email || "",
      name: user.user_metadata?.full_name || "",
      avatar: user.user_metadata?.avatar_url || null,
      provider: user.app_metadata?.provider || "google",
      lastSignIn: user.last_sign_in_at,
      createdAt: user.created_at,
    },
    preferences,
    loginHistory: loginHistory || [],
  }, { headers });
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const { supabase, headers } = createSupabaseServerClient(request, env);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/", { headers });

  const admin = createSupabaseAdminClient(env);
  const ip = getClientIP(request);
  const tenantSlug = (context as any).tenantSlug as string | null;
  const { data: org } = await admin.from("organizations")
    .select("id").eq("slug", tenantSlug).maybeSingle();

  const contentType = request.headers.get("content-type") || "";

  // Handle avatar upload (multipart)
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("avatar") as File;
    if (!file || file.size === 0) return Response.json({ error: "No file" }, { status: 400, headers });

    // Validate
    if (file.size > 2 * 1024 * 1024) {
      return Response.json({ error: "Archivo muy grande (máx 2MB)" }, { status: 400, headers });
    }
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      return Response.json({ error: "Formato no soportado (jpg/png/webp)" }, { status: 400, headers });
    }

    const ext = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
    const key = `avatars/${org?.id || "global"}/${user.id}/avatar.${ext}`;

    try {
      const bucket = env.ASSETS_BUCKET;
      const arrayBuffer = await file.arrayBuffer();
      await bucket.put(key, arrayBuffer, {
        httpMetadata: { contentType: file.type },
        customMetadata: { userId: user.id, uploadedAt: new Date().toISOString() },
      });

      // Build the public URL
      const avatarUrl = `https://assets.grixi.ai/${key}`;

      // Update user metadata
      await admin.auth.admin.updateUserById(user.id, {
        user_metadata: { ...user.user_metadata, avatar_url: avatarUrl, custom_avatar: true },
      });

      await logAuditEvent(admin, {
        actorId: user.id, action: "profile.avatar_upload", entityType: "user",
        entityId: user.id, organizationId: org?.id, metadata: { key, ext }, ipAddress: ip,
      });

      return Response.json({ success: true, avatarUrl }, { headers });
    } catch (e: any) {
      console.error("Avatar upload error:", e);
      return Response.json({ error: e.message }, { status: 500, headers });
    }
  }

  // Handle preference updates (JSON)
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "update_preferences") {
    const key = formData.get("key") as string;
    const value = formData.get("value") as string;

    if (!key) return Response.json({ error: "Key required" }, { status: 400, headers });

    let parsedValue: any;
    try { parsedValue = JSON.parse(value); } catch { parsedValue = value; }

    // Upsert preference
    const { data: existing } = await admin.from("user_preferences")
      .select("id").eq("user_id", user.id).eq("key", key).maybeSingle();

    if (existing) {
      await admin.from("user_preferences")
        .update({ value: parsedValue, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await admin.from("user_preferences").insert({
        user_id: user.id, key, value: parsedValue,
      });
    }

    // Special: theme change → also set cookie for SSR fast-path
    const responseCookies: string[] = [];
    if (key === "theme") {
      responseCookies.push(`grixi_theme=${parsedValue}; Path=/; SameSite=Lax; Secure; Max-Age=31536000`);
    }

    await logAuditEvent(admin, {
      actorId: user.id, action: "preference.update", entityType: "user_preference",
      organizationId: org?.id, metadata: { key, value: parsedValue }, ipAddress: ip,
    });

    const responseHeaders = new Headers(headers);
    responseCookies.forEach(c => responseHeaders.append("Set-Cookie", c));

    return Response.json({ success: true }, { headers: responseHeaders });
  }

  if (intent === "update_profile") {
    const name = formData.get("name") as string;
    if (name) {
      await admin.auth.admin.updateUserById(user.id, {
        user_metadata: { ...user.user_metadata, full_name: name },
      });
      await logAuditEvent(admin, {
        actorId: user.id, action: "profile.update", entityType: "user",
        entityId: user.id, organizationId: org?.id, metadata: { name }, ipAddress: ip,
      });
    }
    return Response.json({ success: true }, { headers });
  }

  return Response.json({ error: "Unknown intent" }, { status: 400, headers });
}

const THEMES = [
  { value: "dark", label: "Oscuro", icon: Moon },
  { value: "light", label: "Claro", icon: Sun },
  { value: "system", label: "Sistema", icon: Monitor },
];

export default function PerfilTab() {
  const { user, preferences, loginHistory } = useLoaderData<typeof loader>() as any;
  const config = useOutletContext<ConfigContext>();
  const fetcher = useFetcher();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user.name);
  const [currentTheme, setCurrentTheme] = useState(preferences.theme || "dark");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Archivo muy grande (máximo 2MB)");
      return;
    }

    // Preview
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);

    // Upload
    const form = new FormData();
    form.append("avatar", file);
    fetcher.submit(form, { method: "post", encType: "multipart/form-data" });
  };

  const saveName = () => {
    fetcher.submit({ intent: "update_profile", name }, { method: "post" });
  };

  const savePreference = (key: string, value: any) => {
    fetcher.submit(
      { intent: "update_preferences", key, value: JSON.stringify(value) },
      { method: "post" }
    );
  };

  const handleThemeChange = (theme: string) => {
    setCurrentTheme(theme);
    savePreference("theme", theme);
    // Apply theme immediately
    const root = document.documentElement;
    if (theme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.toggle("dark", prefersDark);
      root.classList.toggle("light", !prefersDark);
    } else {
      root.classList.toggle("dark", theme === "dark");
      root.classList.toggle("light", theme === "light");
    }
  };

  const avatarSrc = avatarPreview || user.avatar;
  const initials = (user.name || user.email || "U").charAt(0).toUpperCase();

  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-3xl">
      {/* Avatar + Name */}
      <div className="rounded-xl border p-6" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <h3 className="mb-5 flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          <User size={16} /> Perfil
        </h3>
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <div className="relative group">
            <div className="h-20 w-20 rounded-full overflow-hidden border-2 flex items-center justify-center"
              style={{ borderColor: config.org.settings?.primary_color || "#7c3aed" }}>
              {avatarSrc ? (
                <img src={avatarSrc} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-2xl font-bold"
                  style={{ backgroundColor: (config.org.settings?.primary_color || "#7c3aed") + "20", color: config.org.settings?.primary_color || "#7c3aed" }}>
                  {initials}
                </div>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white dark:bg-gray-800 shadow-lg transition-transform hover:scale-110"
              style={{ borderColor: "var(--border)" }}
            >
              <Camera size={14} style={{ color: "var(--foreground)" }} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>

          {/* Name + Email */}
          <div className="flex-1 space-y-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>Nombre</label>
              <div className="flex gap-2">
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500/20"
                  style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
                <button onClick={saveName} disabled={name === user.name || fetcher.state !== "idle"}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-white transition-all disabled:opacity-30"
                  style={{ backgroundColor: "#7c3aed" }}>
                  <Save size={14} />
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>Email</label>
              <p className="text-sm font-mono" style={{ color: "var(--foreground)" }}>{user.email}</p>
            </div>
            <div className="flex gap-6 text-xs" style={{ color: "var(--muted-foreground)" }}>
              <span>Proveedor: <strong className="capitalize">{user.provider}</strong></span>
              <span>Desde: {new Date(user.createdAt).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })}</span>
            </div>
          </div>
        </div>
        {fetcher.data?.avatarUrl && (
          <p className="mt-3 text-xs font-medium" style={{ color: "#16A34A" }}>✓ Foto actualizada</p>
        )}
      </div>

      {/* Tema */}
      <div className="rounded-xl border p-6" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          <Moon size={16} /> Apariencia
        </h3>
        <div className="flex gap-3">
          {THEMES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => handleThemeChange(value)}
              className="flex flex-1 flex-col items-center gap-2 rounded-xl border p-4 transition-all"
              style={{
                borderColor: currentTheme === value ? "#7c3aed" : "var(--border)",
                backgroundColor: currentTheme === value ? "#7c3aed10" : "transparent",
              }}
            >
              <Icon size={20} style={{ color: currentTheme === value ? "#7c3aed" : "var(--muted-foreground)" }} />
              <span className="text-xs font-medium" style={{ color: currentTheme === value ? "#7c3aed" : "var(--muted-foreground)" }}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Login History */}
      <div className="rounded-xl border p-6" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          <Clock size={16} /> Historial de Sesiones
        </h3>
        {loginHistory.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: "var(--muted-foreground)" }}>
            No hay sesiones registradas aún
          </p>
        ) : (
          <div className="space-y-2">
            {loginHistory.map((session: any) => (
              <div key={session.id} className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-white/5">
                {session.device_type === "mobile" ? (
                  <Smartphone size={16} style={{ color: "var(--muted-foreground)" }} />
                ) : (
                  <Laptop size={16} style={{ color: "var(--muted-foreground)" }} />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>
                    {session.browser || "Desconocido"} · {session.os || ""}
                  </p>
                  <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                    {session.city && (
                      <span className="flex items-center gap-1"><MapPin size={10} />{session.city}, {session.country}</span>
                    )}
                    <span>{session.ip_address}</span>
                  </div>
                </div>
                <span className="text-[11px] whitespace-nowrap" style={{ color: "var(--muted-foreground)" }}>
                  {new Date(session.created_at).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
