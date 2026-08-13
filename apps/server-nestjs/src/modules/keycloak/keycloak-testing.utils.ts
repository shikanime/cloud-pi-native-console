import type GroupRepresentation from '@keycloak/keycloak-admin-client/lib/defs/groupRepresentation'
import type UserRepresentation from '@keycloak/keycloak-admin-client/lib/defs/userRepresentation'
import type { ProjectWithDetails } from './keycloak-datastore.service'

import { faker } from '@faker-js/faker'

import type { SetupServerApi } from 'msw/node'
import type { RequestHandler, WebSocketHandler } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll } from 'vitest'

type Handler = RequestHandler | WebSocketHandler

function isHandler(value: unknown): value is Handler {
  return !!value && typeof value === 'object' && ('info' in value || 'test' in value)
}

// ponytail: clears every @mswjs/data model between tests; extend if a model
// ever holds non-deletable state.
function resetDb(db: object) {
  for (const model of Object.values(db)) {
    if (typeof model === 'function' && typeof (model as { deleteMany?: unknown }).deleteMany === 'function') {
      (model as { deleteMany: (query: object) => unknown }).deleteMany({})
    }
  }
}

export function setupMockServer<DB>(db: DB, ...handlers: Handler[]): SetupServerApi
export function setupMockServer(...handlers: Handler[]): SetupServerApi
export function setupMockServer<DB>(dbOrHandler?: DB | Handler, ...handlers: Handler[]): SetupServerApi {
  let db: DB | undefined
  let allHandlers: Handler[]
  if (isHandler(dbOrHandler)) {
    allHandlers = [dbOrHandler, ...handlers]
  } else {
    db = dbOrHandler
    allHandlers = handlers
  }

  const server = setupServer(...allHandlers)
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
  afterEach(() => {
    server.resetHandlers()
    if (db) resetDb(db)
  })
  afterAll(() => server.close())
  return server
}

export function makeUserRepresentation(
  overrides: Partial<UserRepresentation> = {},
) {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email().toLowerCase(),
    username: faker.internet.username(),
    enabled: true,
    ...overrides,
  } satisfies UserRepresentation
}

export function makeGroupRepresentation(
  overrides: Partial<GroupRepresentation> = {},
) {
  return {
    id: faker.string.uuid(),
    name: faker.word.noun(),
    path: `/${faker.word.noun()}`,
    subGroups: [],
    ...overrides,
  } satisfies GroupRepresentation
}

export function makeProjectUser(
  overrides: Partial<ProjectWithDetails['members'][number]['user']> = {},
) {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email().toLowerCase(),
    ...overrides,
  } satisfies ProjectWithDetails['members'][number]['user']
}

export function makeProjectMember(
  overrides: Partial<ProjectWithDetails['members'][number]> = {},
) {
  return {
    roleIds: [],
    user: makeProjectUser(),
    ...overrides,
  } satisfies ProjectWithDetails['members'][number]
}

export function makeProjectRole(
  overrides: Partial<ProjectWithDetails['roles'][number]> = {},
) {
  return {
    id: faker.string.uuid(),
    permissions: 0n,
    oidcGroup: '',
    type: 'managed',
    ...overrides,
  } satisfies ProjectWithDetails['roles'][number]
}

export function makeProjectEnvironment(
  overrides: Partial<ProjectWithDetails['environments'][number]> = {},
) {
  return {
    id: faker.string.uuid(),
    name: faker.word.noun(),
    ...overrides,
  } satisfies ProjectWithDetails['environments'][number]
}

export function makeProjectWithDetails(
  overrides: Partial<ProjectWithDetails> = {},
) {
  return {
    id: faker.string.uuid(),
    slug: faker.helpers.slugify(faker.word.words({ count: 2 })).toLowerCase(),
    ownerId: faker.string.uuid(),
    everyonePerms: 0n,
    plugins: [],
    members: [],
    roles: [],
    environments: [],
    ...overrides,
  } satisfies ProjectWithDetails
}
