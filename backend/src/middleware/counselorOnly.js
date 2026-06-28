// middleware/counselorOnly.js
export const counselorOnly = (req, res, next) => {
  if (req.user?.role !== "counselor") {
    return res.status(403).json({ message: "Access denied – Counselors only" });
  }
  next();
};
