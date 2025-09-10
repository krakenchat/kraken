# Phase 4: Multimedia Support & Media Players

## Overview

Phase 4 implements comprehensive multimedia support including embedded media players, thumbnail generation, metadata extraction, and optimized media serving. This phase transforms basic file attachments into rich media experiences similar to Discord's media handling.

## Multimedia Architecture

### Media Processing Pipeline

```
File Upload → Validation → Processing → Storage → Serving
     ↓            ↓            ↓          ↓         ↓
   Basic      MIME Type    Thumbnails   File      Media
  Metadata    Checking     Generation   Storage   Players
```

### Supported Media Types

```typescript
// Comprehensive media type support
export const SUPPORTED_MEDIA_TYPES = {
  images: {
    'image/jpeg': { maxSize: '100MB', thumbnail: true, preview: true },
    'image/png': { maxSize: '100MB', thumbnail: true, preview: true },
    'image/gif': { maxSize: '50MB', thumbnail: true, preview: true, animated: true },
    'image/webp': { maxSize: '100MB', thumbnail: true, preview: true },
    'image/svg+xml': { maxSize: '10MB', thumbnail: false, preview: true },
  },
  videos: {
    'video/mp4': { maxSize: '500MB', thumbnail: true, preview: true, streaming: true },
    'video/webm': { maxSize: '500MB', thumbnail: true, preview: true, streaming: true },
    'video/quicktime': { maxSize: '500MB', thumbnail: true, preview: true },
    'video/x-msvideo': { maxSize: '500MB', thumbnail: true, preview: true },
  },
  audio: {
    'audio/mpeg': { maxSize: '100MB', thumbnail: false, waveform: true },
    'audio/wav': { maxSize: '100MB', thumbnail: false, waveform: true },
    'audio/ogg': { maxSize: '100MB', thumbnail: false, waveform: true },
    'audio/aac': { maxSize: '100MB', thumbnail: false, waveform: true },
  },
  documents: {
    'application/pdf': { maxSize: '50MB', thumbnail: true, preview: true },
    'text/plain': { maxSize: '10MB', thumbnail: false, preview: true },
  },
};
```

## Backend Media Processing

### Enhanced File Metadata Processor

```typescript
// backend/src/files/processors/metadata.processor.ts
@Injectable()
export class FileMetadataProcessor {
  constructor(
    private imageProcessor: ImageProcessor,
    private videoProcessor: VideoProcessor,
    private audioProcessor: AudioProcessor,
    private documentProcessor: DocumentProcessor,
  ) {}
  
  async processFile(file: Express.Multer.File): Promise<ProcessedFileMetadata> {
    const baseMetadata = await this.extractBasicMetadata(file);
    
    const processor = this.getProcessorForType(file.mimetype);
    if (!processor) {
      return { ...baseMetadata, processed: false };
    }
    
    const enhancedMetadata = await processor.process(file);
    
    return {
      ...baseMetadata,
      ...enhancedMetadata,
      processed: true,
    };
  }
  
  private getProcessorForType(mimeType: string): MediaProcessor | null {
    if (mimeType.startsWith('image/')) return this.imageProcessor;
    if (mimeType.startsWith('video/')) return this.videoProcessor;
    if (mimeType.startsWith('audio/')) return this.audioProcessor;
    if (mimeType === 'application/pdf') return this.documentProcessor;
    return null;
  }
}

interface ProcessedFileMetadata extends FileMetadata {
  processed: boolean;
  thumbnails?: ThumbnailSet;
  waveform?: number[];
  videoMetadata?: VideoMetadata;
  audioMetadata?: AudioMetadata;
}

interface ThumbnailSet {
  small: ThumbnailInfo;   // 150x150
  medium: ThumbnailInfo;  // 300x300  
  large: ThumbnailInfo;   // 600x600
}

interface ThumbnailInfo {
  path: string;
  width: number;
  height: number;
  size: number;
}
```

### Image Processing Service

