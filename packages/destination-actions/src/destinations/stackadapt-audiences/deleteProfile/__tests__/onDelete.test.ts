import nock from 'nock'
import { createTestEvent, createTestIntegration } from '@segment/actions-core'
import Definition from '../../index'
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
    let deleteRequestBody

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

    nock(gqlHostUrl)
      .post(gqlPath, (body) => {
        deleteRequestBody = body
        return body
      })
      .reply(200, {
        data: {
          deleteProfilesWithExternalIds: {
            userErrors: []
          }
        }
      })

    const event = createTestEvent({
      userId: mockUserId,
      type: 'identify',
      context: {
        personas: {
          computation_class: 'audience',
          computation_key: 'first_time_buyer',
          computation_id: 'aud_123'
        }
      }
    })

    const responses = await testDestination.testAction('onDelete', {
      event,
      useDefaultMappings: true,
      mapping: { userId: mockUserId },
      settings: { apiKey: mockGqlKey }
    })

    // Assert that two responses were received, one for the token query and one for the profile deletion
    expect(responses.length).toBe(2)

    // Ensure the second request body (profile deletion) matches the expected mutation
    expect(deleteRequestBody).toMatchInlineSnapshot(`
      Object {
        "query": "mutation {
            deleteProfilesWithExternalIds(
              externalIds: [\\"user-id\\"],
              advertiserIDs: [\\"23\\"],
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

  it('should perform onDelete with a userID and two advertiserIDs from a single token request', async () => {
    let deleteRequestBody

    const event: Partial<SegmentEvent> = {
      userId: 'user-id-1',
      type: 'identify',
      traits: {
        first_time_buyer: true
      },
      context: {
        personas: {
          computation_class: 'audience',
          computation_key: 'first_time_buyer',
          computation_id: 'aud_123'
        }
      }
    }

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
                    id: 'advertiser-id-1'
                  }
                },
                {
                  advertiser: {
                    id: 'advertiser-id-2'
                  }
                }
              ]
            }
          }
        }
      })

    nock(gqlHostUrl)
      .post(gqlPath, (body) => {
        deleteRequestBody = body
        return body
      })
      .reply(200, {
        data: {
          deleteProfilesWithExternalIds: {
            userErrors: []
          }
        }
      })

    const responses = await testDestination.testAction('onDelete', {
      event,
      useDefaultMappings: true,
      mapping: { userId: 'user-id-1' },
      settings: { apiKey: mockGqlKey }
    })

    expect(responses[0].status).toBe(200)

    // Ensure the mutation request body contains the correct userId and advertiserIDs
    expect(deleteRequestBody).toMatchInlineSnapshot(`
      Object {
        "query": "mutation {
            deleteProfilesWithExternalIds(
              externalIds: [\\"user-id-1\\"],
              advertiserIDs: [\\"advertiser-id-1\\", \\"advertiser-id-2\\"],
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
})
