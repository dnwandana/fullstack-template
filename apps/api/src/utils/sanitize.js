/**
 * Escapes PostgreSQL ILIKE special characters (%, _, \) so they are
 * treated as literals in search queries instead of wildcards.
 *
 * @param {string} str - Raw user search input
 * @returns {string} Escaped string safe for ILIKE patterns
 */
export const escapeIlike = (str) => str.replace(/[%_\\]/g, "\\$&")
