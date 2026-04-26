import { randomUUID } from "node:crypto";
import type { AnnotationStroke } from "../../shared/types/project";

const HIMETRIC_TO_AVALON = 96 / 2540;
const STYLUS_PRECISION = 1000;
const DEFAULT_PRESSURE_MIN = 0;
const DEFAULT_PRESSURE_MAX = 1023;
const MIN_VISIBLE_STROKE_SIZE = 0.5;

enum KnownTag {
  InkSpaceRectangle = 0,
  GuidTable = 1,
  DrawingAttributesTable = 2,
  DrawingAttributesBlock = 3,
  StrokeDescriptorTable = 4,
  StrokeDescriptorBlock = 5,
  Buttons = 6,
  NoX = 7,
  NoY = 8,
  DrawingAttributesTableIndex = 9,
  Stroke = 10,
  StrokePropertyList = 11,
  PointProperty = 12,
  StrokeDescriptorTableIndex = 13,
  CompressionHeader = 14,
  TransformTable = 15,
  Transform = 16,
  TransformIsotropicScale = 17,
  TransformAnisotropicScale = 18,
  TransformRotate = 19,
  TransformTranslate = 20,
  TransformScaleAndTranslate = 21,
  TransformQuad = 22,
  TransformTableIndex = 23,
  MetricTable = 24,
  MetricBlock = 25,
  MetricTableIndex = 26,
  Mantissa = 27,
  PersistenceFormat = 28,
  HimetricSize = 29,
  StrokeIds = 30,
  ExtendedTransformTable = 31,
  KnownGuidBaseIndex = 50,
  X = 50,
  Y = 51,
  NormalPressure = 56,
  PenStyle = 67,
  ColorRef = 68,
  StylusWidth = 69,
  StylusHeight = 70,
  PenTip = 71,
  DrawingFlags = 72,
  Transparency = 80,
  CurveFittingError = 81,
  RasterOperation = 87,
}

interface DrawingAttributesState {
  color: string;
  width: number;
  height: number;
}

interface StrokeDescriptorState {
  packetPropertyTags: number[];
  buttonCount: number;
}

interface MetricEntryState {
  minimum: number;
  maximum: number;
  unit: number;
  resolution: number;
}

type MetricBlockState = Map<number, MetricEntryState>;

interface TransformState {
  m00: number;
  m01: number;
  m10: number;
  m11: number;
  m20: number;
  m21: number;
}

interface DecodedCanvasStatus {
  annotations: AnnotationStroke[];
  error?: string;
}

export interface LegacyInkDecodeResult {
  annotationsByCanvasId: Record<string, AnnotationStroke[]>;
  failedDrawingsByCanvasId: Record<string, string>;
}

class BufferReader {
  private offset = 0;

  constructor(private readonly buffer: Buffer) {}

  get position() {
    return this.offset;
  }

  get remaining() {
    return this.buffer.length - this.offset;
  }

  seek(position: number) {
    if (position < 0 || position > this.buffer.length) {
      throw new Error("Unexpected end of legacy ink stream.");
    }
    this.offset = position;
  }

  skip(length: number) {
    this.seek(this.offset + length);
  }

  readByte() {
    if (this.offset >= this.buffer.length) {
      throw new Error("Unexpected end of legacy ink stream.");
    }
    const value = this.buffer[this.offset];
    this.offset += 1;
    return value;
  }

  readBytes(length: number) {
    if (length < 0 || this.offset + length > this.buffer.length) {
      throw new Error("Unexpected end of legacy ink stream.");
    }
    const slice = this.buffer.subarray(this.offset, this.offset + length);
    this.offset += length;
    return slice;
  }

  readFloatLE() {
    const value = this.buffer.readFloatLE(this.offset);
    this.offset += 4;
    return value;
  }

  readDoubleLE() {
    const value = this.buffer.readDoubleLE(this.offset);
    this.offset += 8;
    return value;
  }

  readVarUInt() {
    let shift = 0;
    let value = 0;
    let byte = 0;

    do {
      byte = this.readByte();
      value += (byte & 0x7f) << shift;
      shift += 7;
    } while ((byte & 0x80) !== 0 && shift < 29);

    return value >>> 0;
  }

  readVarULong() {
    let shift = 0n;
    let value = 0n;
    let byte = 0n;

    do {
      byte = BigInt(this.readByte());
      value |= (byte & 0x7fn) << shift;
      shift += 7n;
    } while ((byte & 0x80n) !== 0n && shift < 57n);

    return value;
  }

