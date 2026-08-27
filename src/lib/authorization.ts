import type { MemberRole } from "./domain";
export type Permission="organizations:manage"|"visits:all"|"visits:own"|"visits:create"|"access:decide"|"reports:read"|"settings:manage"|"documents:preview";
const grants:Record<MemberRole,Permission[]>={superadmin:["organizations:manage","visits:all","visits:create","access:decide","reports:read","settings:manage","documents:preview"],admin:["visits:all","visits:create","access:decide","reports:read","settings:manage","documents:preview"],host:["visits:own","visits:create"],guard:["visits:all","access:decide","visits:create"]};
export function can(role:MemberRole,permission:Permission){return grants[role].includes(permission)}
export function canReadVisit(input:{role:MemberRole;userId:string;hostId:string;userOrgId:string;visitOrgId:string}){return input.userOrgId===input.visitOrgId&&(can(input.role,"visits:all")||(can(input.role,"visits:own")&&input.userId===input.hostId))}
