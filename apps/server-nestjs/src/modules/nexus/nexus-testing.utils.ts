import type { SetupServerApi } from 'msw/node'
import type { RequestHandler, WebSocketHandler } from 'msw'
import type { ProjectWithDetails } from './nexus-datastore.service'
import { faker } from '@faker-js/faker'
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

export function makeProjectWithDetails(overrides: Partial<ProjectWithDetails> = {}): ProjectWithDetails {
  return {
    slug: faker.internet.domainWord(),
    owner: {
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      email: faker.internet.email(),
    },
    plugins: [],
    ...overrides,
  } satisfies ProjectWithDetails
}
