import type { Dispatch, SetStateAction } from "react";
import type {
  AnnotationStroke,
  CanvasItem,
  ImageItem,
  Project,
  ReferenceGroup,
} from "@shared/types/project";
import type { ImportQueueEntry } from "@renderer/features/import/import-queue";

export type ToastKind = "success" | "error" | "info";
export type ImagePatch = Partial<Omit<ImageItem, "id" | "type">>;

export interface UseCanvasWorkspaceOptions {
  project: Project;
  activeGroup: ReferenceGroup | undefined;
  activeGroupId: string | null;
  autoArrangeOnImport: boolean;
  viewportSize: { width: number; height: number };
  selectedItemIds: string[];
  lastImportedItemIds: string[];
  importQueue: ImportQueueEntry[];
  clipboardItems: CanvasItem[];
  setProject: (project: Project) => void;
  setGroupView: (
    groupId: string,
    zoom: number,
    panX: number,
    panY: number,
  ) => void;
  patchGroupItems: (groupId: string, updates: Record<string, ImagePatch>) => void;
  addGroupItems: (groupId: string, items: CanvasItem[]) => void;
  removeGroupItems: (groupId: string, itemIds: string[]) => void;
  flipItems: (groupId: string, itemIds: string[]) => void;
  setGroupCanvasSize: (groupId: string, width: number, height: number) => void;
  setGroupColors: (
    groupId: string,
    colors: Partial<Pick<ReferenceGroup, "canvasColor" | "backgroundColor">>,
  ) => void;
  setGroupLocked: (groupId: string, locked: boolean) => void;
  setGroupAnnotations: (
    groupId: string,
    annotations: AnnotationStroke[],
  ) => void;
  setImportQueue: Dispatch<SetStateAction<ImportQueueEntry[]>>;
  setClipboardItems: Dispatch<SetStateAction<CanvasItem[]>>;
  setSelectedItemIds: Dispatch<SetStateAction<string[]>>;
  setLastImportedItemIds: Dispatch<SetStateAction<string[]>>;
  pushToast: (kind: ToastKind, message: string) => void;
  refreshRecents: () => void;
  runHistoryBatch: (callback: () => void) => void;
}
