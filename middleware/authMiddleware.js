const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

const authenticateUser = (allowedRoles = []) => {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ status: false, message: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(" ")[1];

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (!decoded) {
        return res
          .status(401)
          .json({ status: false, message: "Unauthorized: Invalid token" });
      }

      req.user = {
        id: decoded.userId,
        email: decoded.email,
        role: decoded.role,
      };
if(req.user.role==='admin'){
  next()
}else{
      
      if (allowedRoles.length && !allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          status: false,
          message:
            "Forbidden: You do not have permission to access this resource",
        });
      }

      next();
    }
    } catch (err) {
      console.error("JWT verification error:", err.message);
      return res.status(401).json({
        status: false,
        message: "Unauthorized: Invalid or expired token",
      });
    }
  };
};

module.exports = authenticateUser;
