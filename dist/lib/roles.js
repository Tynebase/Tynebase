"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORKSPACE_ROLE_INPUTS = exports.WORKSPACE_ROLES = void 0;
exports.normalizeWorkspaceRole = normalizeWorkspaceRole;
exports.canManageWorkspace = canManageWorkspace;
exports.canWriteContent = canWriteContent;
exports.isReadOnlyRole = isReadOnlyRole;
exports.isCommunityRole = isCommunityRole;
exports.WORKSPACE_ROLES = ['viewer', 'editor', 'admin', 'community_contributor', 'community_admin'];
exports.WORKSPACE_ROLE_INPUTS = ['viewer', 'editor', 'admin', 'member', 'community_contributor', 'community_admin'];
function normalizeWorkspaceRole(role) {
    if (role === 'admin' || role === 'editor' || role === 'viewer' || role === 'community_contributor' || role === 'community_admin') {
        return role;
    }
    if (role === 'member') {
        return 'editor';
    }
    return 'viewer';
}
function canManageWorkspace(role, isSuperAdmin = false) {
    const norm = normalizeWorkspaceRole(role);
    return isSuperAdmin || norm === 'admin';
}
function canWriteContent(role, isSuperAdmin = false) {
    const normalizedRole = normalizeWorkspaceRole(role);
    return (isSuperAdmin ||
        normalizedRole === 'admin' ||
        normalizedRole === 'editor' ||
        normalizedRole === 'community_contributor' ||
        normalizedRole === 'community_admin');
}
function isReadOnlyRole(role, isSuperAdmin = false) {
    const norm = normalizeWorkspaceRole(role);
    return !isSuperAdmin && norm === 'viewer';
}
function isCommunityRole(role) {
    const norm = normalizeWorkspaceRole(role);
    return norm === 'community_contributor' || norm === 'community_admin';
}
//# sourceMappingURL=roles.js.map