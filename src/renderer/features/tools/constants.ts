import type { ToolMode } from "./types";

export const TOOL_LABELS: Record<ToolMode, string> = {
  connect: "Connect",
  doodle: "Doodle",
  blur: "Blur",
  bw: "B&W",
  ruler: "Ruler",
};

export const TOOL_ORDER: ToolMode[] = [
  "connect",
  "doodle",
  "blur",
  "bw",
  "ruler",
];
