import { createContext } from "react";
import type { Store } from "@renderer/state/project-store-types";

export const ProjectContext = createContext<Store | null>(null);
