import { redirect, useLoaderData, useFetcher } from "react-router";
import type { Route } from "./+types/admin.notifications";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { requirePlatformAdmin, requirePlatformPermission } from "~/lib/platform-rbac/guard.server";
import { logAuditEvent, getClientIP } from "~/lib/audit";
import {
  Bell, Send, Plus, Clock, CheckCircle2, AlertTriangle,
  Info, Wrench, Sparkles, Eye, Trash2, X,
} from "lucide-react";
import { useState } from "react";

const TYPE_META: Record<string, { label: string; color: string; icon: any }> = {
  info: { label: "Información", color: "#3B82F6", icon: Info },
  warning: { label: "Advertencia", color: "#F59E0B", icon: AlertTriangle },
  maintenance: { label: "Mantenimiento", color: "#EF4444", icon: Wrench },
  update: { label: "Actualización", color: "#10B981", icon: Sparkles },
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  draft: { label: "Borrador", color: "#71717A" },
  sent: { label: "Enviada", color: "#10B981" },
  scheduled: { label: "Programada", color: "#F59E0B" },
};

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { adminCtx, supabaseHeaders: headers } = await requirePlatformAdmin(request, env, context);
  requirePlatformPermission(adminCtx, "admin.notifications.view", headers);

  const admin = createSupabaseAdminClient(env);

  const [notificationsRes, orgsRes] = await Promise.all([
    admin.from("platform_notifications").select("*").order("created_at", { ascending: false }),
    admin.from("organizations").select("id, name").order("name"),
  ]);

  return Response.json({
    notifications: notificationsRes.data || [],
    organizations: orgsRes.data || [],
  }, { headers });
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const { adminCtx, supabaseHeaders: headers } = await requirePlatformAdmin(request, env, context);
  requirePlatformPermission(adminCtx, "admin.notifications.broadcast", headers);

  const admin = createSupabaseAdminClient(env);

  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const ip = getClientIP(request);

  if (intent === "create") {
    const title = formData.get("title") as string;
    const message = formData.get("message") as string;
    const type = formData.get("type") as string || "info";
    const audienceType = formData.get("audience_type") as string || "all";
    const audienceOrgs = formData.get("audience_orgs") as string || "";
    const sendNow = formData.get("send_now") === "true";

    const audience = audienceType === "all"
      ? { type: "all" }
      : audienceType === "orgs"
        ? { type: "orgs", org_ids: audienceOrgs.split(",").filter(Boolean) }
        : { type: "all" };

    const { data: notif, error } = await admin.from("platform_notifications").insert({
      title, message, type, audience,
      status: sendNow ? "sent" : "draft",
      sent_at: sendNow ? new Date().toISOString() : null,
      sent_by: sendNow ? adminCtx.userId : null,
    }).select().single();

    if (error) return Response.json({ error: error.message }, { status: 400, headers });

    await logAuditEvent(admin, {
      actorId: adminCtx.userId, action: "notification.create", entityType: "platform_notification",
      entityId: notif.id, metadata: { title, type, audience, sent: sendNow }, ipAddress: ip,
    });

    return Response.json({ success: true }, { headers });
  }

  if (intent === "send") {
    const notifId = formData.get("notification_id") as string;
    await admin.from("platform_notifications").update({
      status: "sent", sent_at: new Date().toISOString(), sent_by: adminCtx.userId,
    }).eq("id", notifId);

    await logAuditEvent(admin, {
      actorId: adminCtx.userId, action: "notification.send", entityType: "platform_notification",
      entityId: notifId, ipAddress: ip,
    });

    return Response.json({ success: true }, { headers });
  }

  if (intent === "delete") {
    const notifId = formData.get("notification_id") as string;
    await admin.from("platform_notifications").delete().eq("id", notifId);

    await logAuditEvent(admin, {
      actorId: adminCtx.userId, action: "notification.delete", entityType: "platform_notification",
      entityId: notifId, ipAddress: ip,
    });

    return Response.json({ success: true }, { headers });
  }

  return Response.json({ error: "Unknown intent" }, { status: 400, headers });
}

