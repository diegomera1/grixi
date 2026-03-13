"use client";

import { useState, useCallback } from "react";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { createClient } from "@/lib/supabase/client";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

type Passkey = {
  id: string;
  credential_id: string;
  device_name: string;
  created_at: string;
};

export function usePasskey() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = useCallback(async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token}`,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    };
  }, []);

  // ── Register a new passkey ────────────────────
  const register = useCallback(async (deviceName?: string) => {
    setLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();

      // 1. Get registration options
      const optionsRes = await fetch(
        `${SUPABASE_URL}/functions/v1/passkey-register-options`,
        { method: "POST", headers }
      );

      if (!optionsRes.ok) {
        const err = await optionsRes.json();
        throw new Error(err.error || "Failed to get options");
      }

      const options = await optionsRes.json();

      // 2. Start browser registration ceremony
      const credential = await startRegistration({ optionsJSON: options });

      // 3. Verify with server
      const verifyRes = await fetch(
        `${SUPABASE_URL}/functions/v1/passkey-register-verify`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            response: credential,
            deviceName: deviceName || getDeviceName(),
          }),
        }
      );

      if (!verifyRes.ok) {
        const err = await verifyRes.json();
        throw new Error(err.error || "Registration failed");
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al registrar passkey";
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  // ── Authenticate with passkey ────────────────
  const authenticate = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

      // 1. Get authentication options (no auth needed)
      const optionsRes = await fetch(
        `${SUPABASE_URL}/functions/v1/passkey-auth-options`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: anonKey,
          },
        }
      );

      if (!optionsRes.ok) {
        const err = await optionsRes.json();
        throw new Error(err.error || "Failed to get options");
      }

      const options = await optionsRes.json();

      // 2. Start browser authentication ceremony
      const credential = await startAuthentication({ optionsJSON: options });

      // 3. Verify with server
      const verifyRes = await fetch(
        `${SUPABASE_URL}/functions/v1/passkey-auth-verify`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: anonKey,
          },
          body: JSON.stringify({ response: credential }),
        }
      );

      if (!verifyRes.ok) {
        const err = await verifyRes.json();
        throw new Error(err.error || "Authentication failed");
      }

      const result = await verifyRes.json();

      // 4. Use the token hash to verify OTP and create session
      const supabase = createClient();
      const { error: otpError } = await supabase.auth.verifyOtp({
        token_hash: result.token_hash,
        type: "magiclink",
      });

      if (otpError) throw otpError;

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al autenticar";
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch user's passkeys ────────────────────
  const listPasskeys = useCallback(async (): Promise<Passkey[]> => {
    const supabase = createClient();
    const { data } = await supabase
      .from("user_passkeys")
      .select("id, credential_id, device_name, created_at")
      .order("created_at", { ascending: false });
    return (data as Passkey[]) || [];
  }, []);

  // ── Delete a passkey ─────────────────────────
  const deletePasskey = useCallback(async (id: string) => {
    const supabase = createClient();
    await supabase.from("user_passkeys").delete().eq("id", id);
  }, []);

  // ── Check if browser supports WebAuthn ───────
  const isSupported = typeof window !== "undefined" && !!window.PublicKeyCredential;

  return { register, authenticate, listPasskeys, deletePasskey, isSupported, loading, error };
}

// Detect device name from user agent
function getDeviceName(): string {
  if (typeof navigator === "undefined") return "Dispositivo";
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Android/.test(ua)) return "Android";
  if (/Windows/.test(ua)) return "Windows";
  return "Dispositivo";
}
