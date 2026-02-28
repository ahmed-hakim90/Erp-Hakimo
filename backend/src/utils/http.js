export const asyncHandler = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (error) {
    next(error);
  }
};

export const parsePagination = (query) => {
  const page = Math.max(1, Number(query.page || 1));
  const pageSize = Math.min(200, Math.max(1, Number(query.pageSize || 100)));
  return { page, pageSize };
};
