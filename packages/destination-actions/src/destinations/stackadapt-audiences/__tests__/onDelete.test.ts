import nock from 'nock'
import { createTestEvent, createTestIntegration } from '@segment/actions-core'
import Definition from '../index'
import { SegmentEvent } from '@segment/actions-core/*'

const testDestination = createTestIntegration(Definition)
const mockGqlKey = 'test-graphql-key'

const gqlHostUrl = 'https://api.stackadapt.com'
const gqlPath = '/graphql'
const mockUserId = 'user-id'
const mockAdvertiserId = '23'
const mockMappings = { advertiser_id: mockAdvertiserId }

const deleteEventPayload: Partial<SegmentEvent> = {
  userId: mockUserId,
  type: 'identify',
  context: {
    personas: {
      computation_class: 'audience',
      computation_key: 'first_time_buyer',
      computation_id: 'aud_123'
    }
  }
}

describe('onDelete action', () => {
  afterEach(() => {
    nock.cleanAll()
  })

  it('should delete a profile successfully', async () => {
    let requestBody

    // Mock the Token Query request
    nock(gqlHostUrl)
      .post(gqlPath, (body) => {
        requestBody = body
        return body
      })
      .reply(200, {
        data: {
          tokenInfo: {
            scopesByAdvertiser: {
              nodes: [
                {
                  advertiser: {
                    id: mockAdvertiserId
                  }
                }
              ]
            }
          }
        }
      })

    // Mock the deleteProfilesWithExternalIds mutation
    nock(gqlHostUrl)
      .post(gqlPath)
      .reply(200, {
        data: {
          deleteProfilesWithExternalIds: {
            userErrors: []
          }
        }
      })

    const event = createTestEvent(deleteEventPayload)
    const responses = await testDestination.testAction('onDelete', {
      event,
      useDefaultMappings: true,
      mapping: mockMappings,
      settings: { apiKey: mockGqlKey }
    })

    expect(responses.length).toBe(1)
    expect(responses[0].status).toBe(200)
    expect(responses[0].request.headers).toMatchInlineSnapshot(`
      Headers {
        Symbol(map): Object {
          "authorization": Array [
            "Bearer test-graphql-key",
          ],
          "content-type": Array [
            "application/json",
          ],
          "user-agent": Array [
            "Segment (Actions)",
          ],
        },
      }
    `)
    expect(requestBody).toMatchInlineSnapshot(`
      Object {
        "query": "mutation {
          deleteProfilesWithExternalIds(
            externalIds: [\\"${mockUserId}\\"],
            advertiserIDs: [\\"${mockAdvertiserId}\\"],
            externalProvider: \\"segmentio\\"
          ) {
            userErrors {
              message
            }
          }
        }",
      }
    `)
  })

  it('should throw error if no advertiser ID is found', async () => {
    // Mock the Token Query response with no advertiser ID
    nock(gqlHostUrl)
      .post(gqlPath)
      .reply(200, {
        data: {
          tokenInfo: {
            scopesByAdvertiser: {
              nodes: []
            }
          }
        }
      })

    const event = createTestEvent(deleteEventPayload)

    await expect(
      testDestination.testAction('onDelete', {
        event,
        useDefaultMappings: true,
        mapping: mockMappings,
        settings: { apiKey: mockGqlKey }
      })
    ).rejects.toThrow('No advertiser ID found.')
  })

  it('should throw error if profile deletion fails', async () => {
    // Mock the Token Query response
    nock(gqlHostUrl)
      .post(gqlPath)
      .reply(200, {
        data: {
          tokenInfo: {
            scopesByAdvertiser: {
              nodes: [
                {
                  advertiser: {
                    id: mockAdvertiserId
                  }
                }
              ]
            }
          }
        }
      })

    // Mock the deleteProfilesWithExternalIds mutation with an error
    nock(gqlHostUrl)
      .post(gqlPath)
      .reply(200, {
        data: {
          deleteProfilesWithExternalIds: {
            userErrors: [{ message: 'Deletion failed' }]
          }
        }
      })

    const event = createTestEvent(deleteEventPayload)

    await expect(
      testDestination.testAction('onDelete', {
        event,
        useDefaultMappings: true,
        mapping: mockMappings,
        settings: { apiKey: mockGqlKey }
      })
    ).rejects.toThrow('Profile deletion was not successful: Deletion failed')
  })

  it('should batch multiple delete profile events into a single request', async () => {
    let requestBody
    const events = [createTestEvent(deleteEventPayload), createTestEvent(deleteEventPayload)]

    nock(gqlHostUrl)
      .post(gqlPath, (body) => {
        requestBody = body
        return body
      })
      .reply(200, {
        data: {
          deleteProfilesWithExternalIds: {
            userErrors: []
          }
        }
      })

    const responses = await testDestination.testBatchAction('onDelete', {
      events,
      useDefaultMappings: true,
      mapping: mockMappings,
      settings: { apiKey: mockGqlKey }
    })

    expect(responses.length).toBe(1)
    expect(responses[0].status).toBe(200)
    expect(requestBody).toMatchInlineSnapshot(`
      Object {
        "query": "mutation {
          deleteProfilesWithExternalIds(
            externalIds: [\\"user-id\\", \\"user-id\\"],
            advertiserIDs: [\\"23\\"],
            externalProvider: \\"segmentio\\"
          ) {
            userErrors {
              message
            }
          }
        }",
      }
    `)
  })
})
