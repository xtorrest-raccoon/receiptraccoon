"use client";

/**
 * Web-only persistence for "which of my workspaces is active" -- @rr/api's
 * setActiveWorkspaceId() itself just holds it in memory, since it has no
 * opinion on storage (mobile doesn't call this at all, see its own comment).
 * Web persists the choice in localStorage so it survives a reload; there is
 * deliberately no server-side sync of this -- it's a per-browser preference,
 * not something that needs to follow you across devices.
 */
import { setActiveWorkspaceId } from "@rr/api";

const STORAGE_KEY = "rr_active_workspace_id";

/**
 * Called once at startup (see AppShell) to restore the last-picked workspace
 * before any @rr/api call runs. Guarded because this module's top-level code
 * also runs during Next's SSR pass, where `window` doesn't exist -- a no-op
 * there is correct anyway, since the SSR pass never resolves per-user data.
 */
export function initActiveWorkspace(): void {
  if (typeof window === "undefined") return;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored) setActiveWorkspaceId(stored);
}

export function persistActiveWorkspace(id: string): void {
  setActiveWorkspaceId(id);
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, id);
}
