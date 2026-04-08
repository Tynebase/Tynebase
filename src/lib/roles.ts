export const WORKSPACE_ROLES = ['viewer', 'editor', 'admin'] as const;
export const WORKSPACE_ROLE_INPUTS = ['viewer', 'editor', 'admin', 'member'] as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];
export type WorkspaceRoleInput = (typeof WORKSPACE_ROLE_INPUTS)[number] | null | undefined;

export function normalizeWorkspaceRole(role: WorkspaceRoleInput): WorkspaceRole {
  if (role === 'admin' || role === 'editor' || role === 'viewer') {
    return role;
  }

  if (role === 'member') {
    return 'editor';
  }

  return 'viewer';
}

export function canManageWorkspace(role: WorkspaceRoleInput, isSuperAdmin = false): boolean {
  return isSuperAdmin || normalizeWorkspaceRole(role) === 'admin';
}

export function canWriteContent(role: WorkspaceRoleInput, isSuperAdmin = false): boolean {
  const normalizedRole = normalizeWorkspaceRole(role);
  return isSuperAdmin || normalizedRole === 'admin' || normalizedRole === 'editor';
}

export function isReadOnlyRole(role: WorkspaceRoleInput, isSuperAdmin = false): boolean {
  return !isSuperAdmin && normalizeWorkspaceRole(role) === 'viewer';
}
