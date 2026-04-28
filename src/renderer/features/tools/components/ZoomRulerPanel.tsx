import type { RulerGridSettings } from "@renderer/features/tools/types";
import { useI18n } from "@renderer/i18n";

interface ZoomRulerPanelProps {
  draftRulerSettings: RulerGridSettings;
  onDraftRulerSettingsChange: (settings: RulerGridSettings) => void;
  onApplyRulerSettings: (settings: RulerGridSettings) => void;
  onCancelRuler: () => void;
}

const GRID_COLOR_OPTIONS = [
  { key: "red", value: "#ff2a2a" },
  { key: "green", value: "#00d84a" },
  { key: "blue", value: "#0057ff" },
  { key: "cyan", value: "#00eaff" },
  { key: "white", value: "#ffffff" },
  { key: "black", value: "#000000" },
] as const;

export const ZoomRulerPanel = ({
  draftRulerSettings,
  onDraftRulerSettingsChange,
  onApplyRulerSettings,
  onCancelRuler,
}: ZoomRulerPanelProps) => {
  const { copy } = useI18n();

  return (
    <div
      className="zoom-ruler-panel"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="zoom-ruler-topbar">
        <span className="zoom-ruler-topbar-label">{copy.ruler.title}</span>
      </div>

      <div className="zoom-ruler-body">
        <div className="zoom-ruler-header">
          <p>{copy.ruler.description}</p>
        </div>

        <label className="zoom-ruler-field">
          <span>{copy.ruler.horizontalLines}</span>
          <div className="zoom-ruler-slider-row">
            <input
              type="range"
              min={2}
              max={18}
              value={draftRulerSettings.horizontalLines}
              onChange={(event) =>
                onDraftRulerSettingsChange({
                  ...draftRulerSettings,
                  horizontalLines: Number(event.target.value),
                })
              }
            />
            <strong>{draftRulerSettings.horizontalLines}</strong>
          </div>
        </label>

        <label className="zoom-ruler-field">
          <span>{copy.ruler.verticalLines}</span>
          <div className="zoom-ruler-slider-row">
            <input
              type="range"
              min={2}
              max={18}
              value={draftRulerSettings.verticalLines}
              onChange={(event) =>
                onDraftRulerSettingsChange({
                  ...draftRulerSettings,
                  verticalLines: Number(event.target.value),
                })
              }
            />
            <strong>{draftRulerSettings.verticalLines}</strong>
          </div>
        </label>

        <fieldset className="zoom-ruler-colors">
          <legend>{copy.ruler.gridColor}</legend>
          <div className="zoom-ruler-color-list">
            {GRID_COLOR_OPTIONS.map((option) => (
              <label key={option.value} className="zoom-ruler-color-option">
                <input
                  type="radio"
                  name="zoom-ruler-grid-color"
                  checked={draftRulerSettings.gridColor === option.value}
                  onChange={() =>
                    onDraftRulerSettingsChange({
                      ...draftRulerSettings,
                      gridColor: option.value,
                    })
                  }
                />
                <span
                  className="zoom-ruler-color-dot"
                  style={{ backgroundColor: option.value }}
                />
                <span>{copy.ruler.colors[option.key]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="zoom-ruler-actions">
          <button
            type="button"
            onClick={() => onApplyRulerSettings(draftRulerSettings)}
          >
            {copy.common.apply}
          </button>
          <button type="button" onClick={onCancelRuler}>
            {copy.common.cancel}
          </button>
        </div>
      </div>
    </div>
  );
};