  readSignedVarInt() {
    const encoded = this.readVarULong();
    const negative = (encoded & 1n) === 1n;
    const magnitude = Number(encoded >> 1n);
    return negative ? -magnitude : magnitude;
  }
}

class BitStreamReader {
  private byteArrayIndex = 0;
  private partialByte = 0;
  private bitsInPartialByte = 0;
  private bufferLengthInBits: number;
  private readonly initialBufferLengthInBits: number;

  constructor(
    private readonly byteArray: Buffer | Uint8Array,
    startIndex = 0,
    bufferLengthInBits?: number,
  ) {
    this.byteArrayIndex = startIndex;
    this.bufferLengthInBits =
      bufferLengthInBits ?? (this.byteArray.length - startIndex) * 8;
    this.initialBufferLengthInBits = this.bufferLengthInBits;
  }

  get endOfStream() {
    return this.bufferLengthInBits === 0;
  }

  get bitsRead() {
    return this.initialBufferLengthInBits - this.bufferLengthInBits;
  }

  get currentIndex() {
    return this.byteArrayIndex - 1;
  }

  readBit() {
    return (this.readByte(1) & 1) === 1;
  }

  readByte(countOfBits: number) {
    if (this.endOfStream) {
      throw new Error("Unexpected end of legacy ink bit stream.");
    }

    if (countOfBits <= 0 || countOfBits > 8 || countOfBits > this.bufferLengthInBits) {
      throw new Error("Invalid legacy ink bit read.");
    }

    this.bufferLengthInBits -= countOfBits;

    let returnByte = 0;
    if (this.bitsInPartialByte >= countOfBits) {
      const rightShift = 8 - countOfBits;
      returnByte = this.partialByte >> rightShift;
      this.partialByte = (this.partialByte << countOfBits) & 0xff;
      this.bitsInPartialByte -= countOfBits;
      return returnByte;
    }

    const nextByte = this.byteArray[this.byteArrayIndex];
    this.byteArrayIndex += 1;

    const rightShiftPartial = 8 - countOfBits;
    returnByte = this.partialByte >> rightShiftPartial;
    const rightShiftNext = Math.abs((countOfBits - this.bitsInPartialByte) - 8);
    returnByte |= nextByte >> rightShiftNext;
    this.partialByte = (nextByte << (countOfBits - this.bitsInPartialByte)) & 0xff;
    this.bitsInPartialByte = 8 - (countOfBits - this.bitsInPartialByte);
    return returnByte;
  }

  readUInt32(countOfBits: number) {
    if (countOfBits <= 0 || countOfBits > 32) {
      throw new Error("Invalid legacy ink UInt32 read.");
    }

    let value = 0;
    while (countOfBits > 0) {
      const countToRead = Math.min(countOfBits, 8);
      value <<= countToRead;
      value |= this.readByte(countToRead);
      countOfBits -= countToRead;
    }
    return value >>> 0;
  }

  readUInt64(countOfBits: number) {
    if (countOfBits <= 0 || countOfBits > 64) {
      throw new Error("Invalid legacy ink UInt64 read.");
    }

    let value = 0n;
    while (countOfBits > 0) {
      const countToRead = Math.min(countOfBits, 8);
      value <<= BigInt(countToRead);
      value |= BigInt(this.readByte(countToRead));
      countOfBits -= countToRead;
    }
    return value;
  }
}

class DeltaDeltaTransform {
  private previous1 = 0n;
  private previous2 = 0n;

  reset() {
    this.previous1 = 0n;
    this.previous2 = 0n;
  }

  inverseTransform(xfData: number, extra: number) {
    let value = BigInt(xfData);
    if (extra !== 0) {
      const negative = (extra & 0x01) !== 0;
      value =
        (BigInt(extra >> 1) << 32n) |
        (BigInt(xfData >>> 0) & 0xffff_ffffn);
      if (negative) {
        value = -value;
      }
    }

    const original = value - this.previous2 + (this.previous1 << 1n);
    this.previous2 = this.previous1;
    this.previous1 = original;
    return Number(original);
  }
}

const DEFAULT_HUFF_BITS = [
  [0, 1, 2, 4, 6, 8, 12, 16, 24, 32],
  [0, 1, 1, 2, 4, 8, 12, 16, 24, 32],
  [0, 1, 1, 1, 2, 4, 8, 14, 22, 32],
  [0, 2, 2, 3, 5, 8, 12, 16, 24, 32],
  [0, 3, 4, 5, 8, 12, 16, 24, 32],
  [0, 4, 6, 8, 12, 16, 24, 32],
  [0, 6, 8, 12, 16, 24, 32],
  [0, 7, 8, 12, 16, 24, 32],
] as const;

