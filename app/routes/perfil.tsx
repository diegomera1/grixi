/**
 * /perfil — Hub de Perfil de Usuario (standalone, fuera de configuración)
 * Accesible para cualquier usuario autenticado.
 * Secciones: Datos personales, Seguridad (passkeys), Preferencias, Login history
 */
import { redirect, useLoaderData, useOutletContext, useRevalidator } from "react-router";
import { useState, useCallback } from "react";
import type { Route } from "./+types/perfil";
import type { TenantContext } from "./authenticated";
import { createSupabaseServerClient, createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { RouteErrorBoundary } from "~/components/route-error-boundary";
import { apiFetch } from "~/lib/api-fetch";
import {
  User, Shield, Key, Bell, Clock, Fingerprint, Plus, Trash2,
  Globe, Monitor, Smartphone, ArrowLeft, Save, CheckCircle2,
  AlertTriangle, Laptop, ChevronRight, Link2, Unlink, Lock
} from "lucide-react";

export const meta = () => [{ title: "Mi Perfil — GRIXI" }];
export const handle = { breadcrumb: "Mi Perfil" };

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { supabase, headers } = createSupabaseServerClient(request, env);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/", { headers });

  const admin = createSupabaseAdminClient(env);

  // Fetch profile
  const { data: profile } = await admin.from("profiles")
    .select("*").eq("id", user.id).maybeSingle();

  // Fetch passkeys
  const { data: passkeys } = await admin.from("user_passkeys")
    .select("id, credential_id, friendly_name, device_type, backed_up, last_used_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Fetch login history (last 10)
  const { data: loginHistory } = await admin.from("login_history")
    .select("*").eq("user_id", user.id)
    .order("created_at", { ascending: false }).limit(10);

  // User identities (from Supabase auth — native identity linking)
  const identities = user.identities || [];
  const hasPassword = identities.some((i: any) => i.provider === "email");

  return Response.json({
    profile: profile || {},
    passkeys: passkeys || [],
    loginHistory: loginHistory || [],
    identities,
    hasPassword,
    userEmail: user.email || "",
    userMeta: user.user_metadata || {},
  }, { headers });
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const { supabase, headers } = createSupabaseServerClient(request, env);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createSupabaseAdminClient(env);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "update_profile") {
    const updates: Record<string, any> = {};
    const fields = [
      "full_name", "phone", "bio", "nationality", "personal_email",
      "emergency_contact_name", "emergency_contact_phone",
      "address_line1", "address_line2", "city", "state", "country", "postal_code",
      "job_title", "department", "employee_id", "work_phone", "linkedin_url",
      "preferred_language", "timezone", "preferred_currency", "preferred_date_format",
    ];
    for (const f of fields) {
      const val = formData.get(f);
      if (val !== null) updates[f] = val || null;
    }
    // Boolean fields
    const compact = formData.get("compact_mode");
    if (compact !== null) updates.compact_mode = compact === "true";

    // Gender
    const gender = formData.get("gender");
    if (gender !== null) updates.gender = gender || null;

    // Date of birth
    const dob = formData.get("date_of_birth");
    if (dob !== null) updates.date_of_birth = dob || null;

    const { error } = await admin.from("profiles").update(updates).eq("id", user.id);
    if (error) return Response.json({ error: error.message }, { status: 400, headers });
    return Response.json({ success: true, message: "Perfil actualizado" }, { headers });
  }

  if (intent === "delete_passkey") {
    const passkeyId = formData.get("passkey_id") as string;
    const { error } = await admin.from("user_passkeys")
      .delete().eq("id", passkeyId).eq("user_id", user.id);
    if (error) return Response.json({ error: error.message }, { status: 400, headers });

    // Check if user has remaining passkeys
    const { count } = await admin.from("user_passkeys")
      .select("id", { count: "exact" }).eq("user_id", user.id);
    if (!count || count === 0) {
      await admin.from("profiles").update({ passkey_enabled: false }).eq("id", user.id);
    }
    return Response.json({ success: true }, { headers });
  }

  if (intent === "unlink_identity") {
    const identityId = formData.get("identity_id") as string;
    const provider = formData.get("provider") as string;
    // Use the user's own client to unlink (requires their session)
    const { data: identities } = await supabase.auth.getUserIdentities();
    const identity = identities?.identities?.find((i: any) => i.identity_id === identityId);
    if (!identity) return Response.json({ error: "Identidad no encontrada" }, { status: 404, headers });
    if ((identities?.identities?.length || 0) <= 1) {
      return Response.json({ error: "No puedes desvincular tu única identidad" }, { status: 400, headers });
    }
    const { error } = await supabase.auth.unlinkIdentity(identity);
    if (error) return Response.json({ error: error.message }, { status: 400, headers });
    // Audit
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    await admin.from("audit_logs").insert({
      actor_id: user.id, action: "identity.unlinked", entity_type: "identity",
      metadata: { provider, identityId }, ip_address: ip,
    });
    return Response.json({ success: true, message: `${provider} desvinculado` }, { headers });
  }

  return Response.json({ error: "Invalid intent" }, { status: 400, headers });
}

