export const ROLES = {
  ADMIN: 'admin',
  STAFF: 'staff',
  STUDENT: 'student',
};

// Maps user roles to their default home paths
export const ROLE_HOME_PATHS = {
  [ROLES.ADMIN]: '/admin',
  [ROLES.STAFF]: '/staff',
  [ROLES.STUDENT]: '/dashboard',
};

// Returns the default path for a role, or fallback to login
export const getDefaultRouteForRole = (role) => {
  return ROLE_HOME_PATHS[role?.toLowerCase()] || '/login';
};
