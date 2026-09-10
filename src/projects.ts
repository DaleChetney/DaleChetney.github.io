export interface Project {
  /** Route folder name under `src/`; served at `/<slug>/`. */
  slug: string;
  title: string;
  description: string;
}

export const projects: Project[] = [
  {
    slug: "hex-map",
    title: "Hex Map",
    description: "An interactive flat-top hex grid with hover highlighting.",
  },
  {
    slug: "dice-roller",
    title: "Dice Roller",
    description: "Roll a handful of dice; your last roll is remembered.",
  },
  {
    slug: "generatorVisualizer",
    title: "Generator Visualizer",
    description: "Permutation diagrams for abstract groups, with data baked from the LMFDB.",
  },
];
