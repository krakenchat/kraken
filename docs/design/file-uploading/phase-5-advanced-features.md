# Phase 5: Advanced Features & Management

## Overview

Phase 5 implements advanced file management features including administrative interfaces, user file management, upload quotas, automated cleanup, performance optimizations, and analytics. This phase completes the file upload system with enterprise-grade features and management capabilities.

## File Management Dashboard

### Administrative File Management

```typescript
// Admin dashboard for file management
interface FileManagementDashboard {
  overview: {
    totalFiles: number;
    totalStorage: number;
    dailyUploads: number;
    storageGrowth: number;
  };
  
  recentUploads: FileUploadActivity[];
  largestFiles: FileWithMetadata[];
  mostActiveUsers: UserFileActivity[];
  storageByType: StorageBreakdown[];
  flaggedContent: FlaggedFile[];
}

interface FileUploadActivity {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  uploadedBy: User;
  uploadedAt: Date;
  channelName?: string;
  communityName?: string;
}

interface StorageBreakdown {
  type: string;
  count: number;
  totalSize: number;
  percentage: number;
}
```

### Admin File Browser Component

```typescript
// frontend/src/components/admin/FileBrowser/FileBrowser.tsx
export const AdminFileBrowser: React.FC = () => {
  const [files, setFiles] = useState<FileWithMetadata[]>([]);
  const [filters, setFilters] = useState<FileFilters>({
    type: 'all',
    dateRange: 'week',
    sortBy: 'uploadedAt',
    sortOrder: 'desc',
  });
  
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  
  const { data: filesData, isLoading } = useGetFilesQuery({
    ...filters,
    limit: 50,
    offset: 0,
  });
  
  const { mutateAsync: deleteFiles } = useDeleteFilesMutation();
  const { mutateAsync: quarantineFiles } = useQuarantineFilesMutation();
  
  const handleBulkDelete = async () => {
    if (selectedFiles.length === 0) return;
    
    const confirmed = await confirmDialog({
      title: 'Delete Files',
      message: `Are you sure you want to delete ${selectedFiles.length} file(s)? This action cannot be undone.`,
      confirmText: 'Delete',
      variant: 'destructive',
    });
    
    if (confirmed) {
      await deleteFiles(selectedFiles);
      setSelectedFiles([]);
      // Refresh data
    }
  };
  
  const handleBulkQuarantine = async () => {
    if (selectedFiles.length === 0) return;
    
    await quarantineFiles(selectedFiles);
    setSelectedFiles([]);
    // Refresh data
  };
  
  return (
    <div className="space-y-6">
      {/* File Browser Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">File Management</h1>
        
        <div className="flex gap-2">
          <FileFilterDialog
            filters={filters}
            onFiltersChange={setFilters}
          />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}>
                {viewMode === 'grid' ? <List className="w-4 h-4 mr-2" /> : <Grid className="w-4 h-4 mr-2" />}
                {viewMode === 'grid' ? 'List View' : 'Grid View'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleBulkDelete} disabled={selectedFiles.length === 0}>
                <Trash className="w-4 h-4 mr-2" />
                Delete Selected ({selectedFiles.length})
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleBulkQuarantine} disabled={selectedFiles.length === 0}>
                <Shield className="w-4 h-4 mr-2" />
                Quarantine Selected ({selectedFiles.length})
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* File Statistics */}
      <FileStatisticsCards />
      
      {/* File Browser */}
      <div className="bg-card border rounded-lg">
        <div className="p-4 border-b">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">
              {filesData?.total || 0} files • {formatFileSize(filesData?.totalSize || 0)}
            </span>
            
            {selectedFiles.length > 0 && (
              <span className="text-sm text-primary">
                {selectedFiles.length} selected
              </span>
            )}
          </div>
        </div>
        
        <div className="p-4">
          {viewMode === 'list' ? (
            <FileTable
              files={filesData?.files || []}
              selectedFiles={selectedFiles}
              onSelectionChange={setSelectedFiles}
            />
          ) : (
            <FileGrid
              files={filesData?.files || []}
              selectedFiles={selectedFiles}
              onSelectionChange={setSelectedFiles}
            />
          )}
        </div>
      </div>
    </div>
  );
};
```

## User File Management

### Personal File Library

