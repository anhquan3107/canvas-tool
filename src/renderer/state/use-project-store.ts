import { useContext } from "react";
import { ProjectContext } from "@renderer/state/project-store";

export const useProjectStore = () => {
  const ctx = useContext(ProjectContext);

  if (!ctx) {
    throw new Error("useProjectStore must be used inside ProjectProvider.");
  }

  return ctx;
};
