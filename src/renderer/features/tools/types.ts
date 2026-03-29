export type ToolMode = "connect" | "doodle" | "blur" | "bw" | "ruler";

export type DoodleMode = "brush" | "erase-line" | "erase-pixel";

export interface RulerGridSettings {
  horizontalLines: number;
  verticalLines: number;
  gridColor: string;
}
