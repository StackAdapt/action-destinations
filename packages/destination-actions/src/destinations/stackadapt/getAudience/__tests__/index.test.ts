import nock from 'nock'
import { createTestIntegration } from '@segment/actions-core'
import Destination from '../../index'
import { mapEndpoint } from '../../utils'

const testDestination = createTestIntegration(Destination)

const getAudienceInput = {
  mapping: {externalId: 123},
  settings: { apiKey: 'my-api-key', endpoint: 'sandbox' }
}

describe('StackAdapt.getAudience', () => {
  it('should return an existing segment', async () => {
    nock(mapEndpoint('sandbox'))
      .post('')
      .reply(200, {
        data: {
          id: 123
        }
      })

    const t = await testDestination.testAction('getAudience', getAudienceInput)

    expect(t[0].status).toBe(200)

    const query = {
      operationName: 'GetExistingSegment',
      query: `query GetExistingSegment($externalId: ID!) {
            customSegment(id: $externalId) {
              id
            }
          }`,
      variables: {
        externalId: "123",
      }
    }

    expect(t[0].options.body).toEqual(JSON.stringify(query))
  })
})
