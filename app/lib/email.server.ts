/**
 * Servicio de email para GRIXI usando Resend API
 * Envía emails transaccionales desde noreply@grixi.ai
 * Usa fetch directo — compatible con Cloudflare Workers (no requiere SDK)
 *
 * Configuración:
 *   - Secret: RESEND_API_KEY (en Cloudflare Workers secrets)
 *   - Dominio: grixi.ai (verificado en Resend)
 *   - From: GRIXI <noreply@grixi.ai>
 *
 * Uso:
 *   import { sendInvitationEmail } from "~/lib/email.server";
 *   const result = await sendInvitationEmail(env.RESEND_API_KEY, { ... });
 */

// ─── Types ────────────────────────────────────────────

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

interface InvitationEmailParams {
  to: string;
  inviterName: string;
  orgName: string;
  roleName: string;
  invitationLink: string;
  expiresAt: string;
}

// ─── Core Email Sender ────────────────────────────────

/**
 * Envía un email usando la API de Resend (fetch directo, sin SDK).
 *
 * @param resendApiKey - API key de Resend (secret de Cloudflare)
 * @param params - Datos del email (to, subject, html, from)
 * @returns { success, error?, id? }
 *
 * @example
 * const result = await sendEmail(env.RESEND_API_KEY, {
 *   to: "user@example.com",
 *   subject: "Bienvenido a GRIXI",
 *   html: "<h1>Hola</h1>",
 * });
 */
export async function sendEmail(
  resendApiKey: string,
  params: SendEmailParams,
): Promise<{ success: boolean; error?: string; id?: string }> {
  const { to, subject, html, from = "GRIXI <noreply@grixi.ai>" } = params;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });

    const data = (await response.json()) as any;

    if (!response.ok) {
      console.error("[EMAIL] Resend error:", data);
      return {
        success: false,
        error: data?.message || `HTTP ${response.status}`,
      };
    }

    return { success: true, id: data.id };
  } catch (err: any) {
    console.error("[EMAIL] Send failed:", err);
    return { success: false, error: err.message };
  }
}

// ─── Email Base Layout ────────────────────────────────

function emailLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GRIXI</title>
</head>
<body style="margin:0;padding:0;background-color:#0c0c0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0c0c0f;">
    <tr>
      <td align="center" style="padding:48px 24px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          <!-- Header with Logo -->
          <tr>
            <td align="center" style="padding-bottom:36px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:linear-gradient(135deg,#7c3aed 0%,#a855f7 50%,#c084fc 100%);border-radius:14px;padding:12px 32px;">
                    <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:3px;text-transform:uppercase;">GRIXI</span>
                  </td>
                </tr>
              </table>
              <p style="margin:12px 0 0;font-size:12px;color:#525252;letter-spacing:0.5px;">PLATAFORMA ENTERPRISE</p>
            </td>
          </tr>
          <!-- Content Card -->
          <tr>
            <td style="background-color:#161618;border:1px solid rgba(124,58,237,0.15);border-radius:16px;overflow:hidden;">
              <!-- Purple accent bar -->
              <div style="height:3px;background:linear-gradient(90deg,#7c3aed,#a855f7,#c084fc,#a855f7,#7c3aed);"></div>
              <div style="padding:40px 36px;">
                ${content}
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding-top:32px;text-align:center;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:16px;">
                    <div style="width:40px;height:1px;background:linear-gradient(90deg,transparent,#333,transparent);"></div>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <p style="margin:0 0 8px;font-size:11px;color:#525252;">
                      © ${new Date().getFullYear()} GRIXI · Plataforma Enterprise Multi-Tenant
                    </p>
                    <p style="margin:0;font-size:11px;">
                      <a href="https://grixi.ai" style="color:#7c3aed;text-decoration:none;">grixi.ai</a>
                      <span style="color:#333;margin:0 8px;">·</span>
                      <a href="mailto:soporte@grixi.ai" style="color:#525252;text-decoration:none;">soporte@grixi.ai</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Invitation Email ─────────────────────────────────

/**
 * Genera y envía el email de invitación a una organización.
 *
 * @example
 * await sendInvitationEmail(env.RESEND_API_KEY, {
 *   to: "usuario@empresa.com",
 *   inviterName: "Diego Mera",
 *   orgName: "Acme Corp",
 *   roleName: "admin",
 *   invitationLink: "https://acme.grixi.ai/?invitation=uuid",
 *   expiresAt: "2026-04-06T00:00:00Z",
 * });
 */