// ─── Section Components ─────────────────────────────────

function ProfileSection({ profile, userEmail, userMeta }: {
  profile: any; userEmail: string; userMeta: any;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const revalidator = useRevalidator();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    fd.set("intent", "update_profile");
    const res = await fetch("/perfil", { method: "POST", body: fd });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      revalidator.revalidate();
    }
  };

  const avatar = userMeta?.avatar_url || profile.avatar_url;
  const initial = (profile.full_name || userEmail || "U").charAt(0).toUpperCase();

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Avatar + basic info */}
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl ring-2 ring-brand/20">
          {avatar ? (
            <img src={avatar} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-brand text-xl font-bold text-white">{initial}</div>
          )}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-text-primary">{profile.full_name || userEmail}</h3>
          <p className="text-xs text-text-muted">{userEmail}</p>
          {profile.job_title && <p className="text-xs text-text-secondary mt-0.5">{profile.job_title}{profile.department ? ` · ${profile.department}` : ""}</p>}
        </div>
      </div>

      {/* Personal Info */}
      <FieldGroup title="Información Personal">
        <Field label="Nombre completo" name="full_name" defaultValue={profile.full_name} />
        <Field label="Teléfono" name="phone" defaultValue={profile.phone} type="tel" />
        <Field label="Email personal" name="personal_email" defaultValue={profile.personal_email} type="email" />
        <Field label="Bio" name="bio" defaultValue={profile.bio} multiline />
        <Field label="Fecha de nacimiento" name="date_of_birth" defaultValue={profile.date_of_birth} type="date" />
        <SelectField label="Género" name="gender" defaultValue={profile.gender || ""}
          options={[
            { value: "", label: "Prefiero no decir" },
            { value: "male", label: "Masculino" },
            { value: "female", label: "Femenino" },
            { value: "other", label: "Otro" },
          ]}
        />
        <Field label="Nacionalidad" name="nationality" defaultValue={profile.nationality} />
      </FieldGroup>

      {/* Work Info */}
      <FieldGroup title="Información Laboral">
        <Field label="Cargo" name="job_title" defaultValue={profile.job_title} />
        <Field label="Departamento" name="department" defaultValue={profile.department} />
        <Field label="ID Empleado" name="employee_id" defaultValue={profile.employee_id} />
        <Field label="Teléfono laboral" name="work_phone" defaultValue={profile.work_phone} type="tel" />
        <Field label="LinkedIn" name="linkedin_url" defaultValue={profile.linkedin_url} type="url" />
      </FieldGroup>

      {/* Emergency Contact */}
      <FieldGroup title="Contacto de Emergencia">
        <Field label="Nombre" name="emergency_contact_name" defaultValue={profile.emergency_contact_name} />
        <Field label="Teléfono" name="emergency_contact_phone" defaultValue={profile.emergency_contact_phone} type="tel" />
      </FieldGroup>

      {/* Address */}
      <FieldGroup title="Dirección">
        <Field label="Línea 1" name="address_line1" defaultValue={profile.address_line1} />
        <Field label="Línea 2" name="address_line2" defaultValue={profile.address_line2} />
        <Field label="Ciudad" name="city" defaultValue={profile.city} />
        <Field label="Provincia/Estado" name="state" defaultValue={profile.state} />
        <Field label="País" name="country" defaultValue={profile.country || "EC"} />
        <Field label="Código Postal" name="postal_code" defaultValue={profile.postal_code} />
      </FieldGroup>

      {/* Preferences */}
      <FieldGroup title="Preferencias">
        <SelectField label="Idioma" name="preferred_language" defaultValue={profile.preferred_language || "es"}
          options={[{ value: "es", label: "Español" }, { value: "en", label: "English" }, { value: "pt", label: "Português" }]}
        />
        <Field label="Zona horaria" name="timezone" defaultValue={profile.timezone || "America/Guayaquil"} />
        <SelectField label="Moneda" name="preferred_currency" defaultValue={profile.preferred_currency || "USD"}
          options={[{ value: "USD", label: "USD" }, { value: "EUR", label: "EUR" }, { value: "MXN", label: "MXN" }, { value: "COP", label: "COP" }]}
        />
        <SelectField label="Formato de fecha" name="preferred_date_format" defaultValue={profile.preferred_date_format || "DD/MM/YYYY"}
          options={[{ value: "DD/MM/YYYY", label: "DD/MM/YYYY" }, { value: "MM/DD/YYYY", label: "MM/DD/YYYY" }, { value: "YYYY-MM-DD", label: "YYYY-MM-DD" }]}
        />
      </FieldGroup>

      {/* Save button */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
        >
          {saving ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : saved ? (
            <CheckCircle2 size={16} />
          ) : (
            <Save size={16} />
          )}
          {saved ? "Guardado" : saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}

function PasskeySection({ passkeys }: { passkeys: any[] }) {
  const [registering, setRegistering] = useState(false);
  const [friendlyName, setFriendlyName] = useState("");
  const [showRegister, setShowRegister] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const revalidator = useRevalidator();

  const registerPasskey = useCallback(async () => {
    setError(null);
    setRegistering(true);
    try {
      const { startRegistration } = await import("@simplewebauthn/browser");
      // 1. Get options
      const optRes = await apiFetch("/api/auth/passkey/register-options", { method: "POST" });
      if (!optRes.ok) throw new Error("Failed to get registration options");
      const options = await optRes.json();

      // 2. Start browser registration
      const attestation = await startRegistration({ optionsJSON: options });

      // 3. Verify
      const verRes = await apiFetch("/api/auth/passkey/register-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attestation, friendlyName: friendlyName || undefined }),
      });
      if (!verRes.ok) {
        const err = await verRes.json();
        throw new Error(err.error || "Verification failed");
      }

      setShowRegister(false);
      setFriendlyName("");
      revalidator.revalidate();
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        setError("Registro cancelado por el usuario");
      } else {
        setError(err.message || "Error al registrar passkey");
      }
    } finally {
      setRegistering(false);
    }
  }, [friendlyName, revalidator]);

  const deletePasskey = useCallback(async (id: string) => {
    if (!confirm("¿Eliminar esta passkey? No podrás usarla para iniciar sesión.")) return;
    const fd = new FormData();
    fd.set("intent", "delete_passkey");
    fd.set("passkey_id", id);
    await fetch("/perfil", { method: "POST", body: fd });
    revalidator.revalidate();
  }, [revalidator]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Fingerprint size={16} className="text-brand" /> Passkeys
          </h4>
          <p className="text-xs text-text-muted mt-0.5">
            Inicia sesión con tu huella dactilar, Face ID o Windows Hello
          </p>
        </div>
        <button
          onClick={() => setShowRegister(!showRegister)}
          className="flex items-center gap-1.5 rounded-lg bg-brand/10 px-3 py-1.5 text-xs font-medium text-brand transition-colors hover:bg-brand/20"
        >
          <Plus size={14} /> Agregar
        </button>
      </div>

      {/* Register form */}
      {showRegister && (
        <div className="rounded-xl border border-brand/20 bg-brand/5 p-4 space-y-3">
          <input
            type="text"
            value={friendlyName}
            onChange={(e) => setFriendlyName(e.target.value)}
            placeholder='Nombre del dispositivo (ej: "MacBook Pro")'
            className="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-brand"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={registerPasskey}
              disabled={registering}
              className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
            >
              {registering ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Fingerprint size={14} />
              )}
              {registering ? "Verificando..." : "Registrar Passkey"}
            </button>
            <button
              onClick={() => { setShowRegister(false); setError(null); }}
              className="rounded-lg px-3 py-2 text-sm text-text-muted hover:text-text-primary"
            >
              Cancelar
            </button>
          </div>
          {error && (
            <p className="flex items-center gap-1.5 text-xs text-red-500">
              <AlertTriangle size={12} /> {error}
            </p>
          )}
        </div>
      )}

      {/* Passkey list */}
      {passkeys.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-6 text-center">
          <Key size={28} className="mx-auto mb-2 text-text-muted opacity-30" />
          <p className="text-xs text-text-muted">No tienes passkeys registradas</p>
          <p className="text-[10px] text-text-muted mt-1">Agrega una para iniciar sesión sin contraseña</p>
        </div>
      ) : (
        <div className="space-y-2">
          {passkeys.map((pk: any) => (
            <div key={pk.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:border-brand/20">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10">
                {pk.device_type === "multiDevice" ? <Smartphone size={16} className="text-brand" /> : <Laptop size={16} className="text-brand" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{pk.friendly_name || "Passkey"}</p>
                <p className="text-[10px] text-text-muted">
                  Registrada {new Date(pk.created_at).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })}
                  {pk.last_used_at && ` · Último uso: ${new Date(pk.last_used_at).toLocaleDateString("es", { day: "numeric", month: "short" })}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {pk.backed_up && (
                  <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-500">Synced</span>
                )}
                <button
                  onClick={() => deletePasskey(pk.id)}
                  className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
                  title="Eliminar passkey"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Linked Accounts Section ────────────────────────────

const PROVIDERS = [
  { id: "google", label: "Google" },
  { id: "azure", label: "Microsoft" },
] as const;

function ProviderIcon({ provider, sz = 18 }: { provider: string; sz?: number }) {
  if (provider === "google") return (
    <svg width={sz} height={sz} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
  if (provider === "azure") return (
    <svg width={sz} height={sz} viewBox="0 0 21 21" fill="none">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
  return <Globe size={sz} />;
}

function LinkedAccountsSection({ identities, hasPassword, passkeys, env, onNavigate }: {
  identities: any[]; hasPassword: boolean; passkeys: any[];
  env: { SUPABASE_URL: string; SUPABASE_ANON_KEY: string };
  onNavigate: (s: string) => void;
}) {
  const [linking, setLinking] = useState<string | null>(null);
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const [showPwForm, setShowPwForm] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaving, setPwSaving] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const revalidator = useRevalidator();
  const total = identities.length + (hasPassword ? 1 : 0);

  const doLink = async (provider: string) => {
    setLinking(provider);
    const { createBrowserClient } = await import("@supabase/ssr");
    const sb = createBrowserClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
    await sb.auth.linkIdentity({
      provider: provider as any,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?linking=true`,
        ...(provider === "azure" ? { scopes: "email profile openid" } : {}),
      },
    });
  };

  const doUnlink = async (identityId: string, provider: string) => {
    setUnlinking(identityId);
    const fd = new FormData();
    fd.set("intent", "unlink_identity");
    fd.set("identity_id", identityId);
    fd.set("provider", provider);
    await fetch("/perfil", { method: "POST", body: fd });
    revalidator.revalidate();
    setUnlinking(null);
    setConfirmId(null);
  };

  const doPw = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPwError(null);
    const fd = new FormData(e.currentTarget);
    const pw = fd.get("password") as string;
    const pw2 = fd.get("password_confirm") as string;
    if (pw.length < 8) { setPwError("Mínimo 8 caracteres"); return; }
    if (pw !== pw2) { setPwError("Las contraseñas no coinciden"); return; }
    setPwSaving(true);
    const { createBrowserClient } = await import("@supabase/ssr");
    const sb = createBrowserClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
    const { error } = await sb.auth.updateUser({ password: pw });
    if (error) setPwError(error.message);
    else { setShowPwForm(false); revalidator.revalidate(); }
    setPwSaving(false);
  };

  const cardBase = "group flex items-center gap-3 rounded-xl border px-4 py-3.5 transition-all duration-200";
  const cardOn = "border-emerald-500/20 bg-emerald-500/[0.03] hover:border-emerald-500/30";
  const cardOff = "border-border bg-surface hover:border-text-muted/20";
  const badge = "inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-500";
  const btnLink = "flex items-center gap-1.5 rounded-lg bg-brand/10 px-3 py-1.5 text-[11px] font-medium text-brand transition-all hover:bg-brand/20 disabled:opacity-50";
  const btnUnlink = "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-text-muted transition-all hover:bg-red-500/10 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed";

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <Link2 size={16} className="text-text-muted" /> Proveedores de Identidad
        </h4>
        <p className="text-xs text-text-muted mt-1">Vincula múltiples cuentas para iniciar sesión con cualquiera de ellas</p>
      </div>

      <div className="space-y-2">
        {PROVIDERS.map((p) => {
          const id = identities.find((i: any) => i.provider === p.id);
          const on = !!id;
          const only = total <= 1;
          return (
            <div key={p.id} className={`${cardBase} ${on ? cardOn : cardOff}`}>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${on ? "bg-emerald-500/10" : "bg-muted"}`}>
                <ProviderIcon provider={p.id} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-text-primary">{p.label}</p>
                  {on && <span className={badge}><CheckCircle2 size={10} /> Conectado</span>}
                </div>
                <p className="text-[11px] text-text-muted truncate">
                  {on ? `${id.email || "—"} · desde ${new Date(id.created_at).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })}` : `Inicia sesión con ${p.label}`}
                </p>
              </div>
              <div className="shrink-0">
                {on ? (
                  confirmId === p.id ? (
                    <div className="flex items-center gap-1.5 animate-in fade-in duration-200">
                      <button onClick={() => doUnlink(id.identity_id, p.id)} disabled={only || unlinking === id.identity_id}
                        className="rounded-lg bg-red-500/10 px-2.5 py-1.5 text-[11px] font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-40">
                        {unlinking ? "…" : "Confirmar"}
                      </button>
                      <button onClick={() => setConfirmId(null)} className="rounded-lg px-2 py-1.5 text-[11px] text-text-muted hover:text-text-primary">No</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmId(p.id)} disabled={only} title={only ? "No puedes desvincular tu única identidad" : ""} className={btnUnlink}>
                      <Unlink size={12} /> Desvincular
                    </button>
                  )
                ) : (
                  <button onClick={() => doLink(p.id)} disabled={!!linking} className={btnLink}>
                    {linking === p.id ? <div className="h-3 w-3 animate-spin rounded-full border-2 border-brand border-t-transparent" /> : <Link2 size={12} />}
                    Vincular
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Email + Password */}
        <div className={`${cardBase} ${hasPassword ? cardOn : cardOff}`}>
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${hasPassword ? "bg-emerald-500/10" : "bg-muted"}`}>
            <Lock size={18} className={hasPassword ? "text-emerald-500" : "text-text-muted"} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-text-primary">Email y Contraseña</p>
              {hasPassword && <span className={badge}><CheckCircle2 size={10} /> Configurado</span>}
            </div>
            <p className="text-[11px] text-text-muted">{hasPassword ? "Contraseña configurada como respaldo" : "Agrega una contraseña de respaldo"}</p>
          </div>
          {!hasPassword && (
            <button onClick={() => setShowPwForm(!showPwForm)} className={btnLink}><Lock size={12} /> Configurar</button>
          )}
        </div>

        {showPwForm && !hasPassword && (
          <form onSubmit={doPw} className="rounded-xl border border-brand/20 bg-brand/5 p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
            <input type="password" name="password" placeholder="Nueva contraseña (mín. 8 caracteres)" required minLength={8}
              className="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-brand" />
            <input type="password" name="password_confirm" placeholder="Confirmar contraseña" required minLength={8}
              className="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-brand" />
            <div className="flex items-center gap-2">
              <button type="submit" disabled={pwSaving}
                className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50">
                {pwSaving ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Lock size={14} />}
                {pwSaving ? "Guardando..." : "Guardar Contraseña"}
              </button>
              <button type="button" onClick={() => { setShowPwForm(false); setPwError(null); }}
                className="rounded-lg px-3 py-2 text-sm text-text-muted hover:text-text-primary">Cancelar</button>
            </div>
            {pwError && <p className="flex items-center gap-1.5 text-xs text-red-500"><AlertTriangle size={12} /> {pwError}</p>}
          </form>
        )}

        {/* Passkeys → redirect to security tab */}
        <div className={`${cardBase} ${passkeys.length > 0 ? "border-emerald-500/20 bg-emerald-500/[0.03]" : cardOff}`}>
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${passkeys.length > 0 ? "bg-emerald-500/10" : "bg-muted"}`}>
            <Fingerprint size={18} className={passkeys.length > 0 ? "text-emerald-500" : "text-text-muted"} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-text-primary">Passkeys</p>
              {passkeys.length > 0 && <span className={badge}><CheckCircle2 size={10} /> {passkeys.length} {passkeys.length === 1 ? "dispositivo" : "dispositivos"}</span>}
            </div>
            <p className="text-[11px] text-text-muted">
              {passkeys.length > 0 ? passkeys.map((pk: any) => pk.friendly_name || "Passkey").join(", ") : "Autenticación biométrica"}
            </p>
          </div>
          <button onClick={() => onNavigate("security")}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-text-muted hover:bg-muted hover:text-text-primary">
            Gestionar <ChevronRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

function LoginHistorySection({ history }: { history: any[] }) {
  if (history.length === 0) return null;

  const deviceIcon = (type: string) => {
    if (type === "mobile") return <Smartphone size={14} />;
    return <Monitor size={14} />;
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
        <Clock size={16} className="text-text-muted" /> Historial de Inicio de Sesión
      </h4>
      <div className="space-y-1.5">
        {history.map((entry: any) => (
          <div key={entry.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${entry.success ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
              {deviceIcon(entry.device_type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-text-primary">
                {entry.browser || "Navegador"} · {entry.os || "OS"}
              </p>
              <p className="text-[10px] text-text-muted flex items-center gap-1">
                <Globe size={9} /> {entry.ip_address || "—"}
                {entry.city && ` · ${entry.city}`}
                {entry.country && `, ${entry.country}`}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] tabular-nums text-text-muted">
                {new Date(entry.created_at).toLocaleDateString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Reusable Field Components ──────────────────────────

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted">{title}</h4>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({ label, name, defaultValue, type = "text", multiline = false }: {
  label: string; name: string; defaultValue?: string; type?: string; multiline?: boolean;
}) {
  const cls = "w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none transition-colors focus:border-brand";
  return (
    <div className={multiline ? "sm:col-span-2" : ""}>
      <label className="mb-1 block text-[11px] font-medium text-text-muted">{label}</label>
      {multiline ? (
        <textarea name={name} defaultValue={defaultValue || ""} rows={3} className={cls + " resize-none"} />
      ) : (
        <input type={type} name={name} defaultValue={defaultValue || ""} className={cls} />
      )}
    </div>
  );
}

function SelectField({ label, name, defaultValue, options }: {
  label: string; name: string; defaultValue: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-text-muted">{label}</label>
      <select name={name} defaultValue={defaultValue}
        className="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-brand"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────

const SECTIONS = [
  { id: "personal", label: "Datos Personales", icon: User },
  { id: "accounts", label: "Cuentas Vinculadas", icon: Link2 },
  { id: "security", label: "Seguridad", icon: Shield },
  { id: "history", label: "Historial", icon: Clock },
];

export default function PerfilPage() {
  const { profile, passkeys, loginHistory, identities, hasPassword, userEmail, userMeta } = useLoaderData<typeof loader>() as any;
  const data = useOutletContext<TenantContext>();
  const [activeSection, setActiveSection] = useState("personal");

  // Success/error toasts from linking redirect
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Read tab + toast from URL after hydration (avoids SSR mismatch)
  useState(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab) setActiveSection(tab);
    if (params.get("linked") === "success") setToast({ type: "success", msg: "Cuenta vinculada exitosamente" });
    if (params.get("error") === "link_failed") setToast({ type: "error", msg: "Error al vincular cuenta" });
  });

  return (
    <div className="animate-in fade-in duration-500 mx-auto max-w-[900px]">
      {/* Toast */}
      {toast && (
        <div className={`mb-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium animate-in slide-in-from-top duration-300 ${
          toast.type === "success" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
        }`}>
          {toast.type === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {toast.msg}
          <button onClick={() => setToast(null)} className="ml-auto text-current opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <a href="/dashboard" className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-text-muted transition-colors hover:bg-muted mb-4">
          <ArrowLeft size={16} /> Dashboard
        </a>
        <h1 className="text-2xl font-bold text-text-primary">Mi Perfil</h1>
        <p className="text-sm text-text-muted">Gestiona tu información personal, seguridad y preferencias</p>
      </div>

      {/* Section tabs */}
      <div className="mb-6 flex gap-1 border-b border-border overflow-x-auto">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-all ${
              activeSection === s.id ? "border-brand text-text-primary" : "border-transparent text-text-muted hover:text-text-secondary"
            }`}
          >
            <s.icon size={16} /> {s.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="rounded-2xl border border-border bg-surface p-6">
        {activeSection === "personal" && (
          <ProfileSection profile={profile} userEmail={userEmail} userMeta={userMeta} />
        )}
        {activeSection === "accounts" && (
          <LinkedAccountsSection
            identities={identities}
            hasPassword={hasPassword}
            passkeys={passkeys}
            env={data.env}
            onNavigate={setActiveSection}
          />
        )}
        {activeSection === "security" && (
          <PasskeySection passkeys={passkeys} />
        )}
        {activeSection === "history" && (
          <LoginHistorySection history={loginHistory} />
        )}
      </div>
    </div>
  );
}

export function ErrorBoundary({ error }: { error: unknown }) {
  return <RouteErrorBoundary error={error} moduleName="Perfil" />;
}
