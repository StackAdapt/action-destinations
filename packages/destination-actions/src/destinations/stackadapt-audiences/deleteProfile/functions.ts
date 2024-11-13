import { GQL_ENDPOINT, EXTERNAL_PROVIDER, sha256hash } from '../functions'
import { Payload } from './generated-types'

class IntegrationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IntegrationError'
    Object.setPrototypeOf(this, IntegrationError.prototype)
  }
}

export async function onDelete(request: any, payload: Payload) {
  return (async () => {
    const userId = payload.userId

    const formattedExternalIds = `["${userId}"]`

    // hashing to get syncIds with userId converted to string
    const syncIds = [sha256hash(String(userId))]
    const formattedSyncIds = `[${syncIds.map((syncId: string) => `"${syncId}"`).join(', ')}]`

    const query = `mutation {
      deleteProfilesWithExternalIds(
        externalIds: ${formattedExternalIds},
        externalProvider: "${EXTERNAL_PROVIDER}"
        syncIds: ${formattedSyncIds}
      ) {
        userErrors {
          message
          path
        }
      }
    }`

    const res = await request(GQL_ENDPOINT, {
      body: JSON.stringify({ query })
    })

    if (res.status !== 200) {
      throw new IntegrationError('Failed to delete profile: ' + res.statusText)
    }

    const result = await res.json()

    if (result.data.deleteProfilesWithExternalIds.userErrors.length > 0) {
      throw new IntegrationError(
        'Profile deletion was not successful: ' +
          result.data.deleteProfilesWithExternalIds.userErrors.map((e: any) => e.message).join(', ')
      )
    }

    return result
  })()
}
