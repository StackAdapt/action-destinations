import type { DestinationDefinition } from '@segment/actions-core'
import type { Settings } from './generated-types'

import getAudience from './getAudience'

const destination: DestinationDefinition<Settings> = {
  name: 'Stack Adapt',
  slug: 'actions-stackadapt',
  mode: 'cloud',

  authentication: {
    scheme: 'custom',
    fields: {
      apiKey: {
        label: 'API Key provided by StackAdapt integration',
        description: 'APIKey used for StackAdapt GraphQL API authorization before sending custom audiences data',
        type: 'password',
        required: true
      },
      endpoint: {
        label: 'Environment',
        description: 'Sandbox or Production',
        type: 'string',
        choices: [
          { label: 'Production', value: 'production' },
          { label: 'Sandbox', value: 'sandbox' }
        ],
        default: 'sandbox',
        required: true
      }
    },

      // Return a request that tests/validates the user's credentials.
      // If you do not have a way to validate the authentication fields safely,
      // you can remove the `testAuthentication` function, though discouraged.


    testAuthentication: async (request, { settings }) => {
      const res = await request(`${settings.endpoint}/auth/sdk`, {
        method: 'get'
      })
      return res.status == 200
    }
  },

  // onDelete: async (request, { settings, payload }) => {
  //   // Return a request that performs a GDPR delete for the provided Segment userId or anonymousId
  //   // provided in the payload. If your destination does not support GDPR deletion you should not
  //   // implement this function and should remove it completely.
  // },

  extendRequest({ settings }) {
    return {
      headers: { Authorization: `Bearer ${settings.apiKey}` }
    }
  },

  actions: {
    getAudience
  }
}

export default destination
