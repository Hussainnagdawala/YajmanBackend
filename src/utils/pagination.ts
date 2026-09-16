import { PaginationMeta } from "./response";

export const paginate = (page: number, limit: number) => {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(Math.max(1, limit), 100);
  const offset = (safePage - 1) * safeLimit;

  return {
    limit: safeLimit,
    offset,
    meta: (totalCount: number): PaginationMeta => ({
      page: safePage,
      limit: safeLimit,
      total: totalCount,
      total_pages: Math.ceil(totalCount / safeLimit),
      has_next: safePage * safeLimit < totalCount,
      has_prev: safePage > 1,
    }),
  };
};