export default function AdminNotifications() {
  const { notifications, organizations } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [showCreate, setShowCreate] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("info");
  const [audienceType, setAudienceType] = useState("all");
  const [selectedOrgs, setSelectedOrgs] = useState<string[]>([]);

  const handleCreate = (sendNow: boolean) => {
    fetcher.submit({
      intent: "create", title, message, type,
      audience_type: audienceType,
      audience_orgs: selectedOrgs.join(","),
      send_now: sendNow ? "true" : "false",
    }, { method: "post" });
    setShowCreate(false);
    setTitle(""); setMessage(""); setType("info"); setAudienceType("all"); setSelectedOrgs([]);
  };

  const previewNotif = notifications.find((n: any) => n.id === previewId);

  return (
    <div className="space-y-6">
      {/* ═══ Header ═══ */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: "#EC489815" }}>
            <Bell size={17} style={{ color: "#EC4899" }} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-text-primary">Notificaciones</h1>
            <p className="text-[11px] text-text-muted">Centro de broadcast para todos los tenants · {notifications.length} notificaciones</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-[12px] font-medium text-white transition-all hover:opacity-90 active:scale-[0.97]"
          style={{ boxShadow: "0 4px 14px rgba(124,58,237,0.3)" }}
        >
          <Plus size={14} /> Nueva Notificación
        </button>
      </div>

      {/* ═══ Create Form ═══ */}
      {showCreate && (
        <div className="rounded-2xl border border-border bg-surface p-6">
          <h3 className="mb-4 text-[13px] font-bold text-text-primary">Crear Notificación</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-text-muted">Título</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título de la notificación"
                  className="w-full rounded-xl border border-border bg-bg-primary px-3 py-2.5 text-xs text-text-primary outline-none focus:border-brand" />
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-text-muted">Tipo</label>
                <div className="flex gap-2">
                  {Object.entries(TYPE_META).map(([key, meta]) => {
                    const Icon = meta.icon;
                    return (
                      <button key={key} onClick={() => setType(key)}
                        className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-medium transition-all ${
                          type === key ? "border-brand/30 bg-brand/5 text-brand" : "border-border text-text-muted hover:bg-muted"
                        }`}
                      >
                        <Icon size={12} style={{ color: type === key ? meta.color : undefined }} />
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-text-muted">Mensaje</label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Escribe el mensaje para los tenants…"
                className="w-full rounded-xl border border-border bg-bg-primary px-3 py-2.5 text-xs text-text-primary outline-none focus:border-brand resize-none" />
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-text-muted">Audiencia</label>
              <div className="flex gap-2">
                <button onClick={() => setAudienceType("all")}
                  className={`rounded-xl border px-3 py-2 text-[11px] font-medium ${audienceType === "all" ? "border-brand bg-brand/5 text-brand" : "border-border text-text-muted hover:bg-muted"}`}
                >
                  Todas las Organizaciones
                </button>
                <button onClick={() => setAudienceType("orgs")}
                  className={`rounded-xl border px-3 py-2 text-[11px] font-medium ${audienceType === "orgs" ? "border-brand bg-brand/5 text-brand" : "border-border text-text-muted hover:bg-muted"}`}
                >
                  Organizaciones Específicas
                </button>
              </div>
              {audienceType === "orgs" && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {organizations.map((org: any) => (
                    <button key={org.id}
                      onClick={() => setSelectedOrgs((prev) => prev.includes(org.id) ? prev.filter((o) => o !== org.id) : [...prev, org.id])}
                      className={`rounded-lg border px-2.5 py-1 text-[10px] font-medium transition-all ${
                        selectedOrgs.includes(org.id) ? "border-brand bg-brand/10 text-brand" : "border-border text-text-muted hover:bg-muted"
                      }`}
                    >
                      {org.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button onClick={() => handleCreate(true)} disabled={!title || !message}
                className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
              >
                <Send size={13} /> Enviar Ahora
              </button>
              <button onClick={() => handleCreate(false)} disabled={!title || !message}
                className="rounded-xl border border-border px-4 py-2 text-xs font-medium text-text-secondary hover:bg-muted disabled:opacity-50"
              >
                Guardar como Borrador
              </button>
              <button onClick={() => setShowCreate(false)}
                className="text-xs text-text-muted hover:text-text-primary"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Notifications List ═══ */}
      <div className="space-y-3">
        {notifications.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface px-6 py-12 text-center">
            <Bell size={28} className="mx-auto mb-3 text-text-muted opacity-50" />
            <p className="text-[12px] text-text-muted">No hay notificaciones creadas</p>
          </div>
        ) : notifications.map((notif: any) => {
          const typeMeta = TYPE_META[notif.type] || TYPE_META.info;
          const statusMeta = STATUS_META[notif.status] || STATUS_META.draft;
          const TypeIcon = typeMeta.icon;
          const isPreview = previewId === notif.id;

          return (
            <div key={notif.id} className="rounded-2xl border border-border bg-surface transition-all hover:border-brand/20">
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${typeMeta.color}12` }}>
                  <TypeIcon size={18} style={{ color: typeMeta.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[13px] font-bold text-text-primary">{notif.title}</h3>
                    <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider" style={{ backgroundColor: `${typeMeta.color}15`, color: typeMeta.color }}>
                      {typeMeta.label}
                    </span>
                    <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider" style={{ backgroundColor: `${statusMeta.color}15`, color: statusMeta.color }}>
                      {statusMeta.label}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-text-muted">{notif.message}</p>
                  <p className="mt-1 text-[9px] text-text-muted">
                    {notif.audience?.type === "all" ? "Todas las orgs" : `${notif.audience?.org_ids?.length || 0} orgs`}
                    {notif.sent_at && ` · Enviada ${new Date(notif.sent_at).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPreviewId(isPreview ? null : notif.id)}
                    className="rounded-lg p-2 text-text-muted transition-colors hover:bg-muted hover:text-text-primary"
                    title="Preview"
                  >
                    <Eye size={14} />
                  </button>
                  {notif.status === "draft" && (
                    <button onClick={() => fetcher.submit({ intent: "send", notification_id: notif.id }, { method: "post" })}
                      className="flex items-center gap-1 rounded-lg bg-brand/10 px-2.5 py-1.5 text-[10px] font-medium text-brand hover:bg-brand/20"
                    >
                      <Send size={11} /> Enviar
                    </button>
                  )}
                  <button onClick={() => fetcher.submit({ intent: "delete", notification_id: notif.id }, { method: "post" })}
                    className="rounded-lg p-2 text-text-muted transition-colors hover:bg-error/10 hover:text-error"
                    title="Eliminar"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Preview */}
              {isPreview && (
                <div className="border-t border-border px-5 py-4">
                  <div className="rounded-xl border border-border bg-bg-primary p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <TypeIcon size={14} style={{ color: typeMeta.color }} />
                      <span className="text-[12px] font-bold text-text-primary">{notif.title}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-text-secondary">{notif.message}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