```typescript
// frontend/src/components/files/MyFiles/MyFilesLibrary.tsx
export const MyFilesLibrary: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'all' | 'images' | 'videos' | 'audio' | 'documents'>('all');
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  
  const { data: userFiles, isLoading } = useGetUserFilesQuery({
    type: activeTab === 'all' ? undefined : activeTab,
  });
  
  const { data: storageStats } = useGetUserStorageStatsQuery();
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Files</h1>
        <p className="text-muted-foreground">Manage your uploaded files and attachments</p>
      </div>
      
      {/* Storage Usage */}
      <StorageUsageCard stats={storageStats} />
      
      {/* File Type Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
        <TabsList>
          <TabsTrigger value="all">All Files</TabsTrigger>
          <TabsTrigger value="images">Images</TabsTrigger>
          <TabsTrigger value="videos">Videos</TabsTrigger>
          <TabsTrigger value="audio">Audio</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>
        
        <TabsContent value={activeTab} className="mt-6">
          <UserFileGrid
            files={userFiles?.files || []}
            selectedFiles={selectedFiles}
            onSelectionChange={setSelectedFiles}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const StorageUsageCard: React.FC<{ stats: UserStorageStats | undefined }> = ({ stats }) => {
  if (!stats) return null;
  
  const usagePercentage = (stats.usedStorage / stats.storageLimit) * 100;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="w-5 h-5" />
          Storage Usage
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span>Used: {formatFileSize(stats.usedStorage)}</span>
            <span>Limit: {formatFileSize(stats.storageLimit)}</span>
          </div>
          
          <Progress value={usagePercentage} className="w-full" />
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Total Files:</span>
              <span className="ml-2 font-medium">{stats.totalFiles}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Attachments:</span>
              <span className="ml-2 font-medium">{stats.attachmentCount}</span>
            </div>
          </div>
          
          {usagePercentage > 80 && (
            <Alert variant="warning">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Storage Almost Full</AlertTitle>
              <AlertDescription>
                You're using {usagePercentage.toFixed(1)}% of your storage limit. 
                Consider deleting unused files.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
```

## Upload Quotas & Limits System

### Quota Management Service

