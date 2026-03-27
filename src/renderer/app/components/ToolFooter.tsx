interface ToolFooterProps {
  label: string;
  htmlFor: string;
  min: number;
  max: number;
  value: number;
  onChange: (nextValue: number) => void;
}

export const ToolFooter = ({
  label,
  htmlFor,
  min,
  max,
  value,
  onChange,
}: ToolFooterProps) => (
  <div className="tool-footer">
    <label htmlFor={htmlFor}>{label}</label>
    <input
      id={htmlFor}
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
    />
    <span>{value}</span>
  </div>
);
