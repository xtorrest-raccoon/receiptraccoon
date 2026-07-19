import type { DraftReceipt } from "./data";

/**
 * Hand-off between the capture stack's screens (camera -> processing -> confirm ->
 * saved). expo-router screens only get string route params, and the payload here
 * (a photo URI plus a draft receipt) doesn't need to survive a deep link or app
 * restart — it just needs to travel from one screen push to the next in the same
 * session. A module-level singleton is the simplest correct tool for that; no
 * context provider or state library needed for a four-screen linear flow.
 */

let photoUri: string | null = null;
let draft: DraftReceipt | null = null;
let savedSummary: { vendor: string; totalMinor: number; category: string; currency: string } | null = null;

export function setCapturedPhoto(uri: string): void {
  photoUri = uri;
}

export function getCapturedPhoto(): string | null {
  return photoUri;
}

export function setDraftReceipt(next: DraftReceipt): void {
  draft = next;
}

export function getDraftReceipt(): DraftReceipt | null {
  return draft;
}

export function setSavedSummary(summary: NonNullable<typeof savedSummary>): void {
  savedSummary = summary;
}

export function getSavedSummary(): typeof savedSummary {
  return savedSummary;
}

export function resetCapture(): void {
  photoUri = null;
  draft = null;
  savedSummary = null;
}
