import nock from 'nock'
import { createTestEvent, createTestIntegration } from '@segment/actions-core'
import Definition from '../../index'
import { SegmentEvent } from '@segment/actions-core/*'

const testDestination = createTestIntegration(Definition)
const mockGqlKey = 'test-graphql-key'

const gqlHostUrl = 'https://api.stackadapt.com'
const gqlPath = '/graphql'
const mockUserId = 'user-id'

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

// Helper function to mock the profile deletion mutation
const mockDeleteProfilesMutation = (
  deleteRequestBodyRef: { body?: any },
  userErrors: Array<{ message: string }> = []
) => {
  nock(gqlHostUrl)
    .post(gqlPath, (body) => {
      deleteRequestBodyRef.body = body
      return body
    })
    .reply(200, {
      data: {
        deleteProfilesWithExternalIds: {
          userErrors: userErrors
        }
      }
    })
}

// Helper function to assert the mutation request body without advertiser IDs or batch handling
const expectDeleteProfilesMutation = (
  deleteRequestBody: { body?: any },
  expectedExternalIds: string[],
  expectedSyncIds: string[]
) => {
  expect(deleteRequestBody.body).toMatchInlineSnapshot(`
    Object {
      "query": "mutation {
          deleteProfilesWithExternalIds(
            externalIds: [\\"${expectedExternalIds.join('\\", \\"')}\\"],
            externalProvider: \\"segmentio\\"
            syncIds: [\\"${expectedSyncIds.join('\\", \\"')}\\"]
          ) {
            userErrors {
              message
              path
            }
          }
        }",
    }
  `)
}

describe('onDelete action', () => {
  afterEach(() => {
    nock.cleanAll()
  })

  it('should delete a profile successfully', async () => {
    const deleteRequestBody: { body?: any } = {}

    mockDeleteProfilesMutation(deleteRequestBody)

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

    expect(responses.length).toBe(1)
    expectDeleteProfilesMutation(
      deleteRequestBody,
      ['user-id'],
      ['a7571ddec1df43045ac667d7c976bd1149fe9a2dbb3fb55357beed582e11538d']
    )
  })

  it('should throw error if profile deletion fails', async () => {
    const deleteRequestBody: { body?: any } = {}

    mockDeleteProfilesMutation(deleteRequestBody, [{ message: 'Deletion failed' }])

    const event = createTestEvent(deleteEventPayload)

    await expect(
      testDestination.testAction('onDelete', {
        event,
        useDefaultMappings: true,
        mapping: { userId: mockUserId },
        settings: { apiKey: mockGqlKey }
      })
    ).rejects.toThrow('Profile deletion was not successful: Deletion failed')
  })
})
