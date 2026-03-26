import type { DesktopApi } from "@shared/types/ipc";

declare global {
  interface Window {
    desktopApi: DesktopApi;
  }
}

export {};
