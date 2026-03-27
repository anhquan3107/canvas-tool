interface FilterFooterProps {
  label: string;
  htmlFor: string;
  min: number;
  max: number;
  value: number;
  onChange: (nextValue: number) => void;
}

export const FilterFooter = ({
  label,
  htmlFor,
  min,
  max,
  value,
  onChange,
}: FilterFooterProps) => (
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
