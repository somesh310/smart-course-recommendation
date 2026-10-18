import ApiError from '../utils/ApiError.js';

export function validateRequest(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) return next(new ApiError(400, 'Request validation failed.', result.error.issues.map(({ path, message }) => ({ path: path.join('.'), message }))));
    // Express exposes req.query as a getter. Store its validated copy separately
    // instead of assigning to it (which throws in strict mode).
    if (source === 'query') req.validatedQuery = result.data;
    else req[source] = result.data;
    next();
  };
}
