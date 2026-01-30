import type { projectRoleContract } from '@cpn-console/shared'
import type { Project, ProjectRole } from '@prisma/client'
import {
  deleteRole as deleteRoleQuery,
  listMembers,
  listRoles as listRolesQuery,
  updateRole,
} from '@/resources/queries-index.js'
import { BadRequest400, Forbidden403 } from '@/utils/errors.js'
import prisma from '@/prisma.js'

export async function listRoles(projectId: Project['id']) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { slug: true } })
  const roles = await listRolesQuery(projectId)
  return roles.map(role => ({
    ...role,
    permissions: role.permissions.toString(),
    oidcGroup: project?.slug ? role.oidcGroup?.replace(new RegExp(`^/project-${project.slug}`), '') : role.oidcGroup,
  }))
}

export async function patchRoles(projectId: Project['id'], roles: typeof projectRoleContract.patchProjectRoles.body._type) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { slug: true } })
  const dbRoles = await listRoles(projectId)
  const positionsAvailable: number[] = []

  const updatedRoles = dbRoles
    .filter(dbRole => roles.find(role => role.id === dbRole.id)) // filter non concerned dbRoles
    .map((dbRole) => {
      const matchingRole = roles.find(role => role.id === dbRole.id)
      if (typeof matchingRole?.position !== 'undefined' && !positionsAvailable.includes(matchingRole.position)) {
        positionsAvailable.push(matchingRole.position)
      }
      if (dbRole.type === 'system') {
        throw new Forbidden403('Ce rôle système ne peut pas être renommé')
      }

      let oidcGroup = matchingRole?.oidcGroup ?? dbRole.oidcGroup
      if (oidcGroup && project?.slug && !oidcGroup.startsWith(`/project-${project.slug}/`)) {
        if (oidcGroup.startsWith('/')) {
          oidcGroup = `/project-${project.slug}${oidcGroup}`
        } else {
          oidcGroup = `/project-${project.slug}/${oidcGroup}`
        }
      }

      return {
        id: matchingRole?.id ?? dbRole.id,
        name: matchingRole?.name ?? dbRole.name,
        permissions: matchingRole?.permissions ? BigInt(matchingRole?.permissions) : BigInt(dbRole.permissions),
        position: matchingRole?.position ?? dbRole.position,
        oidcGroup,
      }
    })
  if (positionsAvailable.length && positionsAvailable.length !== dbRoles.length) return new BadRequest400('Les numéros de position des rôles sont incohérentes')
  for (const { id, ...role } of updatedRoles) {
    await updateRole(id, role)
  }

  return listRoles(projectId)
}

export async function createRole(projectId: Project['id'], role: typeof projectRoleContract.createProjectRole.body._type) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { slug: true } })
  const dbMaxPosRole = (await prisma.projectRole.findFirst({
    where: { projectId },
    orderBy: { position: 'desc' },
    select: { position: true },
  }))?.position ?? -1

  let oidcGroup = role.oidcGroup
  if (oidcGroup && project?.slug && !oidcGroup.startsWith(`/project-${project.slug}/`)) {
    if (oidcGroup.startsWith('/')) {
      oidcGroup = `/project-${project.slug}${oidcGroup}`
    } else {
      oidcGroup = `/project-${project.slug}/${oidcGroup}`
    }
  }

  await prisma.projectRole.create({
    data: {
      ...role,
      projectId,
      position: dbMaxPosRole + 1,
      permissions: BigInt(role.permissions),
      oidcGroup,
    },
  })

  return listRoles(projectId)
}

export async function countRolesMembers(projectId: Project['id']) {
  const roles = await listRoles(projectId)
  const members = await listMembers(projectId)
  const rolesCounts: Record<ProjectRole['id'], number> = Object.fromEntries(roles.map(role => [role.id, 0])) // {role uuid: 0}
  for (const { roleIds } of members) {
    for (const roleId of roleIds) {
      rolesCounts[roleId]++
    }
  }
  return rolesCounts
}

export async function deleteRole(roleId: Project['id']) {
  await deleteRoleQuery(roleId)
  return null
}
