import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type SetStateAction,
} from "react";
import type { Project } from "@shared/types/project";
import {
  loadImportQueueFromSession,
  persistImportQueueToSession,
  toImportQueueStorageKey,
  type ImportQueueEntry,
} from "@renderer/features/import/import-queue";

export const useImportQueueSession = (project: Project) => {
  const storageKey = useMemo(() => toImportQueueStorageKey(project), [project]);
  const [queueState, setQueueState] = useState(() => ({
    storageKey,
    queue: loadImportQueueFromSession(storageKey),
  }));

  let activeQueueState = queueState;
  if (queueState.storageKey !== storageKey) {
    activeQueueState = {
      storageKey,
      queue: loadImportQueueFromSession(storageKey),
    };
    setQueueState(activeQueueState);
  }

  const setImportQueue = useCallback((nextQueue: SetStateAction<ImportQueueEntry[]>) => {
    setQueueState((current) => ({
      ...current,
      queue:
        typeof nextQueue === "function"
          ? nextQueue(current.queue)
          : nextQueue,
    }));
  }, []);

  useEffect(() => {
    persistImportQueueToSession(
      activeQueueState.storageKey,
      activeQueueState.queue,
    );
  }, [activeQueueState.queue, activeQueueState.storageKey]);

  return {
    importQueue: activeQueueState.queue,
    setImportQueue,
  };
};
