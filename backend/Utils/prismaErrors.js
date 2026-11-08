import { HandleERROR } from "vanta-api";

/**
 * Maps known Prisma error codes to appropriate HTTP errors.
 * Re-throws HandleERROR or returns null if not a handled Prisma code.
 */
export const mapPrismaError = (err) => {
  if (!err) return null;

  if (err.code === "P2002") {
    const target = Array.isArray(err.meta?.target) ? err.meta.target.join(", ") : err.meta?.target || "resource";
    return new HandleERROR(`A record with this ${target} already exists`, 409);
  }

  if (err.code === "P2025") {
    return new HandleERROR(err.meta?.cause || "Record not found", 404);
  }

  if (err.code === "P2003") {
    const field = err.meta?.field_name || "related resource";
    return new HandleERROR(`Operation failed due to related dependency (${field})`, 409);
  }

  return null;
};
