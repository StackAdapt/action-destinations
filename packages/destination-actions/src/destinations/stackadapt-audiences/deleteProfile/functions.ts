import { GQL_ENDPOINT, EXTERNAL_PROVIDER, sha256hash } from '../functions'
import { Payload } from './generated-types'

export async function onDelete(request: any, payload: Payload) {
  return (async () => {
    const userId = payload.userId

    const formattedExternalIds = `["${userId}"]`

    // hashing to get syncIds with userId converted to string
    const syncIds = [sha256hash(String(userId))]
    const formattedSyncIds = `[${syncIds.map((syncId: string) => `"${syncId}"`).join(', ')}]`

    const mutation = `mutation {
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

    return await request(GQL_ENDPOINT, {
      body: JSON.stringify({ query: mutation })
    })
  })()
}