```typescript
// backend/src/files/services/quota.service.ts
@Injectable()
export class QuotaService {
  constructor(
    private prisma: DatabaseService,
    private configService: ConfigService,
  ) {}
  
  async checkUploadQuota(
    userId: string,
    fileSize: number,
    fileType?: string,
  ): Promise<QuotaCheckResult> {
    const user = await this.getUserWithRole(userId);
    const quotaLimits = this.getQuotaLimits(user.role);
    const currentUsage = await this.getUserStorageUsage(userId);
    
    // Check total storage limit
    if (currentUsage.totalStorage + fileSize > quotaLimits.totalStorage) {
      return {
        allowed: false,
        reason: 'Storage limit exceeded',
        currentUsage: currentUsage.totalStorage,
        limit: quotaLimits.totalStorage,
        remainingSpace: Math.max(0, quotaLimits.totalStorage - currentUsage.totalStorage),
      };
    }
    
    // Check daily upload limit
    const dailyUploads = await this.getDailyUploadUsage(userId);
    if (dailyUploads.totalSize + fileSize > quotaLimits.dailyUpload) {
      return {
        allowed: false,
        reason: 'Daily upload limit exceeded',
        currentUsage: dailyUploads.totalSize,
        limit: quotaLimits.dailyUpload,
        resetTime: this.getNextMidnight(),
      };
    }
    
    // Check file size limit
    const maxFileSize = this.getMaxFileSize(fileType, user.role);
    if (fileSize > maxFileSize) {
      return {
        allowed: false,
        reason: 'File size exceeds limit',
        currentUsage: fileSize,
        limit: maxFileSize,
      };
    }
    
    return {
      allowed: true,
      remainingSpace: quotaLimits.totalStorage - currentUsage.totalStorage,
      remainingDailyQuota: quotaLimits.dailyUpload - dailyUploads.totalSize,
    };
  }
  
  private getQuotaLimits(role: UserRole): QuotaLimits {
    const limits = this.configService.get('UPLOAD_QUOTAS', {
      user: {
        totalStorage: 1024 * 1024 * 1024 * 5, // 5GB
        dailyUpload: 1024 * 1024 * 1024 * 1, // 1GB per day
        maxFileSize: 1024 * 1024 * 100, // 100MB per file
        maxFiles: 1000,
      },
      premium: {
        totalStorage: 1024 * 1024 * 1024 * 50, // 50GB
        dailyUpload: 1024 * 1024 * 1024 * 10, // 10GB per day
        maxFileSize: 1024 * 1024 * 500, // 500MB per file
        maxFiles: 10000,
      },
      admin: {
        totalStorage: -1, // Unlimited
        dailyUpload: -1, // Unlimited
        maxFileSize: 1024 * 1024 * 1024 * 2, // 2GB per file
        maxFiles: -1, // Unlimited
      },
    });
    
    return limits[role.name.toLowerCase()] || limits.user;
  }
  
  async incrementUsage(userId: string, fileSize: number): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    await this.prisma.userStorageUsage.upsert({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
      update: {
        uploadedSize: { increment: fileSize },
        fileCount: { increment: 1 },
      },
      create: {
        userId,
        date: today,
        uploadedSize: fileSize,
        fileCount: 1,
      },
    });
  }
  
  async getUserStorageStats(userId: string): Promise<UserStorageStats> {
    const [totalUsage, todayUsage] = await Promise.all([
      this.getUserTotalStorageUsage(userId),
      this.getDailyUploadUsage(userId),
    ]);
    
    const user = await this.getUserWithRole(userId);
    const quotaLimits = this.getQuotaLimits(user.role);
    
    return {
      usedStorage: totalUsage.totalStorage,
      storageLimit: quotaLimits.totalStorage,
      dailyUsed: todayUsage.totalSize,
      dailyLimit: quotaLimits.dailyUpload,
      totalFiles: totalUsage.totalFiles,
      attachmentCount: totalUsage.attachmentCount,
      publicFileCount: totalUsage.publicFileCount,
    };
  }
}

interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  currentUsage?: number;
  limit?: number;
  remainingSpace?: number;
  remainingDailyQuota?: number;
  resetTime?: Date;
}

interface QuotaLimits {
  totalStorage: number; // -1 for unlimited
  dailyUpload: number; // -1 for unlimited
  maxFileSize: number;
  maxFiles: number; // -1 for unlimited
}
```

## Automated File Cleanup System

### Advanced Cleanup Service

