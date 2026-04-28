import type { ImportQueueEntry } from "@renderer/features/import/import-queue";
import { formatTimestamp } from "@renderer/app/utils";
import { useI18n } from "@renderer/i18n";

interface ImportVisibilitySnapshot {
  total: number;
  visible: number;
  ready: number;
  blocked: number;
  offCanvas: number;
}

interface AppInfoPanelProps {
  projectFileName: string;
  version: string;
  importVisibilitySnapshot: ImportVisibilitySnapshot | null;
  recentFiles: string[];
  importQueue: ImportQueueEntry[];
  retryingEntryId: string | null;
  onClose: () => void;
  onRetryImport: (entryId: string) => void;
}

export const AppInfoPanel = ({
  projectFileName,
  version,
  importVisibilitySnapshot,
  recentFiles,
  importQueue,
  retryingEntryId,
  onClose,
  onRetryImport,
}: AppInfoPanelProps) => {
  const { copy, locale } = useI18n();
  const resolvedVersion =
    version === "loading"
      ? copy.appInfo.versionLoading
      : version === "unknown"
        ? copy.appInfo.versionUnknown
        : version;

  return (
    <section className="overlay-panel app-info-panel">
      <div className="overlay-panel-header">
        <span>CanvasTool</span>
        <button type="button" className="overlay-close" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="inspector-block">
        <span className="inspector-label">{copy.appInfo.currentFile}</span>
        <strong>{projectFileName}</strong>
      </div>

      <div className="inspector-block">
        <span className="inspector-label">{copy.appInfo.version}</span>
        <strong>{resolvedVersion}</strong>
      </div>

      {importVisibilitySnapshot ? (
        <div className="inspector-block">
          <span className="inspector-label">{copy.appInfo.lastImportState}</span>
          <p>
            {copy.appInfo.visibleSummary(
              importVisibilitySnapshot.visible,
              importVisibilitySnapshot.total,
            )}
          </p>
          <p>
            {copy.appInfo.readyBlockedSummary(
              importVisibilitySnapshot.ready,
              importVisibilitySnapshot.blocked,
            )}
          </p>
          <p>{copy.appInfo.outsideCanvas(importVisibilitySnapshot.offCanvas)}</p>
        </div>
      ) : null}

      <div className="inspector-block">
        <span className="inspector-label">{copy.appInfo.recentFiles}</span>
        {recentFiles.length === 0 ? (
          <p>{copy.appInfo.noRecentFiles}</p>
        ) : (
          recentFiles.map((recentFile) => (
            <p key={recentFile} title={recentFile}>
              {recentFile}
            </p>
          ))
        )}
      </div>

      <div className="inspector-block">
        <span className="inspector-label">{copy.appInfo.importQueue}</span>
        {importQueue.length === 0 ? <p>{copy.appInfo.noImports}</p> : null}
        {importQueue.map((entry) => (
          <div key={entry.id} className="queue-row">
            <div>
              <strong>{copy.appInfo.importedItems(entry.importedCount)}</strong>
              <p>{formatTimestamp(entry.createdAt, locale)}</p>
            </div>
            {entry.blockedItemIds.length > 0 ? (
              <button
                type="button"
                className="queue-retry"
                disabled={retryingEntryId === entry.id}
                onClick={() => onRetryImport(entry.id)}
              >
                {retryingEntryId === entry.id ? copy.appInfo.retrying : copy.common.retry}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
};
