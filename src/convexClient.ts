import { ConvexReactClient } from "convex/react";

export function getConvexUrl(): string | null {
  const url = (import.meta as any).env?.VITE_CONVEX_URL as string | undefined;
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  return trimmed;
}

export function createConvexClient(): ConvexReactClient | null {
  const url = getConvexUrl();
  if (!url) return null;
  return new ConvexReactClient(url);
}

