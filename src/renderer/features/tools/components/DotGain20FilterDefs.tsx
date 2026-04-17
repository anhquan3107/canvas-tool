import {
  DOT_GAIN_20_SVG_FILTER_ID,
  useDotGain20SvgFilterTable,
} from "@renderer/features/tools/dot-gain-filter";

export const DotGain20FilterDefs = () => {
  const transferTable = useDotGain20SvgFilterTable();

  if (!transferTable) {
    return null;
  }

  return (
    <svg
      width="0"
      height="0"
      aria-hidden="true"
      focusable="false"
      style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none" }}
    >
      <defs>
        <filter id={DOT_GAIN_20_SVG_FILTER_ID} colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="0.2126 0.7152 0.0722 0 0
                    0.2126 0.7152 0.0722 0 0
                    0.2126 0.7152 0.0722 0 0
                    0 0 0 1 0"
          />
          <feComponentTransfer>
            <feFuncR type="table" tableValues={transferTable} />
            <feFuncG type="table" tableValues={transferTable} />
            <feFuncB type="table" tableValues={transferTable} />
            <feFuncA type="identity" />
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>
  );
};
