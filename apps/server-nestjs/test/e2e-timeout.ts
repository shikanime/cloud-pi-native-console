// e2e specs hit real external services; the latency lives in the operation, not the test shape,
// so name the budget by what the call actually does instead of a bare size.
export const PROVISION_TIMEOUT = 30_000 // single small resource: sonarqube user + project
export const SYNC_GROUPS_TIMEOUT = 60_000 // keycloak group/role reconciliation
export const SYNC_EXTERNAL_TIMEOUT = 72_000 // gitlab group+member sync, nexus/registry external teardown
export const GIT_RECONCILE_TIMEOUT = 144_000 // argocd commit + sync to git
export const PROVISION_HEAVY_TIMEOUT = 180_000 // vault mount/policy/approle, zone secrets space
