import type { ImportQueueEntry } from "@renderer/features/import/import-queue";
import { formatTimestamp } from "@renderer/app/utils";

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
}: AppInfoPanelProps) => (
  <section className="overlay-panel app-info-panel">
    <div className="overlay-panel-header">
      <span>CanvasTool</span>
      <button type="button" className="overlay-close" onClick={onClose}>
        ×
      </button>
    </div>

    <div className="inspector-block">
      <span className="inspector-label">Current File</span>
      <strong>{projectFileName}</strong>
    </div>

    <div className="inspector-block">
      <span className="inspector-label">Version</span>
      <strong>{version}</strong>
    </div>

    {importVisibilitySnapshot ? (
      <div className="inspector-block">
        <span className="inspector-label">Last Import State</span>
        <p>
          {importVisibilitySnapshot.visible}/{importVisibilitySnapshot.total} visible
        </p>
        <p>
          {importVisibilitySnapshot.ready} ready · {importVisibilitySnapshot.blocked} blocked
        </p>
        <p>{importVisibilitySnapshot.offCanvas} outside canvas</p>
      </div>
    ) : null}

    <div className="inspector-block">
      <span className="inspector-label">Recent Files</span>
      {recentFiles.length === 0 ? (
        <p>No recent files yet.</p>
      ) : (
        recentFiles.map((recentFile) => (
          <p key={recentFile} title={recentFile}>
            {recentFile}
          </p>
        ))
      )}
    </div>

    <div className="inspector-block">
      <span className="inspector-label">Import Queue</span>
      {importQueue.length === 0 ? <p>No imports this session.</p> : null}
      {importQueue.map((entry) => (
        <div key={entry.id} className="queue-row">
          <div>
            <strong>{entry.importedCount} item(s)</strong>
            <p>{formatTimestamp(entry.createdAt)}</p>
          </div>
          {entry.blockedItemIds.length > 0 ? (
            <button
              type="button"
              className="queue-retry"
              disabled={retryingEntryId === entry.id}
              onClick={() => onRetryImport(entry.id)}
            >
              {retryingEntryId === entry.id ? "Retrying..." : "Retry"}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  </section>
);
