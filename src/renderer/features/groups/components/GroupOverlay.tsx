import { startTransition } from "react";
import type { ReferenceGroup } from "@shared/types/project";

interface GroupOverlayProps {
  groups: ReferenceGroup[];
  activeGroupId: string;
  open: boolean;
  onToggle: () => void;
  onSelectGroup: (groupId: string) => void;
}

export const GroupOverlay = ({
  groups,
  activeGroupId,
  open,
  onToggle,
  onSelectGroup,
}: GroupOverlayProps) => {
  const handleSelectGroup = (groupId: string) => {
    startTransition(() => {
      onSelectGroup(groupId);
    });
  };

  return (
    <div
      className={
        open ? "group-overlay-shell group-overlay-shell-open" : "group-overlay-shell"
      }
    >
      {open ? (
        <section className="overlay-panel group-overlay-panel">
          <div className="overlay-panel-header">
            <span>Groups</span>
          </div>
          <div className="group-dock">
            {groups.map((group) => (
              <button
                key={group.id}
                type="button"
                className={
                  group.id === activeGroupId ? "group-pill active" : "group-pill"
                }
                onClick={() => {
                  handleSelectGroup(group.id);
                  onToggle();
                }}
              >
                {group.name}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <button
        type="button"
        className="group-overlay-toggle"
        aria-label={open ? "Hide groups" : "Show groups"}
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="group-overlay-toggle-label">Groups</span>
        <span className="group-overlay-toggle-arrow">{open ? "▾" : "▴"}</span>
      </button>
    </div>
  );
};