```typescript
// backend/src/files/processors/image.processor.ts
@Injectable()
export class ImageProcessor implements MediaProcessor {
  async process(file: Express.Multer.File): Promise<ImageProcessingResult> {
    const metadata = await this.extractImageMetadata(file.path);
    const thumbnails = await this.generateThumbnails(file);
    
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      hasTransparency: metadata.hasAlpha,
      colorSpace: metadata.space,
      thumbnails,
      exif: metadata.exif,
    };
  }
  
  private async generateThumbnails(file: Express.Multer.File): Promise<ThumbnailSet> {
    const sizes = [
      { name: 'small', size: 150 },
      { name: 'medium', size: 300 },
      { name: 'large', size: 600 },
    ];
    
    const thumbnails: Partial<ThumbnailSet> = {};
    
    for (const { name, size } of sizes) {
      try {
        const thumbnailBuffer = await sharp(file.path)
          .resize(size, size, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: 85 })
          .toBuffer();
        
        const thumbnailPath = await this.saveThumbnail(
          thumbnailBuffer,
          file.filename,
          name,
        );
        
        const { width, height } = await sharp(thumbnailBuffer).metadata();
        
        thumbnails[name as keyof ThumbnailSet] = {
          path: thumbnailPath,
          width: width!,
          height: height!,
          size: thumbnailBuffer.length,
        };
      } catch (error) {
        console.error(`Failed to generate ${name} thumbnail:`, error);
      }
    }
    
    return thumbnails as ThumbnailSet;
  }
  
  private async extractImageMetadata(filePath: string) {
    const metadata = await sharp(filePath).metadata();
    
    return {
      width: metadata.width!,
      height: metadata.height!,
      format: metadata.format!,
      hasAlpha: metadata.hasAlpha || false,
      space: metadata.space || 'srgb',
      exif: metadata.exif ? await this.parseExif(metadata.exif) : null,
    };
  }
  
  private async parseExif(exifBuffer: Buffer): Promise<ExifData> {
    // Parse EXIF data for camera info, GPS, etc.
    // Implementation would use exif-parser or similar
    return {};
  }
}
```

### Video Processing Service

```typescript
// backend/src/files/processors/video.processor.ts
@Injectable()
export class VideoProcessor implements MediaProcessor {
  async process(file: Express.Multer.File): Promise<VideoProcessingResult> {
    const metadata = await this.extractVideoMetadata(file.path);
    const thumbnail = await this.generateVideoThumbnail(file);
    const previewGif = await this.generatePreviewGif(file);
    
    return {
      width: metadata.width,
      height: metadata.height,
      duration: metadata.duration,
      format: metadata.format,
      bitrate: metadata.bitrate,
      framerate: metadata.framerate,
      hasAudio: metadata.hasAudio,
      thumbnails: {
        small: thumbnail,
        medium: thumbnail, // Could generate different sizes
        large: thumbnail,
      },
      previewGif,
    };
  }
  
  private async extractVideoMetadata(filePath: string): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }
        
        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
        
        resolve({
          width: videoStream?.width || 0,
          height: videoStream?.height || 0,
          duration: parseFloat(metadata.format.duration || '0'),
          format: metadata.format.format_name || '',
          bitrate: parseInt(metadata.format.bit_rate || '0'),
          framerate: this.parseFramerate(videoStream?.avg_frame_rate),
          hasAudio: !!audioStream,
        });
      });
    });
  }
  
  private async generateVideoThumbnail(file: Express.Multer.File): Promise<ThumbnailInfo> {
    const outputPath = this.getThumbnailPath(file.filename, 'video');
    
    return new Promise((resolve, reject) => {
      ffmpeg(file.path)
        .screenshots({
          count: 1,
          folder: path.dirname(outputPath),
          filename: path.basename(outputPath),
          timemarks: ['10%'], // Thumbnail at 10% of video duration
        })
        .on('end', async () => {
          const stats = await fs.stat(outputPath);
          const { width, height } = await sharp(outputPath).metadata();
          
          resolve({
            path: outputPath,
            width: width!,
            height: height!,
            size: stats.size,
          });
        })
        .on('error', reject);
    });
  }
  
  private async generatePreviewGif(file: Express.Multer.File): Promise<string | null> {
    // Generate a short preview GIF for hover effects
    const outputPath = this.getPreviewGifPath(file.filename);
    
    return new Promise((resolve) => {
      ffmpeg(file.path)
        .outputOptions([
          '-vf', 'fps=10,scale=320:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse',
          '-t', '3', // 3 second preview
          '-ss', '10%', // Start at 10% of video duration
        ])
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', (err) => {
          console.error('Preview GIF generation failed:', err);
          resolve(null);
        })
        .run();
    });
  }
}
```

