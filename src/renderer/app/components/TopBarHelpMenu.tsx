interface TopBarHelpMenuProps {
  onShowHelp: () => void;
}

export const TopBarHelpMenu = ({ onShowHelp }: TopBarHelpMenuProps) => (
  <div className="topbar-settings-shell" onPointerDown={(event) => event.stopPropagation()}>
    <button type="button" className="toolbar-button" onClick={onShowHelp}>
      Help
    </button>
  </div>
);
