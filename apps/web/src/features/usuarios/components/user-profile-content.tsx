"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  Briefcase,
  Shield,
  Clock,
  Activity,
  Edit,
  Camera,
  Loader2,
  Check,
} from "lucide-react";
import { uploadAvatar } from "../actions/upload-avatar";
import { PasskeySettings } from "./passkey-settings";

type Profile = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  email: string;
  phone: string | null;
  department: string | null;
  position: string | null;
  bio: string | null;
  last_active_at: string | null;
  created_at: string;
};

type Role = { name: string; color: string; description: string };
type Organization = { name: string; slug: string };
type AuditLog = {
  id: string;
  action: string;
  resource_type: string;
  new_data: { description?: string } | null;
  created_at: string;
};

type UserProfileContentProps = {
  profile: Profile;
  roles: Role[];
  organizations: Organization[];
  recentActivity: AuditLog[];
  isOwnProfile?: boolean;
};

const actionLabels: Record<string, string> = {
  create: "Creó",
  update: "Actualizó",
  delete: "Eliminó",
};

const resourceLabels: Record<string, string> = {
  user: "usuario",
  warehouse: "almacén",
  product: "producto",
  inventory: "inventario",
  role: "rol",
  session: "sesión",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 5) return "En línea";
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

export function UserProfileContent({
  profile,
  roles,
  organizations,
  recentActivity,
  isOwnProfile = false,
}: UserProfileContentProps) {
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(false);

    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const result = await uploadAvatar(formData);
      setAvatarUrl(result.avatarUrl);
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 2000);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Error al subir foto");
      setTimeout(() => setUploadError(null), 3000);
    } finally {
      setUploading(false);
      // Reset input so same file can be re-uploaded
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, []);

  return (
    <div className="w-full space-y-6">
      {/* Back button */}
      <Link
        href="/usuarios"
        className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
      >
        <ArrowLeft size={16} />
        Volver a usuarios
      </Link>

      {/* Profile header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)]"
      >
        {/* Banner */}
        <div className="h-32 bg-gradient-to-r from-[var(--brand)] to-[var(--brand-light)] opacity-90" />

        <div className="px-6 pb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
            {/* Avatar with upload overlay */}
            <div className="relative -mt-12 h-24 w-24 shrink-0 group">
              <div className="h-full w-full overflow-hidden rounded-2xl border-4 border-[var(--bg-surface)] bg-[var(--bg-muted)] shadow-lg">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={profile.full_name}
                    width={96}
                    height={96}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-[var(--text-muted)]">
                    {profile.full_name?.charAt(0)}
                  </div>
                )}
              </div>

              {/* Upload overlay — only shown for own profile */}
              {isOwnProfile && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="absolute inset-0 flex items-center justify-center rounded-2xl border-4 border-transparent bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100"
                  >
                    {uploading ? (
                      <Loader2 className="h-6 w-6 animate-spin text-white" />
                    ) : uploadSuccess ? (
                      <Check className="h-6 w-6 text-emerald-400" />
                    ) : (
                      <Camera className="h-6 w-6 text-white" />
                    )}
                  </button>
                </>
              )}
            </div>

            {/* Name + Meta */}
            <div className="flex-1 pt-2">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-[var(--text-primary)]">
                    {profile.full_name}
                  </h2>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {profile.position || "Sin cargo"}
                  </p>
                </div>
                {isOwnProfile && (
                  <button className="flex items-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-all hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]">
                    <Edit size={14} />
                    Editar
                  </button>
                )}
              </div>

              {/* Upload error */}
              <AnimatePresence>
                {uploadError && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-1 text-xs text-red-500"
                  >
                    {uploadError}
                  </motion.p>
                )}
              </AnimatePresence>

              {/* Roles badges */}
              <div className="mt-3 flex flex-wrap gap-2">
                {roles.map((role) => (
                  <span
                    key={role.name}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
                    style={{
                      backgroundColor: role.color + "18",
                      color: role.color,
                    }}
                  >
                    <Shield size={12} />
                    {role.name}
                  </span>
                ))}
                {organizations.map((org) => (
                  <span
                    key={org.slug}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-muted)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]"
                  >
                    <Building2 size={12} />
                    {org.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Info card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6"
        >
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Información de Contacto
          </h3>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--bg-muted)]">
                <Mail size={16} className="text-[var(--text-muted)]" />
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">Email</p>
                <p className="text-sm text-[var(--text-primary)]">{profile.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--bg-muted)]">
                <Phone size={16} className="text-[var(--text-muted)]" />
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">Teléfono</p>
                <p className="text-sm text-[var(--text-primary)]">
                  {profile.phone || "No registrado"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--bg-muted)]">
                <Briefcase size={16} className="text-[var(--text-muted)]" />
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">Departamento</p>
                <p className="text-sm text-[var(--text-primary)]">
                  {profile.department || "No asignado"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--bg-muted)]">
                <Clock size={16} className="text-[var(--text-muted)]" />
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">Última actividad</p>
                <p className="text-sm text-[var(--text-primary)]">
                  {profile.last_active_at ? timeAgo(profile.last_active_at) : "Sin actividad"}
                </p>
              </div>
            </div>
          </div>

          {profile.bio && (
            <>
              <hr className="border-[var(--border)]" />
              <div>
                <p className="text-xs text-[var(--text-muted)]">Bio</p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{profile.bio}</p>
              </div>
            </>
          )}
        </motion.div>

        {/* Passkey settings — own profile only */}
        {isOwnProfile && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6"
          >
            <PasskeySettings />
          </motion.div>
        )}

        {/* Activity timeline */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 lg:col-span-2"
        >
          <div className="mb-4 flex items-center gap-2">
            <Activity size={16} className="text-[var(--brand)]" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Actividad Reciente
            </h3>
          </div>

          {recentActivity.length > 0 ? (
            <div className="space-y-3">
              {recentActivity.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-[var(--bg-muted)]"
                >
                  <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[var(--brand)]" />
                  <div className="flex-1">
                    <p className="text-sm text-[var(--text-primary)]">
                      {log.new_data?.description ||
                        `${actionLabels[log.action] || log.action} ${
                          resourceLabels[log.resource_type] || log.resource_type
                        }`}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      {timeAgo(log.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">
              No hay actividad reciente registrada.
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