### Audio Processing Service

```typescript
// backend/src/files/processors/audio.processor.ts
@Injectable()
export class AudioProcessor implements MediaProcessor {
  async process(file: Express.Multer.File): Promise<AudioProcessingResult> {
    const metadata = await this.extractAudioMetadata(file.path);
    const waveform = await this.generateWaveform(file.path);
    const spectrogram = await this.generateSpectrogram(file.path);
    
    return {
      duration: metadata.duration,
      bitrate: metadata.bitrate,
      sampleRate: metadata.sampleRate,
      channels: metadata.channels,
      format: metadata.format,
      artist: metadata.artist,
      title: metadata.title,
      album: metadata.album,
      waveform,
      spectrogram,
    };
  }
  
  private async extractAudioMetadata(filePath: string): Promise<AudioMetadata> {
    return new Promise((resolve, reject) => {
      ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }
        
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
        const tags = metadata.format.tags || {};
        
        resolve({
          duration: parseFloat(metadata.format.duration || '0'),
          bitrate: parseInt(metadata.format.bit_rate || '0'),
          sampleRate: parseInt(audioStream?.sample_rate || '0'),
          channels: audioStream?.channels || 0,
          format: metadata.format.format_name || '',
          artist: tags.artist || tags.ARTIST || null,
          title: tags.title || tags.TITLE || null,
          album: tags.album || tags.ALBUM || null,
        });
      });
    });
  }
  
  private async generateWaveform(filePath: string): Promise<number[]> {
    // Generate waveform data for visualization
    const outputPath = `/tmp/waveform-${Date.now()}.json`;
    
    return new Promise((resolve, reject) => {
      ffmpeg(filePath)
        .audioFilters('aformat=channel_layouts=mono,showwavespic=s=800x200:colors=#3b82f6')
        .outputOptions(['-vframes', '1'])
        .output(outputPath)
        .on('end', async () => {
          // Parse waveform data from generated image or use audiowaveform tool
          const waveformData = await this.parseWaveformData(outputPath);
          resolve(waveformData);
        })
        .on('error', reject)
        .run();
    });
  }
  
  private async generateSpectrogram(filePath: string): Promise<string | null> {
    // Generate spectrogram image for audio visualization
    const outputPath = this.getSpectrogramPath(path.basename(filePath));
    
    return new Promise((resolve) => {
      ffmpeg(filePath)
        .audioFilters('showspectrumpic=s=800x400:mode=combined:slide=1:orientation=vertical')
        .outputOptions(['-vframes', '1'])
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', (err) => {
          console.error('Spectrogram generation failed:', err);
          resolve(null);
        })
        .run();
    });
  }
}
```

## Frontend Media Components

### Universal Media Viewer Component