```typescript
// backend/src/files/services/file-cleanup.service.ts
@Injectable()
export class FileCleanupService {
  constructor(
    private filesService: FilesService,
    private storageService: IStorageService,
    private logger: Logger,
  ) {}
  
  @Cron('0 2 * * *') // Daily at 2 AM
  async performDailyCleanup() {
    this.logger.log('Starting daily file cleanup');
    
    const tasks = [
      this.cleanupOrphanedFiles(),
      this.cleanupExpiredFiles(),
      this.cleanupFailedUploads(),
      this.cleanupTempProcessingFiles(),
      this.optimizeStorage(),
    ];
    
    const results = await Promise.allSettled(tasks);
    
    results.forEach((result, index) => {
      const taskNames = ['orphaned', 'expired', 'failed uploads', 'temp files', 'optimization'];
      if (result.status === 'rejected') {
        this.logger.error(`Cleanup task '${taskNames[index]}' failed:`, result.reason);
      }
    });
    
    this.logger.log('Daily file cleanup completed');
  }
  
  @Cron('0 3 * * 0') // Weekly on Sunday at 3 AM
  async performWeeklyMaintenance() {
    this.logger.log('Starting weekly file maintenance');
    
    await Promise.allSettled([
      this.generateStorageReport(),
      this.validateFileIntegrity(),
      this.optimizeThumbnails(),
      this.archiveOldFiles(),
    ]);
    
    this.logger.log('Weekly file maintenance completed');
  }
  
  private async cleanupOrphanedFiles(): Promise<CleanupResult> {
    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    const orphanedFiles = await this.filesService.findMany({
      where: {
        AND: [
          { createdAt: { lt: cutoffDate } },
          { isPublic: false },
          {
            OR: [
              { attachments: { none: {} } },
              { publicFiles: { none: {} } },
            ],
          },
        ],
      },
    });
    
    let deletedCount = 0;
    let deletedSize = 0;
    
    for (const file of orphanedFiles) {
      try {
        await this.deleteFileCompletely(file);
        deletedCount++;
        deletedSize += file.size;
      } catch (error) {
        this.logger.error(`Failed to delete orphaned file ${file.id}:`, error);
      }
    }
    
    return {
      type: 'orphaned',
      processedCount: orphanedFiles.length,
      deletedCount,
      reclaimedSpace: deletedSize,
    };
  }
  
  private async cleanupExpiredFiles(): Promise<CleanupResult> {
    const now = new Date();
    
    const expiredFiles = await this.filesService.findMany({
      where: {
        expiresAt: {
          lt: now,
        },
      },
    });
    
    let deletedCount = 0;
    let deletedSize = 0;
    
    for (const file of expiredFiles) {
      try {
        await this.deleteFileCompletely(file);
        deletedCount++;
        deletedSize += file.size;
      } catch (error) {
        this.logger.error(`Failed to delete expired file ${file.id}:`, error);
      }
    }
    
    return {
      type: 'expired',
      processedCount: expiredFiles.length,
      deletedCount,
      reclaimedSpace: deletedSize,
    };
  }
  
  private async optimizeStorage(): Promise<void> {
    // Compress old images that haven't been compressed
    const uncompressedImages = await this.findUncompressedImages();
    
    for (const image of uncompressedImages) {
      try {
        await this.compressImage(image);
        this.logger.log(`Compressed image: ${image.id}`);
      } catch (error) {
        this.logger.error(`Failed to compress image ${image.id}:`, error);
      }
    }
    
    // Convert old videos to more efficient formats
    const unoptimizedVideos = await this.findUnoptimizedVideos();
    
    for (const video of unoptimizedVideos) {
      try {
        await this.optimizeVideo(video);
        this.logger.log(`Optimized video: ${video.id}`);
      } catch (error) {
        this.logger.error(`Failed to optimize video ${video.id}:`, error);
      }
    }
  }
  
  private async generateStorageReport(): Promise<void> {
    const report = await this.generateWeeklyStorageReport();
    
    // Save report to database
    await this.saveStorageReport(report);
    
    // Send to administrators if needed
    if (report.criticalIssues.length > 0) {
      await this.notifyAdministrators(report);
    }
  }
  
  private async generateWeeklyStorageReport(): Promise<StorageReport> {
    const [
      totalStorage,
      storageByType,
      topUsers,
      largestFiles,
      uploadTrends,
    ] = await Promise.all([
      this.getTotalStorageUsage(),
      this.getStorageByFileType(),
      this.getTopUsersByStorage(),
      this.getLargestFiles(),
      this.getUploadTrends(),
    ]);
    
    return {
      generatedAt: new Date(),
      totalStorage,
      storageByType,
      topUsers,
      largestFiles,
      uploadTrends,
      criticalIssues: this.identifyCriticalIssues({
        totalStorage,
        storageByType,
        topUsers,
      }),
    };
  }
}

interface CleanupResult {
  type: string;
  processedCount: number;
  deletedCount: number;
  reclaimedSpace: number;
}

interface StorageReport {
  generatedAt: Date;
  totalStorage: number;
  storageByType: Array<{ type: string; size: number; count: number }>;
  topUsers: Array<{ userId: string; username: string; storageUsed: number }>;
  largestFiles: Array<{ id: string; filename: string; size: number }>;
  uploadTrends: Array<{ date: string; uploads: number; size: number }>;
  criticalIssues: Array<{ type: string; description: string; severity: 'low' | 'medium' | 'high' }>;
}
```

## Performance Optimization

### File Serving Optimization