const DEFAULT_HUFF_SIZES = [10, 10, 10, 10, 9, 8, 7, 7] as const;

class HuffCodec {
  private readonly mins: number[];

  constructor(private readonly bits: readonly number[]) {
    this.mins = new Array(bits.length).fill(0);
    let lowerBound = 1;
    for (let index = 1; index < bits.length; index += 1) {
      this.mins[index] = lowerBound;
      lowerBound += 1 << (bits[index] - 1);
    }
  }

  decode(reader: BitStreamReader): { data: number; extra: number } {
    let prefixIndex = 0;
    while (reader.readBit()) {
      prefixIndex += 1;
    }

    if (prefixIndex === 0) {
      return { data: 0, extra: 0 };
    }

    if (prefixIndex < this.bits.length) {
      const dataBitLength = this.bits[prefixIndex];
      const rawData = reader.readUInt64(dataBitLength);
      const negative = (rawData & 1n) === 1n;
      const magnitude = Number(rawData >> 1n) + this.mins[prefixIndex];
      return {
        data: negative ? -magnitude : magnitude,
        extra: 0,
      };
    }

    if (prefixIndex === this.bits.length) {
      const extra: number = this.decode(reader).data;
      const data: number = this.decode(reader).data;
      return { data, extra };
    }

    throw new Error("Invalid legacy ink Huffman stream.");
  }

  uncompress(input: Buffer, startIndex: number, outputLength: number) {
    const reader = new BitStreamReader(input, startIndex);
    const deltaDelta = new DeltaDeltaTransform();
    deltaDelta.reset();
    const output = new Array<number>(outputLength);
    let outputIndex = 0;

    while (!reader.endOfStream && outputIndex < outputLength) {
      const { data, extra } = this.decode(reader);
      output[outputIndex] = deltaDelta.inverseTransform(data, extra);
      outputIndex += 1;
    }

    return {
      values: output,
      bytesRead: reader.currentIndex + 1 - startIndex,
    };
  }
}

const huffCodecCache = new Map<number, HuffCodec>();
const GORILLA_INDEX_MAP = [
  { bitCount: 8, padCount: 0 },
  { bitCount: 1, padCount: 0 },
  { bitCount: 1, padCount: 1 },
  { bitCount: 1, padCount: 2 },
  { bitCount: 1, padCount: 3 },
  { bitCount: 1, padCount: 4 },
  { bitCount: 1, padCount: 5 },
  { bitCount: 1, padCount: 6 },
  { bitCount: 1, padCount: 7 },
  { bitCount: 2, padCount: 0 },
  { bitCount: 2, padCount: 1 },
  { bitCount: 2, padCount: 2 },
  { bitCount: 2, padCount: 3 },
  { bitCount: 3, padCount: 0 },
  { bitCount: 3, padCount: 1 },
  { bitCount: 3, padCount: 2 },
  { bitCount: 4, padCount: 0 },
  { bitCount: 4, padCount: 1 },
  { bitCount: 5, padCount: 0 },
  { bitCount: 5, padCount: 1 },
  { bitCount: 6, padCount: 0 },
  { bitCount: 6, padCount: 1 },
  { bitCount: 7, padCount: 0 },
  { bitCount: 7, padCount: 1 },
] as const;

const getPropertyBitCount = (algorithmByte: number) => {
  const usesInts = (algorithmByte & 0x40) !== 0;
  const usesShorts = !usesInts && (algorithmByte & 0x20) !== 0;
  const countPerItem = usesInts ? 4 : usesShorts ? 2 : 1;
  const index = algorithmByte & (usesInts ? 0x3f : 0x1f);
  const gorillaEntry = GORILLA_INDEX_MAP[index];

  return {
    countPerItem,
    bitCount: gorillaEntry?.bitCount ?? (index - 16),
    padCount: gorillaEntry?.padCount ?? 0,
  };
};

const getHuffCodec = (index: number) => {
  const normalizedIndex = index & 0x1f;
  const cached = huffCodecCache.get(normalizedIndex);
  if (cached) {
    return cached;
  }

  if (normalizedIndex >= DEFAULT_HUFF_BITS.length) {
    throw new Error(`Unsupported legacy ink Huffman codec ${normalizedIndex}.`);
  }

  const codec = new HuffCodec(
    DEFAULT_HUFF_BITS[normalizedIndex].slice(0, DEFAULT_HUFF_SIZES[normalizedIndex]),
  );
  huffCodecCache.set(normalizedIndex, codec);
  return codec;
};

