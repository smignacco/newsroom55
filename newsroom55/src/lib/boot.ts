import { seedIfNeeded } from "@/lib/database/seed";
import { getDb } from "@/lib/database";
import { ensureAdminUser } from "@/lib/security/auth";
import { startScheduler } from "@/lib/scheduler";

declare global {
  var __newsroomBootPromise: Promise<void> | undefined;
}

export async function boot() {
  if (!globalThis.__newsroomBootPromise) {
    globalThis.__newsroomBootPromise = (async () => {
      process.env.TZ = process.env.TZ || "America/Montreal";
      getDb();
      seedIfNeeded();
      await ensureAdminUser();
      startScheduler();
    })().catch((error) => {
      globalThis.__newsroomBootPromise = undefined;
      throw error;
    });
  }
  await globalThis.__newsroomBootPromise;
}
