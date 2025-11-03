export enum CATEGORIES {
  GENERAL = 1,
  MISC,
}

export const CATEGORY_NAMES: Record<CATEGORIES, string> = {
  [CATEGORIES.GENERAL]: "General",
  [CATEGORIES.MISC]: "Misc",
};

export const CATEGORY_DESCRIPTIONS: Record<CATEGORIES, string> = {
  [CATEGORIES.GENERAL]: "General commands",
  [CATEGORIES.MISC]: "Misc commands",
};

