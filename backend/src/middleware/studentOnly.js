// middleware/studentOnly.js
export const studentOnly = (req, res, next) => {
  if (req.user?.role !== "student") {
    return res.status(403).json({ message: "Access denied – Students only" });
  }
  next();
};
