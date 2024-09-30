import type { DestinationDefinition } from '@segment/actions-core'
import type { Settings } from './generated-types'

import forwardProfile from './forwardProfile'
import forwardAudienceEvent from './forwardAudienceEvent'
import { AdvertiserScopesResponse } from './types'
import { GQL_ENDPOINT } from './functions'

const destination: DestinationDefinition<Settings> = {
  name: 'StackAdapt Audiences',
  slug: 'actions-stackadapt-audiences',
  mode: 'cloud',

  authentication: {
    scheme: 'custom',
    fields: {
      apiKey: {
        label: 'GraphQL Token',
        description: 'Your StackAdapt GQL API Token',
        type: 'string',
        required: true
      }
    },
    testAuthentication: async (request) => {
      const scopeQuery = `query {
        tokenInfo {
          scopesByAdvertiser {
            nodes {
              advertiser {
                name
              }
              scopes
            }
          }
        }
      }`

      const res = await request(GQL_ENDPOINT, {
        body: JSON.stringify({ query: scopeQuery }),
        throwHttpErrors: false
      })
      if (res.status !== 200) {
        throw new Error(res.status + res.statusText)
      }
      const canWrite = (
        (await res.json()) as AdvertiserScopesResponse
      ).data?.tokenInfo?.scopesByAdvertiser?.nodes?.some((node: { scopes: string[] }) => node.scopes.includes('WRITE'))
      if (!canWrite) {
        throw new Error('Please verify your GQL Token or contact support')
      }
    }
  },
  extendRequest: ({ settings }) => {
    return {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`
      }
    }
  },
  actions: {
    forwardProfile,
    forwardAudienceEvent
  },
  onDelete: async (request, { payload }) => {
    const userId = payload.userId ?? payload.anonymousId
    // query tokenInfo to get advertiserID
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
      body: JSON.stringify({ query: TokenQuery }),
      throwHttpErrors: false
    })

    if (res_token.status !== 200) {
      throw new Error('Failed to fetch advertiser information: ' + res_token.statusText)
    }

    const result_token = await res_token.json()
    const advertiserNode = result_token.data?.tokenInfo?.scopesByAdvertiser?.nodes

    if (!advertiserNode || advertiserNode.length === 0) {
      throw new Error('No advertiser ID found.')
    }
    // Collect advertiser IDs into an array
    const advertiserIds = advertiserNode.map((node: { advertiser: { id: string } }) => node.advertiser.id)

    const formattedExternalIds = `["${userId}"]`
    const formattedAdvertiserIds = `[${advertiserIds.map((id: string) => `"${id}"`).join(', ')}]`
    const query = `mutation {
      deleteProfilesWithExternalIds(
        externalIds: ${formattedExternalIds},
        advertiserIDs: ${formattedAdvertiserIds}
      ) {
        userErrors {
          message
          path
        }
      }
    }`

    const res = await request(GQL_ENDPOINT, {
      body: JSON.stringify({ query }),
      throwHttpErrors: false
    })

    if (res.status !== 200) {
      throw new Error('Failed to delete profile: ' + res.statusText)
    }

    interface UserError {
      message: string
      path: string[]
    }
    const result = await res.json()
    if (result.data.deleteProfile.userErrors.length > 0) {
      throw new Error(
        'Profile deletion was not successful: ' +
          result.data.deleteProfile.userErrors.map((e: UserError) => e.message).join(', ')
      )
    }

    return result
  }
}

export default destination
