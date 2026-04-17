import { useEffect, useState } from "react";

export const DOT_GAIN_20_SVG_FILTER_ID = "dot-gain-20-svg-filter";

let cachedTransferTable: string | null = null;
let transferTablePromise: Promise<string | null> | null = null;
const listeners = new Set<(table: string | null) => void>();

const notifyListeners = (table: string | null) => {
  listeners.forEach((listener) => listener(table));
};

const loadDotGain20TransferTable = () => {
  if (cachedTransferTable) {
    return Promise.resolve(cachedTransferTable);
  }

  if (transferTablePromise) {
    return transferTablePromise;
  }

  transferTablePromise = window.desktopApi.import
    .getDotGain20TransferTable()
    .then((table) => {
      cachedTransferTable = table;
      notifyListeners(table);
      return table;
    })
    .catch(() => null);

  return transferTablePromise;
};

export const ensureDotGain20SvgFilterReady = async () =>
  loadDotGain20TransferTable();

export const useDotGain20SvgFilterTable = () => {
  const [table, setTable] = useState<string | null>(cachedTransferTable);

  useEffect(() => {
    const handleTableChange = (nextTable: string | null) => {
      setTable(nextTable);
    };

    listeners.add(handleTableChange);
    void loadDotGain20TransferTable().then((nextTable) => {
      setTable(nextTable);
    });

    return () => {
      listeners.delete(handleTableChange);
    };
  }, []);

  return table;
};
