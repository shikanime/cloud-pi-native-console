import { faker } from '@faker-js/faker'
import { describe, expect, it } from 'vitest'
import type { ProjectMembers, ProjectRole, User } from '@prisma/client'
import prisma from '../../__mocks__/prisma.js'
import { BadRequest400 } from '../../utils/errors.ts'
import { countRolesMembers, createRole, deleteRole, listRoles, patchRoles } from './business.ts'

const projectId = faker.string.uuid()
describe('test project-role business', () => {
  describe('listRoles', () => {
    it('should stringify bigint', async () => {
      const partialRole: Partial<ProjectRole> = {
        permissions: 4n,
      }

      prisma.projectRole.findMany.mockResolvedValueOnce([partialRole])
      const response = await listRoles(projectId)
      expect(response).toEqual([{ permissions: '4' }])
    })

    it('should strip oidcGroup prefix', async () => {
      const dbRole: any = {
        id: faker.string.uuid(),
        name: faker.string.alphanumeric(),
        projectId,
        permissions: 4n,
        position: 0,
        oidcGroup: `/project-myproject/admin`,
        type: 'custom',
      }

      prisma.project.findUnique.mockResolvedValueOnce({ name: 'My Project', slug: 'myproject' } as any)
      prisma.projectRole.findMany.mockResolvedValueOnce([dbRole])

      const response = await listRoles(projectId)
      expect(response[0].oidcGroup).toBe('admin')
    })
  })

  describe('createRole', () => {
    it('should create role with incremented position when position 0 is the highest', async () => {
      const dbRole: Partial<ProjectRole> = {
        projectId,
        permissions: 4n,
        position: 0,
      }

      prisma.projectRole.findFirst.mockResolvedValueOnce(dbRole)
      prisma.projectRole.findMany.mockResolvedValueOnce([dbRole])
      prisma.projectRole.create.mockResolvedValue(null)
      await createRole(projectId, { name: 'test', permissions: '4' })

      expect(prisma.projectRole.create).toHaveBeenCalledWith({ data: { name: 'test', permissions: 4n, position: 1, projectId } })
    })

    it('should create role with incremented position with bigger position', async () => {
      const dbRole: Partial<ProjectRole> = {
        permissions: 4n,
        position: 50,
      }

      prisma.projectRole.findFirst.mockResolvedValueOnce(dbRole)
      prisma.projectRole.findMany.mockResolvedValueOnce([dbRole])
      prisma.projectRole.create.mockResolvedValue(null)
      await createRole(projectId, { name: 'test', permissions: '4' })

      expect(prisma.projectRole.create).toHaveBeenCalledWith({ data: { name: 'test', permissions: 4n, position: 51, projectId } })
    })

    it('should create role with incremented position with no role in db', async () => {
      const dbRole: Partial<ProjectRole> = {
        permissions: 4n,
        position: 50,
      }

      prisma.projectRole.findFirst.mockResolvedValueOnce(undefined)
      prisma.projectRole.findMany.mockResolvedValueOnce([dbRole])
      prisma.projectRole.create.mockResolvedValue(null)
      await createRole(projectId, { name: 'test', permissions: '4' })

      expect(prisma.projectRole.create).toHaveBeenCalledWith({ data: { name: 'test', permissions: 4n, position: 0, projectId } })
    })

    it('should create role with enforced oidcGroup prefix', async () => {
      const dbRole: any = {
        id: faker.string.uuid(),
        name: faker.string.alphanumeric(),
        projectId,
        permissions: 4n,
        position: 0,
        oidcGroup: '/project-myproject/admin',
        type: 'custom',
      }

      prisma.project.findUnique.mockResolvedValueOnce({ name: 'My Project', slug: 'myproject' } as any)
      prisma.projectRole.findFirst.mockResolvedValueOnce(dbRole)
      prisma.projectRole.create.mockResolvedValue(dbRole)
      // listRoles mock
      prisma.project.findUnique.mockResolvedValueOnce({ name: 'My Project', slug: 'myproject' } as any)
      prisma.projectRole.findMany.mockResolvedValueOnce([dbRole])

      await createRole(projectId, { name: 'test', permissions: '4', oidcGroup: 'admin' })

      expect(prisma.projectRole.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          oidcGroup: '/project-myproject/admin',
        }),
      }))
    })
  })

  describe('deleteRole', () => {
    const roleId = faker.string.uuid()
    it('should delete role and remove id from concerned users', async () => {
      const dbRole: Partial<ProjectRole> = {
        permissions: 4n,
        position: 50,
        id: faker.string.uuid(),
      }
      const members = [{
        userId: faker.string.uuid(),
        projectId,
        roleIds: [roleId],
      }, {
        userId: faker.string.uuid(),
        projectId,
        roleIds: [roleId, faker.string.uuid()],
      }] as const satisfies Partial<ProjectMembers>[]

      prisma.projectMembers.findMany.mockResolvedValueOnce(members)
      prisma.projectRole.findMany.mockResolvedValueOnce([])
      prisma.projectRole.delete.mockResolvedValue(dbRole)
      await deleteRole(roleId)

      expect(prisma.projectMembers.update).toHaveBeenNthCalledWith(1, { where: expect.any(Object), data: { roleIds: { set: [] } } })
      expect(prisma.projectMembers.update).toHaveBeenNthCalledWith(2, { where: expect.any(Object), data: { roleIds: { set: [members[1].roleIds[1]] } } })
      expect(prisma.projectRole.delete).toHaveBeenCalledWith({ where: { id: roleId } })
    })
  })
  describe.skip('countRolesMembers', () => {
    it('should return aggregated role member counts', async () => {
      const partialRoles = [{
        id: faker.string.uuid(),
      }, {
        id: faker.string.uuid(),
      }] as const satisfies Partial<ProjectRole>[]

      const users = [{
        projectRoleIds: [partialRoles[0].id, partialRoles[1].id],
      }, {
        projectRoleIds: [partialRoles[1].id],
      }] as const satisfies Partial<User>[]
      prisma.projectRole.findMany.mockResolvedValue(partialRoles)
      prisma.user.findMany.mockResolvedValue(users)

      const response = await countRolesMembers()

      expect(response).toEqual({ [partialRoles[0].id]: 1, [partialRoles[1].id]: 2 })
    })
  })
  describe('patchRoles', () => {
    const dbRoles: ProjectRole[] = [{
      id: faker.string.uuid(),
      name: faker.company.name(),
      permissions: faker.number.bigInt({ min: 0n, max: 50000n }),
      position: 0,
      projectId,
    }, {
      id: faker.string.uuid(),
      name: faker.company.name(),
      permissions: faker.number.bigInt({ min: 0n, max: 50000n }),
      position: 1,
      projectId,
    }]

    it('should do nothing', async () => {
      prisma.projectRole.findMany.mockResolvedValue([])
      await patchRoles(projectId, [])
      expect(prisma.projectRole.update).toHaveBeenCalledTimes(0)
    })

    it('should return 400 if incoherent positions', async () => {
      const updateRoles: Pick<ProjectRole, 'id' | 'position'> = [
        { id: dbRoles[0].id, position: 1 },
        { id: dbRoles[1].id, position: 1 },
      ]
      prisma.projectRole.findMany.mockResolvedValue(dbRoles)

      const response = await patchRoles(projectId, updateRoles)

      expect(response).instanceOf(BadRequest400)
      expect(prisma.projectRole.update).toHaveBeenCalledTimes(0)
    })

    it('should return 400 if incoherent positions (missing)', async () => {
      const updateRoles: Pick<ProjectRole, 'id' | 'position'> = [
        { id: dbRoles[1].id, position: 1 },
      ]
      prisma.projectRole.findMany.mockResolvedValue(dbRoles)

      const response = await patchRoles(projectId, updateRoles)

      expect(response).instanceOf(BadRequest400)
      expect(prisma.projectRole.update).toHaveBeenCalledTimes(0)
    })

    it('should update positions', async () => {
      const updateRoles: Pick<ProjectRole, 'id' | 'position'> = [
        { id: dbRoles[0].id, position: 1 },
        { id: dbRoles[1].id, position: 0 },
      ]
      prisma.projectRole.findMany.mockResolvedValue(dbRoles)

      await patchRoles(projectId, updateRoles)

      expect(prisma.projectRole.update).toHaveBeenCalledTimes(2)
    })

    it('should update permissions', async () => {
      const updateRoles: Pick<ProjectRole, 'id' | 'position'> = [
        { id: dbRoles[1].id, permissions: '0' },
      ]
      prisma.projectRole.findMany.mockResolvedValue(dbRoles)

      await patchRoles(projectId, updateRoles)

      expect(prisma.projectRole.update).toHaveBeenCalledTimes(1)
      expect(prisma.projectRole.update).toHaveBeenCalledWith({
        data: {
          name: dbRoles[1].name,
          permissions: 0n,
          position: 1,
        },
        where: {
          id: dbRoles[1].id,
        },
      })
    })

    it('should update role with enforced oidcGroup prefix', async () => {
      const updateRoles: any[] = [
        { id: dbRoles[1].id, oidcGroup: 'admin' },
      ]

      // patchRoles calls project.findUnique
      prisma.project.findUnique.mockResolvedValue({ name: 'My Project', slug: 'myproject' } as any)

      // patchRoles calls listRoles -> listRolesQuery
      // listRolesQuery returns DB roles.
      // We want to simulate DB having correct prefix or not?
      // Actually listRoles returns stripped.
      // So we mock findMany to return prefixed.
      const dbRoleWithPrefix = { ...dbRoles[1], oidcGroup: '/project-myproject/group2' }
      prisma.projectRole.findMany.mockResolvedValue([dbRoleWithPrefix])

      await patchRoles(projectId, updateRoles)

      expect(prisma.projectRole.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          oidcGroup: '/project-myproject/admin',
        }),
      }))
    })
  })
})
