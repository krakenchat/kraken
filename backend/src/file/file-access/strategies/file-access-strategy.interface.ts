export interface IFileAccessStrategy {
  /**
   * Check if a user has access to a file based on the resource context
   * @param userId - ID of the user requesting access
   * @param resourceId - ID of the resource the file is associated with
   * @param fileId - ID of the file being accessed
   * @returns Promise that resolves to true if access is granted
   * @throws ForbiddenException if access is denied
   * @throws NotFoundException if resource is not found
   */
  checkAccess(
    userId: string,
    resourceId: string,
    fileId: string,
  ): Promise<boolean>;
}
