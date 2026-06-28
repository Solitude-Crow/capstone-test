// middleware/sanitize.js
import xss from "xss";

const xssOptions = {
  whiteList: {},
  stripIgnoreTag: true,
  stripIgnoreTagBody: ["script", "style"],
};

const sanitizeValue = (value) => {
  if (typeof value === "string") return xss(value, xssOptions);
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, sanitizeValue(v)])
    );
  }
  return value;
};

export const sanitizeInputs = (req, res, next) => {
  if (req.body)   req.body   = sanitizeValue(req.body);
  if (req.params) req.params = sanitizeValue(req.params);

  // req.query is read-only in Express v5+ — mutate individual keys in-place
  if (req.query) {
    for (const key of Object.keys(req.query)) {
      req.query[key] = sanitizeValue(req.query[key]);
    }
  }

  next();
};