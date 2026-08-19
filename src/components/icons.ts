import {
  FileText,
  RefreshCw,
  Sparkles,
  ListChecks,
  Terminal,
  type LucideIcon,
} from "lucide-react";
import type { IconName } from "../types/dashboard";

/**
 * Maps the serializable `IconName` string stored on a `SkillCommand` to an
 * actual lucide-react component. Extend this map whenever a new preset
 * skill needs a new icon — keeps `SkillCommand` data plain-object safe
 * (storable in a JSON settings file) instead of holding component refs.
 */
export const iconRegistry: Record<IconName, LucideIcon> = {
  FileText,
  RefreshCw,
  Sparkles,
  ListChecks,
  Terminal,
};

export function resolveIcon(name: IconName): LucideIcon {
  return iconRegistry[name] ?? Terminal;
}
