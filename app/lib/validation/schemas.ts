/**
 * GRIXI — Validación con Zod
 * 
 * Sistema centralizado de validación de inputs para todos los actions.
 * Cada schema corresponde a un intent específico de un action.
 * 
 * Uso:
 *   const { data, error } = parseFormData(formData, schemas.invite);
 *   if (error) return Response.json({ error }, { status: 400 });
 *   // data está tipado correctamente
 * 
 * @module lib/validation
 */

import { z } from "zod";

// ─── Primitivos Reutilizables ─────────────────────────────

/** UUID v4 — usado para IDs de entidades */
const uuid = z.string().uuid("ID inválido");

/** Email — validación estricta */
const email = z.string().email("Email inválido").toLowerCase().trim();

/** Nombre — 1-100 caracteres, sin espacios extremos */
const name = z.string().min(1, "Nombre requerido").max(100, "Nombre muy largo").trim();

/** Color hexadecimal — #RRGGBB */
const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color hexadecimal inválido").optional().default("#7c3aed");

/** Dominio — example.com */
const domain = z.string().regex(/^[a-z0-9]+([\-.][a-z0-9]+)*\.[a-z]{2,}$/, "Dominio inválido").toLowerCase().trim();

/** Intent — string no vacío para routing de actions */
const intent = z.string().min(1, "Intent requerido");

// ─── Schemas por Módulo ───────────────────────────────────

// ── Equipo (configuracion/equipo.tsx) ──

const changeRole = z.object({
  intent: z.literal("change_role"),
  membership_id: uuid,
  role_id: uuid,
});

const suspendMember = z.object({
  intent: z.literal("suspend"),
  membership_id: uuid,
  user_id: uuid,
});

const reactivateMember = z.object({
  intent: z.literal("reactivate"),
  membership_id: uuid,
});

const removeMember = z.object({
  intent: z.literal("remove"),
  membership_id: uuid,
  user_id: uuid,
});

// ── Roles (configuracion/roles.tsx) ──

const createRole = z.object({
  intent: z.literal("create_role"),
  name: name,
  description: z.string().max(500, "Descripción muy larga").optional().default(""),
  hierarchy_level: z.coerce.number().int().min(1).max(99).default(30),
});

const updatePermissions = z.object({
  intent: z.literal("update_permissions"),
  role_id: uuid,
  permission_ids: z.string().transform((val) => {
    try {
      const parsed = JSON.parse(val);
      return z.array(uuid).parse(parsed);
    } catch {
      throw new Error("permission_ids debe ser un JSON array de UUIDs");
    }
  }),
});

const deleteRole = z.object({
  intent: z.literal("delete_role"),
  role_id: uuid,
});

// ── Organización (configuracion/organizacion.tsx) ──

const updateOrg = z.object({
  intent: z.literal("update_org"),
  name: name,
  timezone: z.string().min(1, "Timezone requerido"),
  currency: z.string().length(3, "Moneda debe ser código ISO de 3 letras").toUpperCase(),
  primary_color: hexColor,
  billing_email: email.optional().default(""),
});

const addDomain = z.object({
  intent: z.literal("add_domain"),
  domain: domain,
  auto_role: z.enum(["owner", "admin", "member", "viewer"]).default("member"),
});

const removeDomain = z.object({
  intent: z.literal("remove_domain"),
  domain_id: uuid,
});

// ── Invitaciones (configuracion/invitaciones.tsx) ──

const invite = z.object({
  intent: z.literal("invite"),
  email: email,
  role_id: uuid,
});

const cancelInvitation = z.object({
  intent: z.literal("cancel"),
  invitation_id: uuid,
});

const resendInvitation = z.object({
  intent: z.literal("resend"),
  invitation_id: uuid,
});

// ── Perfil (configuracion/perfil.tsx) ──

const updatePreference = z.object({
  intent: z.literal("update_preference"),
  key: z.string().min(1, "Clave requerida").max(50),
  value: z.string().max(500),
});

const updateProfile = z.object({
  intent: z.literal("update_profile"),
  name: name,
});

// ── Select Org ──

const selectOrg = z.object({
  orgId: uuid,
});

// ─── Exports ──────────────────────────────────────────────

export const schemas = {
  // Equipo
  changeRole,
  suspendMember,
  reactivateMember,
  removeMember,

  // Roles
  createRole,
  updatePermissions,
  deleteRole,

  // Organización
  updateOrg,
  addDomain,
  removeDomain,

  // Invitaciones
  invite,
  cancelInvitation,
  resendInvitation,

  // Perfil
  updatePreference,
  updateProfile,

  // Select Org
  selectOrg,
} as const;

// Re-export tipos inferidos para uso en componentes
export type ChangeRoleInput = z.infer<typeof changeRole>;
export type InviteInput = z.infer<typeof invite>;
export type CreateRoleInput = z.infer<typeof createRole>;
export type UpdateOrgInput = z.infer<typeof updateOrg>;
