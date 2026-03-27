export type ToolMode = "connect" | "doodle" | "blur" | "bw" | "ruler";

export interface MenuState {
  x: number;
  y: number;
}

export interface TaskDateRange {
  startDate: string;
  endDate: string;
}
