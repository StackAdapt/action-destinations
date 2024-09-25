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
    const query = `mutation {
      deleteProfilesFromSegmentioSourcePod(
        userID: "${userId}"
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

    const result = await res.json()
    if (result.data.deleteProfile.userErrors.length > 0) {
      throw new Error(
        'Profile deletion was not successful: ' + result.data.deleteProfile.userErrors.map((e) => e.message).join(', ')
      )
    }

    return result
  }
}

export default destination
