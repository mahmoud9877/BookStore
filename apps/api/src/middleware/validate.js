/**
 * Validates the merged body, route params and query string against a request
 * DTO class and exposes the typed DTO as `req.dto`.
 */
export const validate = (Dto) => {
  return (req, res, next) => {
    const { dto, error } = Dto.parse({ ...req.body, ...req.params, ...req.query });
    if (error) {
      return res.status(400).json({
        message: "validationErr",
        validationErr: error.details,
      });
    }
    req.dto = dto;
    return next();
  };
};
