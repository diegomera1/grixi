/**
 * GRIXI — FormData Parser con Zod
 * 
 * Utilidad para parsear y validar FormData contra un schema de Zod.
 * Retorna un resultado tipado o un error formateado listo para Response.json().
 * 
 * @module lib/validation/parse
 */

import { z } from "zod";

interface ParseSuccess<T> {
  success: true;
  data: T;
}

interface ParseError {
  success: false;
  error: string;
  fieldErrors: Record<string, string[]>;
}

type ParseResult<T> = ParseSuccess<T> | ParseError;

/**
 * Parsea FormData contra un schema de Zod y retorna datos tipados o errores.
 * 
 * @example
 * ```ts
 * const result = parseFormData(formData, schemas.invite);
 * if (!result.success) {
 *   return Response.json({ error: result.error, fieldErrors: result.fieldErrors }, { status: 400 });
 * }
 * const { email, role_id } = result.data; // ← tipado correctamente
 * ```
 */
export function parseFormData<T extends z.ZodType>(
  formData: FormData,
  schema: T
): ParseResult<z.infer<T>> {
  // Convert FormData to plain object
  const raw: Record<string, unknown> = {};
  formData.forEach((value, key) => {
    // Skip File values — those are handled separately (logo upload, avatar, etc.)
    if (value instanceof File) return;
    raw[key] = value;
  });

  const result = schema.safeParse(raw);

  if (result.success) {
    return { success: true, data: result.data };
  }

  // Format errors for display
  const fieldErrors: Record<string, string[]> = {};
  const messages: string[] = [];

  for (const issue of result.error.issues) {
    const path = issue.path.join(".") || "_root";
    if (!fieldErrors[path]) fieldErrors[path] = [];
    fieldErrors[path].push(issue.message);
    messages.push(`${path}: ${issue.message}`);
  }

  return {
    success: false,
    error: messages[0] || "Datos inválidos", // First error as main message
    fieldErrors,
  };
}

/**
 * Shorthand: parsea y retorna error Response si falla.
 * Retorna `null` si la validación falla (ya envió la Response),
 * o los datos tipados si pasa.
 * 
 * @example
 * ```ts
 * const data = validateAction(formData, schemas.invite, headers);
 * if (data instanceof Response) return data;
 * // data está tipado correctamente
 * ```
 */
export function validateAction<T extends z.ZodType>(
  formData: FormData,
  schema: T,
  headers?: HeadersInit
): z.infer<T> | Response {
  const result = parseFormData(formData, schema);
  if (!result.success) {
    return Response.json(
      { error: result.error, fieldErrors: result.fieldErrors },
      { status: 400, headers }
    );
  }
  return result.data;
}
