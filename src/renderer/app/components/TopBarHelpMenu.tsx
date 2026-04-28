import { useI18n } from "@renderer/i18n";

interface TopBarHelpMenuProps {
  onShowHelp: () => void;
}

export const TopBarHelpMenu = ({ onShowHelp }: TopBarHelpMenuProps) => {
  const { copy } = useI18n();

  return (
    <div
      className="topbar-settings-shell"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button type="button" className="toolbar-button" onClick={onShowHelp}>
        {copy.topbar.help}
      </button>
    </div>
  );
};
