export const SEARCH_ADAPTER_TOKEN = 'SEARCH_ADAPTER_TOKEN';

export interface ISearchAdapter {
  /**
   * Index a single VERIFIED mentor into the search index.
   * Implementations must validate that the mentor is VERIFIED before indexing.
   */
  indexMentor(mentorProfileId: string): Promise<void>;

  /**
   * Remove a mentor from the search index.
   * Must gracefully handle the case where the document does not exist (ignore 404).
   */
  removeMentorFromIndex(mentorProfileId: string): Promise<void>;

  /**
   * Update an existing mentor document in the search index.
   */
  updateMentorInIndex(mentorProfileId: string): Promise<void>;

  /**
   * Bulk index multiple mentors (used for initial sync on startup).
   */
  bulkIndexMentors(mentorProfileIds: string[]): Promise<void>;
}
