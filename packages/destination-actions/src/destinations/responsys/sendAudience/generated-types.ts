// Generated file. DO NOT MODIFY IT BY HAND.

export interface Payload {
  /**
   * Record data that represents field names and corresponding values for each profile.
   */
  userData: {
    /**
     * The user's email address
     */
    EMAIL_ADDRESS_?: string
    /**
     * Responsys Customer ID.
     */
    CUSTOMER_ID_?: string
    [k: string]: unknown
  }
  /**
   * A unique identifier assigned to a specific audience in Segment.
   */
  computation_key: string
  /**
   * Hidden field used to access traits or properties objects from Engage payloads.
   */
  traits_or_props: {
    [k: string]: unknown
  }
  /**
   * Hidden field used to verify that the payload is generated by an Audience. Payloads not containing computation_class = 'audience' or 'journey_step' will be dropped before the perform() fuction call.
   */
  computation_class: string
  /**
   * Once enabled, Segment will collect events into batches of 200 before sending to Responsys.
   */
  enable_batching?: boolean
  /**
   * Maximum number of events to include in each batch. Actual batch sizes may be lower.
   */
  batch_size?: number
  /**
   * If true, all Recipient data will be converted to strings before being sent to Responsys.
   */
  stringify: boolean
  /**
   * The timestamp of when the event occurred.
   */
  timestamp: string | number
  /**
   * A delay of the selected seconds will be added before retrying a failed request.
   *                     Max delay allowed is 600 secs (10 mins). The default is 0 seconds.
   */
  retry?: number
}
