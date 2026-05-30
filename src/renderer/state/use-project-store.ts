import { use } from "react";
import { ProjectContext } from "@renderer/state/project-context";

export const useProjectStore = () => {
  const ctx = use(ProjectContext);

  if (!ctx) {
    throw new Error("useProjectStore must be used inside ProjectProvider.");
  }

  return ctx;
};