```typescript
// frontend/src/components/files/MediaViewer/MediaViewer.tsx
interface MediaViewerProps {
  file: FileMetadata;
  className?: string;
  autoPlay?: boolean;
  controls?: boolean;
  size?: 'small' | 'medium' | 'large' | 'original';
}

export const MediaViewer: React.FC<MediaViewerProps> = ({
  file,
  className,
  autoPlay = false,
  controls = true,
  size = 'medium',
}) => {
  const mediaType = getMediaType(file.mimeType);
  
  const getComponent = () => {
    switch (mediaType) {
      case 'image':
        return (
          <ImageViewer
            file={file}
            size={size}
            className={className}
          />
        );
      case 'video':
        return (
          <VideoPlayer
            file={file}
            autoPlay={autoPlay}
            controls={controls}
            className={className}
          />
        );
      case 'audio':
        return (
          <AudioPlayer
            file={file}
            controls={controls}
            className={className}
          />
        );
      case 'document':
        return (
          <DocumentViewer
            file={file}
            className={className}
          />
        );
      default:
        return (
          <FilePreview
            file={file}
            className={className}
          />
        );
    }
  };
  
  return (
    <div className={cn('media-viewer', className)}>
      {getComponent()}
    </div>
  );
};
```

### Enhanced Image Viewer

```typescript
// frontend/src/components/files/MediaViewer/ImageViewer.tsx
export const ImageViewer: React.FC<{
  file: FileMetadata;
  size: 'small' | 'medium' | 'large' | 'original';
  className?: string;
}> = ({ file, size, className }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const getImageUrl = () => {
    if (size === 'original') {
      return `/api/files/${file.id}/download`;
    }
    return file.thumbnailUrl || `/api/files/${file.id}/download`;
  };
  
  const getThumbnailUrl = (thumbnailSize: string) => {
    return `/api/files/${file.id}/thumbnail/${thumbnailSize}`;
  };
  
  const handleImageLoad = () => {
    setIsLoading(false);
    setError(null);
  };
  
  const handleImageError = () => {
    setIsLoading(false);
    setError('Failed to load image');
  };
  
  const openFullscreen = () => {
    setIsFullscreen(true);
  };
  
  return (
    <>
      <div className={cn('relative group overflow-hidden rounded-lg', className)}>
        {isLoading && (
          <div className="absolute inset-0 bg-muted animate-pulse" />
        )}
        
        {error ? (
          <div className="flex items-center justify-center p-8 bg-muted">
            <div className="text-center">
              <ImageIcon className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
        ) : (
          <img
            src={getImageUrl()}
            alt={file.filename}
            onLoad={handleImageLoad}
            onError={handleImageError}
            className={cn(
              'max-w-full h-auto cursor-pointer transition-opacity',
              isLoading && 'opacity-0',
            )}
            onClick={openFullscreen}
            style={{
              maxHeight: size === 'small' ? '200px' : size === 'medium' ? '400px' : '600px',
            }}
          />
        )}
        
        {/* Image overlay with info */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end">
          <div className="p-3 text-white text-sm">
            <p className="font-medium">{file.filename}</p>
            <p className="text-xs opacity-80">
              {file.width}×{file.height} • {formatFileSize(file.size)}
            </p>
          </div>
          
          <div className="absolute top-3 right-3 flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                openFullscreen();
              }}
            >
              <Expand className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Fullscreen modal */}
      {isFullscreen && (
        <ImageFullscreen
          file={file}
          onClose={() => setIsFullscreen(false)}
        />
      )}
    </>
  );
};
```

### Advanced Video Player

```typescript
// frontend/src/components/files/MediaViewer/VideoPlayer.tsx
export const VideoPlayer: React.FC<{
  file: FileMetadata;
  autoPlay?: boolean;
  controls?: boolean;
  className?: string;
}> = ({ file, autoPlay = false, controls = true, className }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  
  const videoUrl = `/api/files/${file.id}/download`;
  const thumbnailUrl = file.thumbnailUrl;
  
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => setDuration(video.duration);
    const handleVolumeChange = () => setVolume(video.volume);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleLoadStart = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);
    
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('volumechange', handleVolumeChange);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('canplay', handleCanPlay);
    
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('volumechange', handleVolumeChange);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, []);
  
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    
    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  };
  
  const handleSeek = (time: number) => {
    const video = videoRef.current;
    if (!video) return;
    
    video.currentTime = time;
    setCurrentTime(time);
  };
  
  const toggleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;
    
    if (!isFullscreen) {
      if (video.requestFullscreen) {
        video.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };
  
  return (
    <div 
      className={cn('relative group bg-black rounded-lg overflow-hidden', className)}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={videoUrl}
        poster={thumbnailUrl}
        autoPlay={autoPlay}
        className="w-full h-auto"
        onClick={togglePlay}
      />
      
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
        </div>
      )}
      
      {/* Custom controls */}
      {controls && (
        <VideoControls
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          volume={volume}
          showControls={showControls}
          onTogglePlay={togglePlay}
          onSeek={handleSeek}
          onVolumeChange={setVolume}
          onToggleFullscreen={toggleFullscreen}
        />
      )}
      
      {/* Video info overlay */}
      <div className="absolute top-3 left-3 bg-black/50 text-white px-2 py-1 rounded text-xs">
        {file.duration && formatDuration(file.duration)}
      </div>
    </div>
  );
};
```

