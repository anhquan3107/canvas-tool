import { useEffect, useRef, useState } from "react";
import { MenuItemContent } from "@renderer/app/components/MenuItemContent";
import { TopBarHoverTooltip } from "@renderer/app/components/TopBarHoverTooltip";

interface TopBarHelpMenuProps {
  onShowHelp: () => void;
  onShowAbout: () => void;
  onCloseOtherMenus: () => void;
}

export const TopBarHelpMenu = ({
  onShowHelp,
  onShowAbout,
  onCloseOtherMenus,
}: TopBarHelpMenuProps) => {
  const [open, setOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!shellRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  const toggleOpen = () => {
    if (!open) {
      onCloseOtherMenus();
    }

    setOpen((previous) => !previous);
  };

  const runAction = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div
      ref={shellRef}
      className="topbar-settings-shell"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <TopBarHoverTooltip label="Open help menu">
        <button
          type="button"
          className={`toolbar-button ${open ? "active" : ""}`}
          onClick={toggleOpen}
        >
          Help
        </button>
      </TopBarHoverTooltip>

      {open ? (
        <div className="topbar-settings-menu">
          <button type="button" onClick={() => runAction(onShowHelp)}>
            <MenuItemContent icon="help" label="Help" />
          </button>
          <button type="button" onClick={() => runAction(onShowAbout)}>
            <MenuItemContent icon="info" label="About" />
          </button>
        </div>
      ) : null}
    </div>
  );
};
