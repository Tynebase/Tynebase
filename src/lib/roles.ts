export const WORKSPACE_ROLES = ['viewer', 'editor', 'admin', 'community_contributor', 'community_admin'] as const;
export const WORKSPACE_ROLE_INPUTS = ['viewer', 'editor', 'admin', 'member', 'community_contributor', 'community_admin'] as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];
export type WorkspaceRoleInput = (typeof WORKSPACE_ROLE_INPUTS)[number] | null | undefined;

export function normalizeWorkspaceRole(role: WorkspaceRoleInput): WorkspaceRole {
  if (role === 'admin' || role === 'editor' || role === 'viewer' || role === 'community_contributor' || role === 'community_admin') {
    return role;
  }

  if (role === 'member') {
    return 'editor';
  }

  return 'viewer';
}

export function canManageWorkspace(role: WorkspaceRoleInput, isSuperAdmin = false): boolean {
  const norm = normalizeWorkspaceRole(role);
  return isSuperAdmin || norm === 'admin';
}

export function canWriteContent(role: WorkspaceRoleInput, isSuperAdmin = false): boolean {
  const normalizedRole = normalizeWorkspaceRole(role);
  return (
    isSuperAdmin || 
    normalizedRole === 'admin' || 
    normalizedRole === 'editor' || 
    normalizedRole === 'community_contributor' ||
    normalizedRole === 'community_admin'
  );
}

export function isReadOnlyRole(role: WorkspaceRoleInput, isSuperAdmin = false): boolean {
  const norm = normalizeWorkspaceRole(role);
  return !isSuperAdmin && norm === 'viewer';
}

export function isCommunityRole(role: WorkspaceRoleInput): boolean {
  const norm = normalizeWorkspaceRole(role);
  return norm === 'community_contributor' || norm === 'community_admin';
}
