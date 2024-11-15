import type { DestinationDefinition } from '@segment/actions-core'
import type { Settings } from './generated-types'

import forwardProfile from './forwardProfile'
import forwardAudienceEvent from './forwardAudienceEvent'
import { AdvertiserScopesResponse } from './types'
import { GQL_ENDPOINT, EXTERNAL_PROVIDER, sha256hash } from './functions'

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

  onDelete: async (request, { payload }) => {
    const userId = payload.userId
    const formattedExternalIds = `["${userId}"]`

    const syncId = [sha256hash(String(userId))]

    const mutation = `mutation {
      deleteProfilesWithExternalIds(
        externalIds: ${formattedExternalIds},
        externalProvider: "${EXTERNAL_PROVIDER}",
        syncIds: ${syncId}
      ) {
        userErrors {
          message
          path
        }
      }
    }`

    try {
      const response = await request(GQL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: mutation })
      })

      const result = await response.json()

      if (result.data.deleteProfilesWithExternalIds.userErrors.length > 0) {
        const errorMessages = result.data.deleteProfilesWithExternalIds.userErrors.map((e: any) => e.message).join(', ')
        throw new Error(`Profile deletion was not successful: ${errorMessages}`)
      }

      return result
    } catch (error) {
      console.error('Error in onDelete action:', error)
      if (error instanceof Error) {
        throw new Error(`Failed to execute onDelete action: ${error.message}`)
      } else {
        throw new Error(`Failed to execute onDelete action: ${String(error)}`)
      }
    }
  },

  actions: {
    forwardProfile,
    forwardAudienceEvent
  }
}

export default destination
