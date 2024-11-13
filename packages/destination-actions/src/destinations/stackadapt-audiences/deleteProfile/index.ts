import { ActionDefinition } from '@segment/actions-core'
import { Settings } from '../generated-types'
import { onDelete } from './functions'
import { Payload } from './generated-types'

const action: ActionDefinition<Settings, Payload> = {
  title: 'Delete Profiles',
  description: 'Deletes a profile by userId and advertiser IDs.',
  fields: {
    userId: {
      label: 'User ID',
      description: 'The user ID to delete.',
      type: 'string',
      required: false
    },
    advertiserId: {
      label: 'Advertiser IDs',
      description: 'Comma-separated list of advertiser IDs to delete.',
      type: 'string',
      required: false
    },
    externalProvider: {
      label: 'External Provider',
      description: 'The external provider to delete the profile from.',
      type: 'string',
      required: false
    }
  },
  perform: async (request, { payload }) => {
    // For single profile deletion
    return await onDelete(request, payload)
  }
}

export default action
