import type { SetupServerApi } from 'msw/node'
import type { RequestHandler, WebSocketHandler } from 'msw'
import type { SonarqubeGeneratedToken, SonarqubeGroup, SonarqubePaging, SonarqubeProject, SonarqubeUser } from './sonarqube-client.service'
import type { ProjectWithDetails } from './sonarqube-datastore.service'
import { faker } from '@faker-js/faker'
import { SONARQUBE_PROJECT_QUALIFIER_PROJECT } from './sonarqube.constants'
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

export function makeUserToken(overrides: Partial<SonarqubeGeneratedToken> = {}) {
  return {
    token: faker.string.uuid(),
    login: faker.internet.username(),
    name: faker.person.fullName(),
    ...overrides,
  } satisfies SonarqubeGeneratedToken
}

export function makeEmptyGroupsResponse() {
  return { paging: makeSonarqubePaging(), groups: [] }
}

export function makeEmptyUsersResponse() {
  return { paging: makeSonarqubePaging(), users: [] }
}

export function makeEmptyProjectsResponse() {
  return { paging: makeSonarqubePaging(), components: [] }
}

export function makeProjectWithDetails(overrides: Partial<ProjectWithDetails> = {}): ProjectWithDetails {
  return {
    id: faker.string.uuid(),
    slug: faker.internet.domainWord(),
    repositories: [],
    plugins: [],
    owner: { email: faker.internet.email() },
    ...overrides,
  } satisfies ProjectWithDetails
}

export function makeSonarqubeGroup(overrides: Partial<SonarqubeGroup> = {}): SonarqubeGroup {
  return {
    id: faker.string.uuid(),
    name: faker.internet.domainWord(),
    description: '',
    membersCount: 0,
    default: false,
    ...overrides,
  } satisfies SonarqubeGroup
}

export function makeSonarqubeUser(overrides: Partial<SonarqubeUser> = {}): SonarqubeUser {
  return {
    login: faker.internet.username(),
    name: faker.person.fullName(),
    active: true,
    email: faker.internet.email(),
    groups: [],
    tokensCount: 0,
    local: true,
    externalIdentity: '',
    externalProvider: '',
    managed: false,
    ...overrides,
  } satisfies SonarqubeUser
}

export function makeSonarqubeProject(overrides: Partial<SonarqubeProject> = {}): SonarqubeProject {
  return {
    key: faker.string.alphanumeric(20),
    name: faker.internet.domainWord(),
    qualifier: SONARQUBE_PROJECT_QUALIFIER_PROJECT,
    visibility: 'private',
    ...overrides,
  } satisfies SonarqubeProject
}

export function makeSonarqubePaging(overrides: Partial<SonarqubePaging> = {}): SonarqubePaging {
  return {
    pageIndex: 1,
    pageSize: 100,
    total: 0,
    ...overrides,
  } satisfies SonarqubePaging
}

export function makeSonarqubeGeneratedToken(overrides: Partial<SonarqubeGeneratedToken> = {}): SonarqubeGeneratedToken {
  return {
    token: faker.string.alphanumeric(40),
    login: faker.internet.username(),
    name: `Sonar Token for ${faker.internet.username()}`,
    ...overrides,
  } satisfies SonarqubeGeneratedToken
}