export async function sendInvitationEmail(
  resendApiKey: string,
  params: InvitationEmailParams,
): Promise<{ success: boolean; error?: string }> {
  const { to, inviterName, orgName, roleName, invitationLink, expiresAt } =
    params;

  const expiresDate = new Date(expiresAt).toLocaleDateString("es", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // Role display with badge color
  const roleColors: Record<string, string> = {
    owner: "#a855f7",
    admin: "#6366f1",
    manager: "#3b82f6",
    member: "#22c55e",
    viewer: "#737373",
  };
  const roleColor =
    roleColors[roleName.toLowerCase()] || roleColors["member"];

  const content = `
    <!-- Title -->
    <h1 style="margin:0 0 6px;font-size:24px;font-weight:700;color:#f5f5f5;text-align:center;line-height:1.3;">
      Has sido invitado
    </h1>
    <p style="margin:0 0 28px;font-size:15px;color:#a3a3a3;text-align:center;line-height:1.5;">
      <strong style="color:#e5e5e5;">${inviterName}</strong> te ha invitado a unirte a
    </p>

    <!-- Org Info Card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr>
        <td style="background-color:#1c1c1f;border:1px solid #2a2a2e;border-radius:12px;padding:24px;text-align:center;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="padding-bottom:12px;">
                <!-- Org icon circle -->
                <div style="display:inline-block;width:48px;height:48px;line-height:48px;text-align:center;background:linear-gradient(135deg,#7c3aed,#a855f7);border-radius:12px;font-size:20px;font-weight:800;color:#fff;">
                  ${orgName.charAt(0).toUpperCase()}
                </div>
              </td>
            </tr>
            <tr>
              <td align="center">
                <p style="margin:0 0 4px;font-size:20px;font-weight:700;color:#f5f5f5;">${orgName}</p>
                <p style="margin:0;font-size:13px;color:#a3a3a3;">
                  Tu rol: <span style="display:inline-block;background:${roleColor};color:#fff;font-weight:600;font-size:11px;padding:2px 10px;border-radius:20px;text-transform:uppercase;letter-spacing:0.5px;">${roleName}</span>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- What you'll get -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr>
        <td style="padding:0 4px;">
          <p style="margin:0 0 12px;font-size:12px;font-weight:600;color:#737373;text-transform:uppercase;letter-spacing:1px;">Al unirte tendrás acceso a</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#a3a3a3;">
                <span style="color:#a855f7;margin-right:8px;">✦</span> Dashboard personalizado con KPIs en tiempo real
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#a3a3a3;">
                <span style="color:#a855f7;margin-right:8px;">✦</span> Módulos de gestión empresarial (Finanzas, Almacenes, Compras)
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#a3a3a3;">
                <span style="color:#a855f7;margin-right:8px;">✦</span> Asistente AI con Gemini para análisis inteligente
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- CTA Button -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:4px 0 28px;">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${invitationLink}" style="height:48px;width:280px;v-text-anchor:middle;" arcsize="21%" fillcolor="#7c3aed">
            <w:anchorlock/>
            <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:bold;">Aceptar Invitación →</center>
          </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-->
          <a href="${invitationLink}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#9333ea);color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 48px;border-radius:10px;box-shadow:0 4px 14px rgba(124,58,237,0.4);">
            Aceptar Invitación →
          </a>
          <!--<![endif]-->
        </td>
      </tr>
    </table>

    <!-- Divider -->
    <div style="height:1px;background:linear-gradient(90deg,transparent,#2a2a2e,transparent);margin-bottom:20px;"></div>

    <!-- Metadata -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="font-size:12px;color:#525252;line-height:1.6;text-align:center;">
          <p style="margin:0 0 4px;">
            ⏱ Esta invitación expira el <strong style="color:#737373;">${expiresDate}</strong>
          </p>
          <p style="margin:0;">
            Si no esperabas este correo, puedes ignorarlo de forma segura.
          </p>
        </td>
      </tr>
    </table>`;

  const subject =
    orgName === "GRIXI"
      ? `${inviterName} te invitó a GRIXI`
      : `${inviterName} te invitó a ${orgName} en GRIXI`;

  return sendEmail(resendApiKey, {
    to,
    subject,
    html: emailLayout(content),
  });
}
