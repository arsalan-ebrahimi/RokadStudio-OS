export const getPagination = (query) => {
  const page = Math.max(1, parseInt(query?.page, 10) || 1);
  const rawLimit = parseInt(query?.limit, 10) || 20;
  const limit = Math.min(100, Math.max(1, rawLimit));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

export const formatPaginationMeta = (page, limit, total) => {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return {
    page,
    limit,
    total,
    totalPages,
  };
};