### Advanced Audio Player

```typescript
// frontend/src/components/files/MediaViewer/AudioPlayer.tsx
export const AudioPlayer: React.FC<{
  file: FileMetadata;
  controls?: boolean;
  className?: string;
}> = ({ file, controls = true, className }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  
  const audioUrl = `/api/files/${file.id}/download`;
  
  useEffect(() => {
    // Load waveform data if available
    if (file.waveform) {
      setWaveformData(file.waveform);
    }
  }, [file.waveform]);
  
  useEffect(() => {
    if (waveformData.length > 0 && canvasRef.current) {
      drawWaveform(canvasRef.current, waveformData, currentTime / duration);
    }
  }, [waveformData, currentTime, duration]);
  
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
  };
  
  const drawWaveform = (canvas: HTMLCanvasElement, data: number[], progress: number) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const { width, height } = canvas;
    const barWidth = width / data.length;
    
    ctx.clearRect(0, 0, width, height);
    
    // Draw waveform bars
    data.forEach((value, index) => {
      const barHeight = (value / 100) * height;
      const x = index * barWidth;
      const y = (height - barHeight) / 2;
      
      // Color based on progress
      const isPlayed = index / data.length <= progress;
      ctx.fillStyle = isPlayed ? '#3b82f6' : '#6b7280';
      ctx.fillRect(x, y, barWidth - 1, barHeight);
    });
    
    // Draw progress line
    const progressX = progress * width;
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(progressX, 0);
    ctx.lineTo(progressX, height);
    ctx.stroke();
  };
  
  return (
    <div className={cn('bg-card border rounded-lg p-4', className)}>
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={() => {
          const audio = audioRef.current;
          if (audio) {
            setCurrentTime(audio.currentTime);
          }
        }}
        onDurationChange={() => {
          const audio = audioRef.current;
          if (audio) {
            setDuration(audio.duration);
          }
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />
      
      {/* Audio info */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
          <Music className="w-6 h-6 text-primary" />
        </div>
        
        <div className="flex-1">
          <h4 className="font-medium">{file.audioMetadata?.title || file.filename}</h4>
          {file.audioMetadata?.artist && (
            <p className="text-sm text-muted-foreground">{file.audioMetadata.artist}</p>
          )}
        </div>
        
        <div className="text-sm text-muted-foreground">
          {formatDuration(duration)}
        </div>
      </div>
      
      {/* Waveform visualization */}
      <div className="relative mb-3">
        <canvas
          ref={canvasRef}
          width={400}
          height={80}
          className="w-full h-20 cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const progress = x / rect.width;
            const newTime = progress * duration;
            
            const audio = audioRef.current;
            if (audio) {
              audio.currentTime = newTime;
            }
          }}
        />
      </div>
      
      {/* Audio controls */}
      {controls && (
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={togglePlay}
            className="w-10 h-10 p-0"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5" />
            )}
          </Button>
          
          <div className="flex-1">
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={1}
              onValueChange={([value]) => {
                const audio = audioRef.current;
                if (audio) {
                  audio.currentTime = value;
                }
              }}
              className="w-full"
            />
          </div>
          
          <div className="text-sm text-muted-foreground min-w-[80px] text-right">
            {formatDuration(currentTime)} / {formatDuration(duration)}
          </div>
        </div>
      )}
    </div>
  );
};
```

