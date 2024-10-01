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
    nock.cleanAll() // Clean up nock after each test
  })

  it('should delete a profile successfully', async () => {
    let deleteRequestBody

    // Mock the Token Query request (first API call)
    nock(gqlHostUrl)
      .post(gqlPath, (body) => {
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

    // Mock the deleteProfilesWithExternalIds mutation (second API call)
    nock(gqlHostUrl)
      .post(gqlPath, (body) => {
        deleteRequestBody = body // Capture the second request body
        return body
      })
      .reply(200, {
        data: {
          deleteProfilesWithExternalIds: {
            userErrors: []
          }
        }
      })

    // Create a test event with a userId
    const event = createTestEvent({
      userId: mockUserId, // Ensure userId is passed in the event
      type: 'identify',
      context: {
        personas: {
          computation_class: 'audience',
          computation_key: 'first_time_buyer',
          computation_id: 'aud_123'
        }
      }
    })

    // Pass the userId via the mapping to ensure it's part of the payload
    const responses = await testDestination.testAction('onDelete', {
      event,
      useDefaultMappings: true, // This ensures default mapping is applied
      mapping: { userId: mockUserId }, // Ensure mapping passes userId correctly
      settings: { apiKey: mockGqlKey }
    })

    // Assert that two responses were received
    expect(responses.length).toBe(2)

    // Ensure the second request body (profile deletion) matches the expected mutation
    expect(deleteRequestBody).toMatchInlineSnapshot(`
      Object {
        "query": "mutation {
          deleteProfilesWithExternalIds(
            externalIds: [\\"${mockUserId}\\"],
            advertiserIDs: [\\"${mockAdvertiserId}\\"],
            externalProvider: \\"segmentio\\"
          ) {
            userErrors {
              message
              path
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
    let deleteRequestBody

    // Define two events with valid userIds
    const events = [
      createTestEvent({ userId: 'user-id-1' }), // First event with userId-1
      createTestEvent({ userId: 'user-id-2' }) // Second event with userId-2
    ]

    // Mock the Token Query request (first API call)
    nock(gqlHostUrl)
      .post(gqlPath, (body) => {
        return body
      })
      .reply(200, {
        data: {
          tokenInfo: {
            scopesByAdvertiser: {
              nodes: [
                {
                  advertiser: {
                    id: mockAdvertiserId // Ensure an advertiser ID is returned
                  }
                }
              ]
            }
          }
        }
      })

    // Mock the deleteProfilesWithExternalIds mutation (second API call)
    nock(gqlHostUrl)
      .post(gqlPath, (body) => {
        deleteRequestBody = body // Capture the second request body
        return body
      })
      .reply(200, {
        data: {
          deleteProfilesWithExternalIds: {
            userErrors: []
          }
        }
      })

    // Execute the batch action
    const responses = await testDestination.testBatchAction('onDelete', {
      events, // Pass the array of events with userId values
      useDefaultMappings: true, // Apply the default mappings for each event
      settings: { apiKey: mockGqlKey }
    })

    // Assert that only one response was received for the batch action
    //expect(responses.length).toBe(1);
    expect(responses[0].status).toBe(200)

    // Ensure the second request body (batch profile deletion) matches the expected mutation
    expect(deleteRequestBody).toMatchInlineSnapshot(`
      Object {
        "query": "mutation {
          deleteProfilesWithExternalIds(
            externalIds: [\\"user-id-1\\", \\"user-id-2\\"],
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
})
