import { ActionDefinition, APIError, DynamicFieldResponse } from '@segment/actions-core'
import { Payload } from './generated-types'
import { Settings } from '../generated-types'
import { performForwardProfiles } from './functions'
import { domain } from '..'

interface Advertiser {
  id: string
  name: string
}

interface TokenInfoResponse {
  data: {
    tokenInfo: {
      scopesByAdvertiser: {
        nodes: {
          advertiser: Advertiser
          scopes: string[]
        }[]
        pageInfo: {
          hasNextPage: boolean
          endCursor: string
        }
      }
    }
  }
}

const action: ActionDefinition<Settings, Payload> = {
  title: 'Forward Profile',
  description: 'Forward new or updated user profile to StackAdapt',
  defaultSubscription: 'event = "Identify"',
  fields: {
    traits: {
      label: 'User Properties',
      type: 'object',
      description: 'The properties of the user.',
      default: {
        '@path': '$.traits'
      }
    },
    user_id: {
      label: 'Segment User ID',
      description: 'The ID of the user in Segment',
      type: 'string',
      default: {
        // By default we want to use the permanent user id that's consistent across a customer's lifetime.
        // But if we don't have that we can fall back to the anonymous id
        '@if': {
          exists: { '@path': '$.userId' },
          then: { '@path': '$.userId' },
          else: { '@path': '$.anonymousId' }
        }
      }
    },
    enable_batching: {
      type: 'boolean',
      label: 'Batch Profiles',
      unsafe_hidden: true,
      description:
        'When enabled, Segment will batch profiles together and send them to StackAdapt in a single request.',
      required: true,
      default: true
    },
    segment_computation_class: {
      label: 'Segment Computation Class',
      description: "Segment computation class used to determine if input event is from an Engage Audience'.",
      type: 'string',
      unsafe_hidden: true,
      default: {
        '@path': '$.context.personas.computation_class'
      }
    },
    segment_computation_id: {
      label: 'Segment Computation ID',
      description: 'For audience enter/exit events, this will be the audience ID.',
      type: 'string',
      unsafe_hidden: true,
      default: {
        '@path': '$.context.personas.computation_id'
      }
    },
    segment_computation_key: {
      label: 'Segment Computation Key',
      description: 'For audience enter/exit events, this will be the audience key.',
      type: 'string',
      unsafe_hidden: true,
      default: {
        '@path': '$.context.personas.computation_key'
      }
    },
    advertiser_id: {
      label: 'Audience',
      description: 'The StackAdapt audience to add the profile to.',
      type: 'string',
      required: true,
      dynamic: true
    }
  },
  dynamicFields: {
    advertiser_id: async (request, { page }): Promise<DynamicFieldResponse> => {
      // Even though its typescript type is string, in testing I found page can be a number so I use == here
      console.log(page)
      page = !page || page == '1' ? '' : page
      try {
        const query = `query {
          tokenInfo {
            scopesByAdvertiser(after: "${page}", first: 10) {
              nodes {
                advertiser {
                  id
                  name
                }
                scopes
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        }`
        const response = await request<TokenInfoResponse>(domain, {
          body: JSON.stringify({ query })
        })
        const scopesByAdvertiser = response.data.data.tokenInfo.scopesByAdvertiser
        const choices = scopesByAdvertiser.nodes
          .filter((advertiserEntry) => advertiserEntry.scopes.includes('WRITE'))
          .map((advertiserEntry) => ({ value: advertiserEntry.advertiser.id, label: advertiserEntry.advertiser.name }))
        const nextPage = scopesByAdvertiser.pageInfo.hasNextPage ? scopesByAdvertiser.pageInfo.endCursor : undefined
        console.log(`NextPage: ${nextPage}`)
        return {
          choices,
          nextPage
        }
      } catch (error) {
        return {
          choices: [],
          nextPage: '',
          error: {
            message: (error as APIError).message ?? 'Unknown error',
            code: (error as APIError).status?.toString() ?? 'Unknown error'
          }
        }
      }
    }
  },
  perform: async (request, { payload }) => {
    return await performForwardProfiles(request, [payload])
  },
  performBatch: async (request, { payload }) => {
    return await performForwardProfiles(request, payload)
  }
}

export default action
