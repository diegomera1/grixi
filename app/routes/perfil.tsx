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
  AlertTriangle, Laptop, ChevronRight
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

  // Fetch linked accounts
  const { data: linkedAccounts } = await admin.from("user_linked_accounts")
    .select("*").eq("user_id", user.id);

  return Response.json({
    profile: profile || {},
    passkeys: passkeys || [],
    loginHistory: loginHistory || [],
    linkedAccounts: linkedAccounts || [],
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
  { id: "security", label: "Seguridad", icon: Shield },
  { id: "history", label: "Historial", icon: Clock },
];

export default function PerfilPage() {
  const { profile, passkeys, loginHistory, userEmail, userMeta } = useLoaderData<typeof loader>() as any;
  const data = useOutletContext<TenantContext>();
  const [activeSection, setActiveSection] = useState("personal");

  return (
    <div className="animate-in fade-in duration-500 mx-auto max-w-[900px]">
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
