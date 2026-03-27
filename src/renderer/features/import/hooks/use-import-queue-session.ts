import { useEffect, useMemo, useRef, useState } from "react";
import type { Project } from "@shared/types/project";
import {
  loadImportQueueFromSession,
  persistImportQueueToSession,
  toImportQueueStorageKey,
  type ImportQueueEntry,
} from "@renderer/features/import/import-queue";

export const useImportQueueSession = (project: Project) => {
  const [queue, setQueue] = useState<ImportQueueEntry[]>([]);
  const loadedKeyRef = useRef<string | null>(null);

  const storageKey = useMemo(() => toImportQueueStorageKey(project), [project]);

  useEffect(() => {
    const restoredQueue = loadImportQueueFromSession(storageKey);
    setQueue(restoredQueue);
    loadedKeyRef.current = storageKey;
  }, [storageKey]);

  useEffect(() => {
    if (loadedKeyRef.current !== storageKey) {
      return;
    }

    persistImportQueueToSession(storageKey, queue);
  }, [queue, storageKey]);

  return {
    importQueue: queue,
    setImportQueue: setQueue,
  };
};
