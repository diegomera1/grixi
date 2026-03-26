import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes with clsx */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Extract initials from a name (max 2 chars) */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Extract subdomain from hostname */
export function getSubdomain(hostname: string): string | null {
  const parts = hostname.split(".");
  // localhost or IP
  if (parts.length <= 1 || hostname.includes("localhost")) return null;
  // e.g. empresa.grixi.io → "empresa"
  if (parts.length >= 3) return parts[0];
  return null;
}
