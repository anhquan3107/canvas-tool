import type {
  DoodleEraserMode as SharedDoodleEraserMode,
  DoodleMode as SharedDoodleMode,
} from "@shared/types/project";

export type ToolMode = "connect" | "doodle" | "blur" | "bw" | "ruler";

export type DoodleMode = SharedDoodleMode;
export type DoodleEraserMode = SharedDoodleEraserMode;

export interface RulerGridSettings {
  horizontalLines: number;
  verticalLines: number;
  gridColor: string;
}