```typescript
// backend/src/files/middleware/file-serving.middleware.ts
@Injectable()
export class FileServingMiddleware implements NestMiddleware {
  constructor(
    private cacheService: CacheService,
    private storageService: IStorageService,
  ) {}
  
  async use(req: Request, res: Response, next: NextFunction) {
    const fileId = this.extractFileId(req.path);
    if (!fileId) return next();
    
    // Set security headers
    this.setSecurityHeaders(res);
    
    // Handle conditional requests (304 Not Modified)
    const ifNoneMatch = req.headers['if-none-match'];
    const ifModifiedSince = req.headers['if-modified-since'];
    
    const file = await this.getFileMetadata(fileId);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Generate ETag
    const etag = `"${file.hash}-${file.updatedAt.getTime()}"`;
    res.setHeader('ETag', etag);
    res.setHeader('Last-Modified', file.updatedAt.toUTCString());
    
    // Check if client has cached version
    if (this.isClientCacheValid(ifNoneMatch, ifModifiedSince, etag, file.updatedAt)) {
      return res.status(304).end();
    }
    
    // Set caching headers
    this.setCachingHeaders(res, file);
    
    // Handle range requests for large files
    if (req.headers.range && file.size > 1024 * 1024) { // 1MB+
      return this.handleRangeRequest(req, res, file);
    }
    
    // Serve file
    return this.serveFile(res, file);
  }
  
  private setSecurityHeaders(res: Response) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
  }
  
  private setCachingHeaders(res: Response, file: File) {
    const isImmutable = this.isImmutableFile(file);
    const maxAge = isImmutable ? 31536000 : 3600; // 1 year or 1 hour
    
    res.setHeader('Cache-Control', 
      isImmutable 
        ? `public, max-age=${maxAge}, immutable`
        : `public, max-age=${maxAge}`
    );
  }
  
  private async handleRangeRequest(req: Request, res: Response, file: File) {
    const range = this.parseRange(req.headers.range!, file.size);
    if (!range) {
      res.setHeader('Content-Range', `bytes */${file.size}`);
      return res.status(416).end();
    }
    
    const { start, end } = range;
    const chunkSize = end - start + 1;
    
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${file.size}`);
    res.setHeader('Content-Length', chunkSize.toString());
    res.setHeader('Content-Type', file.mimeType);
    
    // Stream the file chunk
    const stream = await this.storageService.createReadStream(file.storagePath, start, end);
    stream.pipe(res);
  }
  
  private async serveFile(res: Response, file: File) {
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', file.size.toString());
    
    if (this.isDownloadable(file)) {
      res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    } else {
      res.setHeader('Content-Disposition', 'inline');
    }
    
    const stream = await this.storageService.createReadStream(file.storagePath);
    stream.pipe(res);
  }
}
```

### Frontend Performance Optimizations

```typescript
// frontend/src/hooks/useInfiniteFiles.ts
export const useInfiniteFiles = (filters: FileFilters = {}) => {
  const [allFiles, setAllFiles] = useState<FileMetadata[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  
  const loadMoreFiles = useCallback(async () => {
    if (isLoading || !hasMore) return;
    
    setIsLoading(true);
    try {
      const response = await fetchFiles({
        ...filters,
        offset: allFiles.length,
        limit: 20,
      });
      
      if (response.files.length === 0) {
        setHasMore(false);
      } else {
        setAllFiles(prev => [...prev, ...response.files]);
        setHasMore(response.files.length === 20);
      }
    } catch (error) {
      console.error('Failed to load more files:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filters, allFiles.length, isLoading, hasMore]);
  
  // Load initial files
  useEffect(() => {
    setAllFiles([]);
    setHasMore(true);
    loadMoreFiles();
  }, [filters]);
  
  return {
    files: allFiles,
    hasMore,
    isLoading,
    loadMore: loadMoreFiles,
  };
};

// Virtual scrolling for large file lists
export const VirtualFileGrid: React.FC<{
  files: FileMetadata[];
  itemHeight: number;
  onLoadMore: () => void;
}> = ({ files, itemHeight, onLoadMore }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });
  
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const handleScroll = throttle(() => {
      const scrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      
      const start = Math.floor(scrollTop / itemHeight);
      const end = Math.min(files.length, start + Math.ceil(containerHeight / itemHeight) + 5);
      
      setVisibleRange({ start, end });
      
      // Load more when near the end
      if (end > files.length - 10) {
        onLoadMore();
      }
    }, 100);
    
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [files.length, itemHeight, onLoadMore]);
  
  const visibleFiles = files.slice(visibleRange.start, visibleRange.end);
  
  return (
    <div 
      ref={containerRef}
      className="h-full overflow-auto"
      style={{ height: files.length * itemHeight }}
    >
      <div style={{ paddingTop: visibleRange.start * itemHeight }}>
        {visibleFiles.map((file, index) => (
          <FileGridItem
            key={file.id}
            file={file}
            style={{ height: itemHeight }}
          />
        ))}
      </div>
    </div>
  );
};
```

## Analytics & Monitoring

### File Usage Analytics

```typescript
// backend/src/files/services/analytics.service.ts
@Injectable()
export class FileAnalyticsService {
  constructor(
    private prisma: DatabaseService,
    private cacheService: CacheService,
  ) {}
  
  async trackFileAccess(fileId: string, userId: string, accessType: 'view' | 'download') {
    await this.prisma.fileAccess.create({
      data: {
        fileId,
        userId,
        accessType,
        timestamp: new Date(),
      },
    });
    
    // Update file popularity metrics
    await this.updateFilePopularity(fileId);
  }
  
  async generateFileAnalytics(timeRange: DateRange): Promise<FileAnalytics> {
    const [
      uploadStats,
      accessStats,
      popularFiles,
      storageGrowth,
      userActivity,
    ] = await Promise.all([
      this.getUploadStatistics(timeRange),
      this.getAccessStatistics(timeRange),
      this.getPopularFiles(timeRange),
      this.getStorageGrowth(timeRange),
      this.getUserActivity(timeRange),
    ]);
    
    return {
      timeRange,
      uploadStats,
      accessStats,
      popularFiles,
      storageGrowth,
      userActivity,
    };
  }
  
  private async getUploadStatistics(timeRange: DateRange) {
    return {
      totalUploads: await this.countUploads(timeRange),
      uploadsByType: await this.getUploadsByType(timeRange),
      uploadsByDay: await this.getUploadsByDay(timeRange),
      averageFileSize: await this.getAverageFileSize(timeRange),
      largestUpload: await this.getLargestUpload(timeRange),
    };
  }
  
  async getSystemHealthMetrics(): Promise<SystemHealthMetrics> {
    const [
      storageUsage,
      processingQueue,
      errorRates,
      performanceMetrics,
    ] = await Promise.all([
      this.getStorageUsage(),
      this.getProcessingQueueStats(),
      this.getErrorRates(),
      this.getPerformanceMetrics(),
    ]);
    
    return {
      storageUsage,
      processingQueue,
      errorRates,
      performanceMetrics,
      overallHealth: this.calculateOverallHealth({
        storageUsage,
        processingQueue,
        errorRates,
        performanceMetrics,
      }),
    };
  }
}
```

## Implementation Tasks

### Management Interface Tasks
1. **Admin Dashboard**
   - Create file management dashboard
   - Implement admin file browser
   - Add bulk operations (delete, quarantine)
   - Create file statistics and analytics views

2. **User File Management**
   - Build personal file library
   - Add file organization tools
   - Create storage usage visualization
   - Implement file search and filtering

### Quota System Tasks
1. **Backend Quota Management**
   - Implement quota checking service
   - Add usage tracking and reporting
   - Create quota enforcement middleware
   - Build quota configuration system

2. **Frontend Quota Display**
   - Show storage usage indicators
   - Add quota warning notifications
   - Create upgrade prompts for limits
   - Display quota information in settings

### Cleanup & Maintenance Tasks
1. **Automated Cleanup**
   - Build orphaned file detection
   - Create expired file cleanup
   - Implement storage optimization
   - Add maintenance reporting

2. **Performance Optimization**
   - Implement efficient file serving
   - Add caching strategies
   - Create compression pipelines
   - Optimize database queries

### Analytics Tasks
1. **Usage Analytics**
   - Track file access patterns
   - Generate usage reports
   - Monitor system health
   - Create performance dashboards

2. **Monitoring & Alerts**
   - Set up storage alerts
   - Monitor upload failures
   - Track performance metrics
   - Create automated reports

## Success Criteria

- [ ] Admin dashboard provides comprehensive file management
- [ ] Users can efficiently manage their personal files
- [ ] Upload quotas are properly enforced and displayed
- [ ] Automated cleanup maintains system health
- [ ] File serving is optimized for performance
- [ ] Analytics provide insights into system usage
- [ ] Storage is efficiently utilized and optimized
- [ ] System monitoring alerts to potential issues
- [ ] File access is fast and reliable at scale
- [ ] Management interfaces are user-friendly and responsive

This phase completes the file upload system with enterprise-grade management, optimization, and monitoring capabilities, ensuring the system can scale efficiently while providing excellent user and administrator experiences.