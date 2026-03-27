import { startTransition } from "react";
import type { ReferenceGroup } from "@shared/types/project";

interface GroupOverlayProps {
  groups: ReferenceGroup[];
  activeGroupId: string;
  onSelectGroup: (groupId: string) => void;
}

export const GroupOverlay = ({
  groups,
  activeGroupId,
  onSelectGroup,
}: GroupOverlayProps) => (
  <section className="overlay-panel group-overlay-panel">
    <div className="overlay-panel-header">
      <span>Groups</span>
    </div>
    <div className="group-dock">
      {groups.map((group) => (
        <button
          key={group.id}
          type="button"
          className={group.id === activeGroupId ? "group-pill active" : "group-pill"}
          onClick={() =>
            startTransition(() => {
              onSelectGroup(group.id);
            })
          }
        >
          {group.name}
        </button>
      ))}
    </div>
  </section>
);
