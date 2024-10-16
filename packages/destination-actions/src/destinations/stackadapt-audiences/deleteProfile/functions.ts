import { GQL_ENDPOINT, EXTERNAL_PROVIDER, sha256hash } from '../functions'
import { Payload } from './generated-types'

class IntegrationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IntegrationError'
    Object.setPrototypeOf(this, IntegrationError.prototype)
  }
}

export async function onDelete(request: any, payload: Payload[]) {
  return (async () => {
    const userId = payload[0].userId
    const TokenQuery = `query TokenInfo {
      tokenInfo {
        scopesByAdvertiser {
          nodes {
            advertiser {
              id
            }
          }
          totalCount
        }
      }
    }`

    const res_token = await request(GQL_ENDPOINT, {
      body: JSON.stringify({ query: TokenQuery })
    })

    if (res_token.status !== 200) {
      throw new IntegrationError('Failed to fetch advertiser information: ' + res_token.statusText)
    }

    const result_token = await res_token.json()
    const advertiserNode = result_token.data?.tokenInfo?.scopesByAdvertiser?.nodes

    if (!advertiserNode || advertiserNode.length === 0) {
      throw new IntegrationError('No advertiser ID found.')
    }

    const advertiserIds = advertiserNode.map((node: { advertiser: { id: string } }) => node.advertiser.id)

    const formattedExternalIds = `["${userId}"]`
    const formattedAdvertiserIds = `[${advertiserIds.map((id: string) => `"${id}"`).join(', ')}]`

    // hashing to get syncIds
    const syncIds = advertiserIds.map((id: string) => sha256hash(id))
    const formattedSyncIds = `[${syncIds.map((syncId: string) => `"${syncId}"`).join(', ')}]`

    const query = `mutation {
      deleteProfilesWithExternalIds(
        externalIds: ${formattedExternalIds},
        advertiserIDs: ${formattedAdvertiserIds},
        externalProvider: "${EXTERNAL_PROVIDER}"
        syncIds: ${formattedSyncIds}
      ) {
        userErrors {
          message
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
