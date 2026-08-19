import { requestUrl } from "obsidian";
import type { Task } from "../types/dashboard";

/**
 * Thin client for TickTick (滴答清单)'s Open API v1
 * (https://developer.dida365.com / https://developer.ticktick.com).
 *
 * Uses Obsidian's `requestUrl` instead of `fetch` — it bypasses the
 * renderer's CORS restrictions, which a plain `fetch` call to a third-party
 * API from inside Obsidian's Electron webview would otherwise hit.
 *
 * Auth: TickTick uses OAuth2 (authorization-code flow). The plugin's
 * settings tab should run that flow once and store the resulting
 * `accessToken` via `Plugin.saveData()`; every call below takes the token
 * as a parameter rather than reading it globally, so this file has no
 * hidden dependency on plugin settings shape.
 */

const TICKTICK_API_BASE = "https://api.ticktick.com/open/v1";

interface TickTickApiTask {
  id: string;
  projectId: string;
  title: string;
  status: 0 | 2; // 0 = open, 2 = completed
  priority: 0 | 1 | 3 | 5; // none, low, medium, high
  dueDate?: string;
  tags?: string[];
}

export async function fetchTodayTasks(accessToken: string): Promise<Task[]> {
  const response = await requestUrl({
    url: `${TICKTICK_API_BASE}/task/today`, // conceptual endpoint; swap for
    // the actual "get tasks by project/filter" call your TickTick app is
    // scoped for — the Open API does not expose a single global "today" feed.
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const remoteTasks: TickTickApiTask[] = response.json;

  return remoteTasks.map((t) => ({
    id: `tt:${t.id}`,
    title: t.title,
    completed: t.status === 2,
    source: "ticktick" as const,
    priority: mapPriority(t.priority),
    tags: t.tags ?? [],
    dueDate: t.dueDate ?? null,
    project: null,
    ticktickId: t.id,
    ticktickProjectId: t.projectId,
    completedAt: t.status === 2 ? new Date().toISOString() : null,
  }));
}

export async function completeTask(accessToken: string, task: Task): Promise<void> {
  if (task.source !== "ticktick" || !task.ticktickId || !task.ticktickProjectId) {
    throw new Error("completeTask called with a non-TickTick task");
  }

  await requestUrl({
    url: `${TICKTICK_API_BASE}/project/${task.ticktickProjectId}/task/${task.ticktickId}/complete`,
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

function mapPriority(p: TickTickApiTask["priority"]): Task["priority"] {
  switch (p) {
    case 5:
      return "high";
    case 3:
      return "medium";
    case 1:
      return "low";
    default:
      return "none";
  }
}
