import type { ActionDefinition } from '@segment/actions-core'
import type { Settings } from '../generated-types'
import type { Payload } from './generated-types'
import { ENDPOINT_MAPPING, mapEndpoint } from '../utils'

const action: ActionDefinition<Settings, Payload> = {
  title: 'Get Audience',
  description: 'Gets an existing audience',
  fields: {
    externalId: {
      label: "Audience id",
      description: "The Stackadapt Audience Id to be fetched",
      type: "string",
      required: true
    }
  },
  perform: (request, {payload, settings }) => {
    const { externalId } = payload
    const endpoint = mapEndpoint(settings.endpoint as keyof typeof ENDPOINT_MAPPING);

    return request(endpoint, {
      method: 'post',
      json: {
        operationName: 'GetExistingSegment',
        query: `query GetExistingSegment($externalId: ID!) {
            customSegment(id: $externalId) {
              id
            }
          }`,
        variables: {
          externalId,
        }
      }
    })
  }
}

export default action
