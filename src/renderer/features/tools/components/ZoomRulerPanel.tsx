import type { RulerGridSettings } from "@renderer/features/tools/types";

interface ZoomRulerPanelProps {
  draftRulerSettings: RulerGridSettings;
  onDraftRulerSettingsChange: (settings: RulerGridSettings) => void;
  onApplyRulerSettings: (settings: RulerGridSettings) => void;
  onCancelRuler: () => void;
}

const GRID_COLOR_OPTIONS = [
  { label: "Red", value: "#ff2a2a" },
  { label: "Green", value: "#00d84a" },
  { label: "Blue", value: "#0057ff" },
  { label: "Cyan", value: "#00eaff" },
  { label: "White", value: "#ffffff" },
  { label: "Black", value: "#000000" },
];

export const ZoomRulerPanel = ({
  draftRulerSettings,
  onDraftRulerSettingsChange,
  onApplyRulerSettings,
  onCancelRuler,
}: ZoomRulerPanelProps) => (
  <div
    className="zoom-ruler-panel"
    onMouseDown={(event) => event.stopPropagation()}
  >
    <div className="zoom-ruler-header">
      <div>
        <strong>Ruler Grid</strong>
        <p>Shape a composition grid directly on the focused image.</p>
      </div>
    </div>

    <label className="zoom-ruler-field">
      <span>Horizontal Lines</span>
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
      <span>Vertical Lines</span>
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
      <legend>Grid Color</legend>
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
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>

    <div className="zoom-ruler-actions">
      <button
        type="button"
        onClick={() => onApplyRulerSettings(draftRulerSettings)}
      >
        Apply
      </button>
      <button type="button" onClick={onCancelRuler}>
        Cancel
      </button>
    </div>
  </div>
);
