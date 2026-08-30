export const MOCK_WORKER_FILE = 'mockServiceWorker.js'

interface Unregisterable {
  active?: { scriptURL: string } | null
  unregister(): Promise<boolean>
}

interface WorkerContainer {
  getRegistrations(): Promise<readonly Unregisterable[]>
}

/**
 * Removes our own worker before a new one is registered.
 *
 * The worker holds the ids of the clients that greeted it and answers a request
 * only after asking one of them what to do. A tab that dies without saying
 * goodbye — a hard reload, DevTools opening — leaves its id behind, so the set
 * is never empty and every request is handed to a client that no longer exists.
 * Nothing ever answers and the whole page hangs, fonts and modules included.
 *
 * The set lives inside the worker, so a fresh worker is the only way to empty it.
 */
export async function dropStaleWorkers(container: WorkerContainer | undefined): Promise<void> {
  if (!container) return

  const registrations = await container.getRegistrations()

  await Promise.all(
    registrations
      .filter((registration) => registration.active?.scriptURL.endsWith(MOCK_WORKER_FILE))
      .map((registration) => registration.unregister()),
  )
}
