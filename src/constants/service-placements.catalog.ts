export const PLACEMENT_PAGES = ["home", "blogs", "articles", "aayojan"] as const;
export type PlacementPage = (typeof PLACEMENT_PAGES)[number];

export const PLACEMENT_SECTIONS = ["sidebar", "recommended", "inline_ad", "related"] as const;
export type PlacementSection = (typeof PLACEMENT_SECTIONS)[number];

export const PAGE_SECTIONS: Record<PlacementPage, readonly PlacementSection[]> = {
  home: ["recommended", "sidebar", "inline_ad"],
  blogs: ["sidebar", "inline_ad", "related"],
  articles: ["sidebar", "inline_ad"],
  aayojan: ["sidebar", "recommended", "inline_ad"],
};

/** Max active placements per page+section (enforced on create/activate). */
export const SECTION_LIMITS: Partial<Record<PlacementSection, number>> = {
  sidebar: 5,
  inline_ad: 10,
  recommended: 10,
  related: 10,
};

export const isValidPageSection = (page: PlacementPage, section: PlacementSection): boolean =>
  PAGE_SECTIONS[page].includes(section);

export const getSectionLimit = (section: PlacementSection): number | undefined => SECTION_LIMITS[section];