### Message Attachment Renderer

```typescript
// frontend/src/components/messages/MessageAttachments/MessageAttachments.tsx
interface MessageAttachmentsProps {
  attachments: FileMetadata[];
  messageId: string;
}

export const MessageAttachments: React.FC<MessageAttachmentsProps> = ({
  attachments,
  messageId,
}) => {
  if (attachments.length === 0) return null;
  
  // Group attachments by type for better layout
  const groupedAttachments = groupAttachmentsByType(attachments);
  
  return (
    <div className="mt-2 space-y-2">
      {/* Images - show in grid */}
      {groupedAttachments.images.length > 0 && (
        <ImageGrid
          images={groupedAttachments.images}
          maxImages={4}
          className="rounded-lg overflow-hidden"
        />
      )}
      
      {/* Videos - show individually */}
      {groupedAttachments.videos.map((video) => (
        <MediaViewer
          key={video.id}
          file={video}
          size="medium"
          autoPlay={false}
          className="max-w-md"
        />
      ))}
      
      {/* Audio files - show as playlist */}
      {groupedAttachments.audio.length > 0 && (
        <div className="space-y-2">
          {groupedAttachments.audio.map((audio) => (
            <MediaViewer
              key={audio.id}
              file={audio}
              className="max-w-md"
            />
          ))}
        </div>
      )}
      
      {/* Documents and other files */}
      {groupedAttachments.documents.length > 0 && (
        <div className="space-y-1">
          {groupedAttachments.documents.map((doc) => (
            <FileAttachment
              key={doc.id}
              file={doc}
              compact={groupedAttachments.documents.length > 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};
```

## Implementation Tasks

### Backend Tasks
1. **Media Processing Pipeline**
   - Implement FileMetadataProcessor with specialized processors
   - Create ImageProcessor with thumbnail generation
   - Build VideoProcessor with thumbnail and preview generation
   - Develop AudioProcessor with waveform analysis
   - Add DocumentProcessor for PDF thumbnails

2. **Storage Optimization**
   - Implement multi-resolution thumbnail storage
   - Add progressive JPEG/WebP support
   - Create video streaming endpoint
   - Optimize file serving with proper headers

3. **Processing Queue**
   - Add background job processing for media
   - Implement retry logic for failed processing
   - Add progress tracking for long processing tasks
   - Create cleanup for temporary processing files

### Frontend Tasks
1. **Media Components**
   - Create MediaViewer with type detection
   - Build advanced VideoPlayer with custom controls
   - Implement AudioPlayer with waveform visualization
   - Add ImageViewer with fullscreen and zoom

2. **Message Integration**
   - Update MessageAttachments component
   - Add media grid layouts
   - Implement lazy loading for media
   - Add progressive image loading

3. **Performance Optimization**
   - Implement image lazy loading
   - Add video poster frames
   - Create intersection observer for media
   - Optimize bundle size with dynamic imports

### Infrastructure Tasks
1. **Processing Services**
   - Set up FFmpeg for video processing
   - Configure Sharp for image processing
   - Add audio processing libraries
   - Set up background job queue

2. **Storage Strategy**
   - Implement CDN-ready file serving
   - Add file compression and optimization
   - Create cache headers for media files
   - Plan for cloud storage integration

## Success Criteria

- [ ] All supported media types render correctly in messages
- [ ] Thumbnails generate automatically for images and videos
- [ ] Video player has custom controls and poster frames
- [ ] Audio player shows waveforms and metadata
- [ ] Large media files load progressively without blocking
- [ ] Media processing happens in background without blocking uploads
- [ ] File serving is optimized with proper caching headers
- [ ] Media components are accessible and keyboard navigable
- [ ] Performance is smooth with multiple media files
- [ ] Mobile devices handle media playback correctly

This phase transforms the file upload system into a rich multimedia experience while maintaining performance and user experience standards.