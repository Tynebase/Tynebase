export declare const WORKSPACE_ROLES: readonly ["viewer", "editor", "admin", "community_contributor", "community_admin"];
export declare const WORKSPACE_ROLE_INPUTS: readonly ["viewer", "editor", "admin", "member", "community_contributor", "community_admin"];
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];
export type WorkspaceRoleInput = (typeof WORKSPACE_ROLE_INPUTS)[number] | null | undefined;
export declare function normalizeWorkspaceRole(role: WorkspaceRoleInput): WorkspaceRole;
export declare function canManageWorkspace(role: WorkspaceRoleInput, isSuperAdmin?: boolean): boolean;
export declare function canWriteContent(role: WorkspaceRoleInput, isSuperAdmin?: boolean): boolean;
export declare function isReadOnlyRole(role: WorkspaceRoleInput, isSuperAdmin?: boolean): boolean;
export declare function isCommunityRole(role: WorkspaceRoleInput): boolean;
//# sourceMappingURL=roles.d.ts.map