const decompressPropertyData = (input: Buffer) => {
  if (input.length < 2) {
    throw new Error("Legacy ink mantissa block is truncated.");
  }

  const compression = input[0];
  const { countPerItem, bitCount, padCount } = getPropertyBitCount(compression);
  const unitsToDecode = Math.floor(((input.length - 1) * 8) / bitCount) - padCount;
  const reader = new BitStreamReader(input, 1);
  const output = Buffer.alloc(Math.max(0, unitsToDecode) * countPerItem);
  let writeOffset = 0;

  for (let index = 0; index < unitsToDecode; index += 1) {
    const value = reader.readUInt32(bitCount);
    if (countPerItem === 2) {
      output.writeUInt16LE(value & 0xffff, writeOffset);
    } else if (countPerItem === 4) {
      output.writeUInt32LE(value >>> 0, writeOffset);
    } else {
      output.writeUInt8(value & 0xff, writeOffset);
    }
    writeOffset += countPerItem;
  }

  return output;
};

const readMantissaFraction = (reader: BufferReader) => {
  const size = reader.readVarUInt() + 1;
  const decompressed = decompressPropertyData(reader.readBytes(size));
  return decompressed.readInt16LE(0) / STYLUS_PRECISION;
};

const defaultDrawingAttributes = (): DrawingAttributesState => ({
  color: "#000000",
  width: 25 * HIMETRIC_TO_AVALON,
  height: 25 * HIMETRIC_TO_AVALON,
});

const toHexColor = (colorRef: number) => {
  const r = colorRef & 0xff;
  const g = (colorRef >> 8) & 0xff;
  const b = (colorRef >> 16) & 0xff;
  return `#${[r, g, b]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
};

const decodeDrawingAttributesBlock = (buffer: Buffer) => {
  const reader = new BufferReader(buffer);
  const state = defaultDrawingAttributes();
  let widthSet = false;
  let heightSet = false;

  while (reader.remaining > 0) {
    const tag = reader.readVarUInt();
    switch (tag) {
      case KnownTag.PenTip:
      case KnownTag.PenStyle:
      case KnownTag.DrawingFlags:
      case KnownTag.Transparency:
      case KnownTag.CurveFittingError:
        reader.readVarUInt();
        break;
      case KnownTag.RasterOperation:
        reader.skip(4);
        break;
      case KnownTag.ColorRef:
        state.color = toHexColor(reader.readVarUInt());
        break;
      case KnownTag.StylusWidth:
      case KnownTag.StylusHeight: {
        let size = reader.readVarUInt();
        if (reader.remaining > 0) {
          const markerPosition = reader.position;
          const nextTag = reader.readVarUInt();
          if (nextTag === KnownTag.Mantissa) {
            size += readMantissaFraction(reader);
          } else {
            reader.seek(markerPosition);
          }
        }

        const scaledSize = size * HIMETRIC_TO_AVALON;
        if (tag === KnownTag.StylusWidth) {
          state.width = scaledSize;
          widthSet = true;
        } else {
          state.height = scaledSize;
          heightSet = true;
        }
        break;
      }
      default:
        throw new Error(`Unsupported legacy ink drawing attribute tag ${tag}.`);
    }
  }

  if (widthSet && !heightSet) {
    state.height = state.width;
  }

  return state;
};

const decodeDrawingAttributesTable = (buffer: Buffer) => {
  const reader = new BufferReader(buffer);
  const table: DrawingAttributesState[] = [];

  while (reader.remaining > 0) {
    const blockSize = reader.readVarUInt();
    table.push(decodeDrawingAttributesBlock(reader.readBytes(blockSize)));
  }

  return table;
};

const decodeStrokeDescriptor = (buffer: Buffer) => {
  const reader = new BufferReader(buffer);
  const packetPropertyTags: number[] = [];
  let buttonCount = 0;

  while (reader.remaining > 0) {
    const tag = reader.readVarUInt();
    if (tag === KnownTag.Buttons) {
      buttonCount = reader.readVarUInt();
      for (let index = 0; index < buttonCount; index += 1) {
        reader.readVarUInt();
      }
      continue;
    }

    if (tag === KnownTag.StrokePropertyList) {
      while (reader.remaining > 0) {
        reader.readVarUInt();
      }
      break;
    }

    if (tag === KnownTag.NoX || tag === KnownTag.NoY) {
      throw new Error("Unsupported legacy ink stroke descriptor missing X or Y packets.");
    }

    packetPropertyTags.push(tag);
  }

  return { packetPropertyTags, buttonCount } satisfies StrokeDescriptorState;
};

const decodeStrokeDescriptorTable = (buffer: Buffer) => {
  const reader = new BufferReader(buffer);
  const table: StrokeDescriptorState[] = [];

  while (reader.remaining > 0) {
    const blockSize = reader.readVarUInt();
    table.push(decodeStrokeDescriptor(reader.readBytes(blockSize)));
  }

  return table;
};

const defaultMetricEntryForTag = (tag: number): MetricEntryState => {
  if (tag === KnownTag.NormalPressure) {
    return {
      minimum: DEFAULT_PRESSURE_MIN,
      maximum: DEFAULT_PRESSURE_MAX,
      unit: 0,
      resolution: 1,
    };
  }

  return {
    minimum: 0,
    maximum: 32767,
    unit: 0,
    resolution: 1,
  };
};

const decodeMetricEntry = (data: Buffer, tag: number) => {
  const reader = new BufferReader(data);
  const fallback = defaultMetricEntryForTag(tag);
  const minimum = reader.remaining > 0 ? reader.readSignedVarInt() : fallback.minimum;
  const maximum = reader.remaining > 0 ? reader.readSignedVarInt() : fallback.maximum;
  const unit = reader.remaining > 0 ? reader.readVarUInt() : fallback.unit;
  const resolution = reader.remaining >= 4 ? reader.readFloatLE() : fallback.resolution;

  return {
    minimum,
    maximum,
    unit,
    resolution,
  } satisfies MetricEntryState;
};

const decodeMetricBlock = (buffer: Buffer) => {
  const reader = new BufferReader(buffer);
  const block = new Map<number, MetricEntryState>();

  while (reader.remaining > 0) {
    const tag = reader.readVarUInt();
    const entrySize = reader.readVarUInt();
    block.set(tag, decodeMetricEntry(reader.readBytes(entrySize), tag));
  }

  return block;
};

const decodeMetricTable = (buffer: Buffer) => {
  const reader = new BufferReader(buffer);
  const table: MetricBlockState[] = [];

  while (reader.remaining > 0) {
    const blockSize = reader.readVarUInt();
    table.push(decodeMetricBlock(reader.readBytes(blockSize)));
  }

  return table;
};

const identityTransform = (): TransformState => ({
  m00: HIMETRIC_TO_AVALON,
  m01: 0,
  m10: 0,
  m11: HIMETRIC_TO_AVALON,
  m20: 0,
  m21: 0,
});

const loadTransform = (tag: number, values: number[]) => {
  let transform: TransformState;

  switch (tag) {
    case KnownTag.TransformIsotropicScale:
      transform = {
        m00: values[0],
        m01: 0,
        m10: 0,
        m11: values[0],
        m20: 0,
        m21: 0,
      };
      break;
    case KnownTag.TransformRotate: {
      const angle = (values[0] / 100) * (Math.PI / 180);
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      transform = {
        m00: cosine,
        m01: sine,
        m10: sine === 0 && cosine === 1 ? 0 : -cosine,
        m11: cosine,
        m20: 0,
        m21: 0,
      };
      break;
    }
    case KnownTag.TransformAnisotropicScale:
      transform = {
        m00: values[0],
        m01: 0,
        m10: 0,
        m11: values[1],
        m20: 0,
        m21: 0,
      };
      break;
    case KnownTag.TransformTranslate:
      transform = {
        m00: 1,
        m01: 0,
        m10: 0,
        m11: 1,
        m20: values[0],
        m21: values[1],
      };
      break;
    case KnownTag.TransformScaleAndTranslate:
      transform = {
        m00: values[0],
        m01: 0,
        m10: 0,
        m11: values[1],
        m20: values[2],
        m21: values[3],
      };
      break;
    case KnownTag.Transform:
    case KnownTag.TransformQuad:
    default:
      transform = {
        m00: values[0],
        m01: values[1],
        m10: values[2],
        m11: values[3],
        m20: values[4],
        m21: values[5],
      };
      break;
  }

  transform.m00 *= HIMETRIC_TO_AVALON;
  transform.m01 *= HIMETRIC_TO_AVALON;
  transform.m10 *= HIMETRIC_TO_AVALON;
  transform.m11 *= HIMETRIC_TO_AVALON;
  transform.m20 *= HIMETRIC_TO_AVALON;
  transform.m21 *= HIMETRIC_TO_AVALON;
  return transform;
};

const decodeTransformBlock = (
  reader: BufferReader,
  tag: number,
  useDoubles: boolean,
) => {
  const valueCount =
    tag === KnownTag.TransformRotate
      ? 1
      : tag === KnownTag.TransformIsotropicScale
        ? 1
        : tag === KnownTag.TransformAnisotropicScale || tag === KnownTag.TransformTranslate
          ? 2
          : tag === KnownTag.TransformScaleAndTranslate
            ? 4
            : 6;

  const values =
    tag === KnownTag.TransformRotate
      ? [reader.readVarUInt()]
      : Array.from({ length: valueCount }, () =>
          useDoubles ? reader.readDoubleLE() : reader.readFloatLE(),
        );

  return loadTransform(tag, values);
};

const decodeTransformTable = (buffer: Buffer, useDoubles: boolean, existing: TransformState[]) => {
  const reader = new BufferReader(buffer);
  const table = useDoubles ? [...existing] : [];
  let tableIndex = 0;

  while (reader.remaining > 0) {
    const tag = reader.readVarUInt();
    const transform = decodeTransformBlock(reader, tag, useDoubles);
    if (useDoubles) {
      table[tableIndex] = transform;
    } else {
      table.push(transform);
    }
    tableIndex += 1;
  }

  return table;
};

const decompressPacketData = (input: Buffer, outputLength: number) => {
  if (input.length < 2) {
    throw new Error("Legacy ink packet payload is truncated.");
  }

  const compression = input[0];
  if ((compression & 0xc0) === 0x80) {
    const codec = getHuffCodec(compression & 0x1f);
    const result = codec.uncompress(input, 1, outputLength);
    return {
      values: result.values,
      bytesRead: result.bytesRead + 1,
    };
  }

  if ((compression & 0xc0) !== 0x00) {
    throw new Error("Unsupported legacy ink packet compression.");
  }

  let inputIndex = 1;
  const values = new Array<number>(outputLength).fill(0);
  let outputIndex = 0;
  const deltaDelta = (compression & 0x20) !== 0 ? new DeltaDeltaTransform() : null;
  deltaDelta?.reset();
  const bitCount = (compression & 0x1f) || 32;

  if (deltaDelta) {
    const reader = new BufferReader(input);
    reader.seek(inputIndex);
    values[outputIndex] = deltaDelta.inverseTransform(reader.readSignedVarInt(), 0);
    outputIndex += 1;
    if (outputIndex < outputLength) {
      values[outputIndex] = deltaDelta.inverseTransform(reader.readSignedVarInt(), 0);
      outputIndex += 1;
    }
    inputIndex = reader.position;
  }

  const bitMask = bitCount === 32 ? 0x8000_0000 : (0xffff_ffff << (bitCount - 1)) >>> 0;
  const reader = new BitStreamReader(input, inputIndex);
  while (!reader.endOfStream && outputIndex < outputLength) {
    let bitData = reader.readUInt32(bitCount);
    bitData = (bitData & bitMask) !== 0 ? (bitMask | bitData) >>> 0 : bitData;
    const signed = bitData > 0x7fff_ffff ? bitData - 0x1_0000_0000 : bitData;
    values[outputIndex] = deltaDelta ? deltaDelta.inverseTransform(signed, 0) : signed;
    outputIndex += 1;
  }

  return {
    values,
    bytesRead: inputIndex + (reader.currentIndex + 1 - inputIndex),
  };
};

const normalizePressure = (value: number, metric?: MetricEntryState) => {
  const minimum = metric?.minimum ?? DEFAULT_PRESSURE_MIN;
  const maximum = metric?.maximum ?? DEFAULT_PRESSURE_MAX;
  if (!Number.isFinite(value) || maximum <= minimum) {
    return 1;
  }

  const normalized = (value - minimum) / (maximum - minimum);
  return Math.max(0, Math.min(1, normalized));
};

const buildStrokeSize = (drawingAttributes: DrawingAttributesState) => {
  const average = (drawingAttributes.width + drawingAttributes.height) * 0.5;
  return Math.max(MIN_VISIBLE_STROKE_SIZE, average || drawingAttributes.width || drawingAttributes.height);
};

const applyTransform = (x: number, y: number, transform: TransformState) => ({
  x: x * transform.m00 + y * transform.m10 + transform.m20,
  y: x * transform.m01 + y * transform.m11 + transform.m21,
});

const decodeStroke = (
  buffer: Buffer,
  drawingAttributes: DrawingAttributesState,
  descriptor: StrokeDescriptorState,
  metricBlock: MetricBlockState | undefined,
  transform: TransformState,
  createdAt: string,
) => {
  const reader = new BufferReader(buffer);
  const pointCount = reader.readVarUInt();
  if (pointCount === 0) {
    return null;
  }

  const propertyTags = [KnownTag.X, KnownTag.Y, ...descriptor.packetPropertyTags];
  const propertyValues = new Map<number, number[]>();
  let compressedPackets = reader.readBytes(reader.remaining);

  for (const propertyTag of propertyTags) {
    const { values, bytesRead } = decompressPacketData(compressedPackets, pointCount);
    propertyValues.set(propertyTag, values);
    compressedPackets = compressedPackets.subarray(bytesRead);
  }

  const xValues = propertyValues.get(KnownTag.X);
  const yValues = propertyValues.get(KnownTag.Y);
  if (!xValues || !yValues) {
    throw new Error("Legacy ink stroke was missing X or Y packets.");
  }

  const points: number[] = [];
  for (let index = 0; index < pointCount; index += 1) {
    const transformed = applyTransform(xValues[index], yValues[index], transform);
    points.push(transformed.x, transformed.y);
  }

  const pressureValues = propertyValues.get(KnownTag.NormalPressure);
  const metric = metricBlock?.get(KnownTag.NormalPressure);
  const pressures = pressureValues?.map((value) => normalizePressure(value, metric));
  const stroke: AnnotationStroke = {
    id: randomUUID(),
    points,
    ...(pressures ? { pressures } : {}),
    color: drawingAttributes.color,
    size: buildStrokeSize(drawingAttributes),
    tool: "brush",
    createdAt,
  };

  return stroke;
};

const decodeCanvasDrawing = (base64Data: string, createdAt: string) => {
  const reader = new BufferReader(Buffer.from(base64Data, "base64"));
  const version = reader.readVarUInt();
  if (version !== 0) {
    throw new Error(`Unsupported legacy ink version ${version}.`);
  }

  const streamSize = reader.readVarUInt();
  const streamEnd = Math.min(reader.position + streamSize, reader.position + reader.remaining);
  const drawingAttributesTable: DrawingAttributesState[] = [];
  const strokeDescriptorTable: StrokeDescriptorState[] = [];
  const metricTable: MetricBlockState[] = [];
  let transformTable: TransformState[] = [];
  let drawingAttributesIndex = 0;
  let strokeDescriptorIndex = 0;
  let metricIndex = 0;
  let transformIndex = 0;
  let currentTransform = identityTransform();
  let currentDrawingAttributes = defaultDrawingAttributes();
  let currentDescriptor: StrokeDescriptorState = {
    packetPropertyTags: [],
    buttonCount: 0,
  };
  let currentMetricBlock: MetricBlockState | undefined;
  const annotations: AnnotationStroke[] = [];

  while (reader.position < streamEnd) {
    const tag = reader.readVarUInt();

    switch (tag) {
      case KnownTag.GuidTable: {
        const size = reader.readVarUInt();
        reader.skip(size);
        break;
      }
      case KnownTag.DrawingAttributesTable: {
        const size = reader.readVarUInt();
        drawingAttributesTable.splice(0, drawingAttributesTable.length, ...decodeDrawingAttributesTable(reader.readBytes(size)));
        currentDrawingAttributes = drawingAttributesTable[drawingAttributesIndex] ?? currentDrawingAttributes;
        break;
      }
      case KnownTag.DrawingAttributesBlock: {
        const size = reader.readVarUInt();
        drawingAttributesTable.splice(0, drawingAttributesTable.length, decodeDrawingAttributesBlock(reader.readBytes(size)));
        drawingAttributesIndex = 0;
        currentDrawingAttributes = drawingAttributesTable[0] ?? currentDrawingAttributes;
        break;
      }
      case KnownTag.StrokeDescriptorTable: {
        const size = reader.readVarUInt();
        strokeDescriptorTable.splice(0, strokeDescriptorTable.length, ...decodeStrokeDescriptorTable(reader.readBytes(size)));
        currentDescriptor = strokeDescriptorTable[strokeDescriptorIndex] ?? currentDescriptor;
        break;
      }
      case KnownTag.StrokeDescriptorBlock: {
        const size = reader.readVarUInt();
        strokeDescriptorTable.splice(0, strokeDescriptorTable.length, decodeStrokeDescriptor(reader.readBytes(size)));
        strokeDescriptorIndex = 0;
        currentDescriptor = strokeDescriptorTable[0] ?? currentDescriptor;
        break;
      }
      case KnownTag.MetricTable: {
        const size = reader.readVarUInt();
        metricTable.splice(0, metricTable.length, ...decodeMetricTable(reader.readBytes(size)));
        currentMetricBlock = metricTable[metricIndex];
        break;
      }
      case KnownTag.MetricBlock: {
        const size = reader.readVarUInt();
        metricTable.splice(0, metricTable.length, decodeMetricBlock(reader.readBytes(size)));
        metricIndex = 0;
        currentMetricBlock = metricTable[0];
        break;
      }
      case KnownTag.TransformTable: {
        const size = reader.readVarUInt();
        transformTable = decodeTransformTable(reader.readBytes(size), false, transformTable);
        currentTransform = transformTable[transformIndex] ?? currentTransform;
        break;
      }
      case KnownTag.ExtendedTransformTable: {
        const size = reader.readVarUInt();
        transformTable = decodeTransformTable(reader.readBytes(size), true, transformTable);
        currentTransform = transformTable[transformIndex] ?? currentTransform;
        break;
      }
      case KnownTag.Transform:
      case KnownTag.TransformIsotropicScale:
      case KnownTag.TransformAnisotropicScale:
      case KnownTag.TransformRotate:
      case KnownTag.TransformTranslate:
      case KnownTag.TransformScaleAndTranslate:
      case KnownTag.TransformQuad:
        transformTable = [decodeTransformBlock(reader, tag, false)];
        transformIndex = 0;
        currentTransform = transformTable[0] ?? currentTransform;
        break;
      case KnownTag.DrawingAttributesTableIndex:
        drawingAttributesIndex = reader.readVarUInt();
        currentDrawingAttributes =
          drawingAttributesTable[drawingAttributesIndex] ?? currentDrawingAttributes;
        break;
      case KnownTag.StrokeDescriptorTableIndex:
        strokeDescriptorIndex = reader.readVarUInt();
        currentDescriptor =
          strokeDescriptorTable[strokeDescriptorIndex] ?? currentDescriptor;
        break;
      case KnownTag.MetricTableIndex:
        metricIndex = reader.readVarUInt();
        currentMetricBlock = metricTable[metricIndex];
        break;
      case KnownTag.TransformTableIndex:
        transformIndex = reader.readVarUInt();
        currentTransform = transformTable[transformIndex] ?? currentTransform;
        break;
      case KnownTag.InkSpaceRectangle:
        for (let index = 0; index < 4; index += 1) {
          reader.readSignedVarInt();
        }
        break;
      case KnownTag.PersistenceFormat:
      case KnownTag.HimetricSize:
      case KnownTag.CompressionHeader:
      case KnownTag.StrokeIds: {
        const size = reader.readVarUInt();
        reader.skip(size);
        break;
      }
      case KnownTag.Stroke: {
        const size = reader.readVarUInt();
        const stroke = decodeStroke(
          reader.readBytes(size),
          currentDrawingAttributes,
          currentDescriptor,
          currentMetricBlock,
          currentTransform,
          createdAt,
        );
        if (stroke) {
          annotations.push(stroke);
        }
        break;
      }
      default:
        throw new Error(`Unsupported legacy ink tag ${tag}.`);
    }
  }

  return annotations;
};

export const decodeLegacyInkAnnotations = (
  canvasDrawings: Record<string, string>,
  createdAt: string,
): LegacyInkDecodeResult => {
  const statuses = new Map<string, DecodedCanvasStatus>();

  for (const [canvasId, drawingData] of Object.entries(canvasDrawings)) {
    if (typeof drawingData !== "string" || drawingData.trim().length === 0) {
      continue;
    }

    try {
      statuses.set(canvasId, {
        annotations: decodeCanvasDrawing(drawingData, createdAt),
      });
    } catch (error) {
      statuses.set(canvasId, {
        annotations: [],
        error: error instanceof Error ? error.message : "Unknown legacy ink decode error.",
      });
    }
  }

  const annotationsByCanvasId: Record<string, AnnotationStroke[]> = {};
  const failedDrawingsByCanvasId: Record<string, string> = {};

  statuses.forEach((status, canvasId) => {
    if (status.error) {
      failedDrawingsByCanvasId[canvasId] = canvasDrawings[canvasId];
      return;
    }
    annotationsByCanvasId[canvasId] = status.annotations;
  });

  return {
    annotationsByCanvasId,
    failedDrawingsByCanvasId,
  };
};
