export function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatSpeed(bytesPerSec) {
  if (!bytesPerSec || bytesPerSec <= 0) return '0 B/s';
  return `${formatBytes(bytesPerSec)}/s`;
}

export function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Extracts a normalized lowercase extension with leading dot from filename or extension.
 */
export function extractExtension(filename = '', ext = '') {
  let e = (ext || '').trim().toLowerCase();
  if (e) {
    return e.startsWith('.') ? e : '.' + e;
  }
  const name = (filename || '').trim().toLowerCase();
  const lastDot = name.lastIndexOf('.');
  if (lastDot !== -1 && lastDot < name.length - 1) {
    return name.substring(lastDot);
  }
  return '';
}

export function getFileTypeCategory(mime = '', ext = '', filename = '') {
  mime = (mime || '').toLowerCase().trim();
  const normalizedExt = extractExtension(filename, ext);

  // 1. PDF Documents
  if (
    mime === 'application/pdf' ||
    mime === 'application/x-pdf' ||
    mime.includes('pdf') ||
    normalizedExt === '.pdf'
  ) {
    return 'pdf';
  }

  // 2. Images
  if (
    mime.startsWith('image/') ||
    ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico', '.tiff', '.tif', '.avif', '.heic', '.heif'].includes(normalizedExt)
  ) {
    return 'image';
  }

  // 3. Videos
  if (
    mime.startsWith('video/') ||
    ['.mp4', '.webm', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.m4v', '.3gp', '.ogv', '.ts'].includes(normalizedExt)
  ) {
    return 'video';
  }

  // 4. Audio
  if (
    mime.startsWith('audio/') ||
    ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.wma', '.opus', '.aiff', '.alac', '.mid', '.midi'].includes(normalizedExt)
  ) {
    return 'audio';
  }

  // 5. Spreadsheets
  if (
    mime.includes('spreadsheet') ||
    mime.includes('excel') ||
    mime.includes('csv') ||
    mime.includes('tab-separated-values') ||
    ['.xls', '.xlsx', '.xlsm', '.xlsb', '.csv', '.tsv', '.ods', '.numbers'].includes(normalizedExt)
  ) {
    return 'spreadsheet';
  }

  // 6. Presentations
  if (
    mime.includes('presentation') ||
    mime.includes('powerpoint') ||
    ['.ppt', '.pptx', '.pps', '.ppsx', '.odp', '.key'].includes(normalizedExt)
  ) {
    return 'presentation';
  }

  // 7. Code & Developer scripts
  if (
    mime.includes('javascript') ||
    mime.includes('typescript') ||
    mime.includes('json') ||
    mime.includes('xml') ||
    mime.includes('yaml') ||
    mime.includes('x-sh') ||
    mime.includes('x-python') ||
    mime.includes('x-go') ||
    mime.includes('x-sql') ||
    [
      '.go', '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp',
      '.cs', '.rs', '.php', '.rb', '.html', '.htm', '.css', '.scss', '.sass', '.less',
      '.sql', '.sh', '.bash', '.zsh', '.json', '.xml', '.yaml', '.yml', '.toml',
      '.env', '.lua', '.swift', '.kt', '.dart', '.vue', '.svelte', '.dockerfile', '.graphql'
    ].includes(normalizedExt)
  ) {
    return 'code';
  }

  // 8. Archives
  if (
    mime.includes('zip') ||
    mime.includes('tar') ||
    mime.includes('gzip') ||
    mime.includes('compressed') ||
    mime.includes('rar') ||
    ['.zip', '.tar', '.gz', '.tgz', '.7z', '.rar', '.bz2', '.tbz2', '.xz', '.txz', '.iso', '.dmg'].includes(normalizedExt)
  ) {
    return 'archive';
  }

  // 9. Documents (Word, Text, Rich Text, etc.)
  if (
    mime.includes('word') ||
    mime.includes('document') ||
    mime.includes('rtf') ||
    mime.startsWith('text/') ||
    ['.doc', '.docx', '.dot', '.dotx', '.odt', '.rtf', '.txt', '.md', '.pages', '.tex', '.epub', '.log', '.rst'].includes(normalizedExt)
  ) {
    return 'document';
  }

  return 'other';
}

/**
 * Convenient helper to detect file category from an item object (file) or direct arguments.
 */
export function detectFileCategory(itemOrMime, ext = '', filename = '') {
  if (itemOrMime && typeof itemOrMime === 'object') {
    return getFileTypeCategory(
      itemOrMime.mime_type || itemOrMime.type || '',
      itemOrMime.extension || '',
      itemOrMime.name || itemOrMime.original_name || ''
    );
  }
  return getFileTypeCategory(itemOrMime, ext, filename);
}

/**
 * UI Configuration for each file category (labels, styling, active states).
 */
export const CATEGORY_CONFIG = {
  all: {
    id: 'all',
    label: 'All',
    singular: 'All',
    activeClass: 'bg-blue-600/20 text-blue-400 border-blue-500/30',
    iconColor: 'text-blue-400',
  },
  folder: {
    id: 'folder',
    label: 'Folders',
    singular: 'Folder',
    activeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    iconColor: 'text-amber-400',
  },
  document: {
    id: 'document',
    label: 'Documents',
    singular: 'Document',
    activeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    iconColor: 'text-blue-400',
  },
  pdf: {
    id: 'pdf',
    label: 'PDFs',
    singular: 'PDF',
    activeClass: 'bg-red-500/20 text-red-300 border-red-500/30',
    iconColor: 'text-red-400',
  },
  spreadsheet: {
    id: 'spreadsheet',
    label: 'Spreadsheets',
    singular: 'Spreadsheet',
    activeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    iconColor: 'text-emerald-400',
  },
  presentation: {
    id: 'presentation',
    label: 'Presentations',
    singular: 'Presentation',
    activeClass: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    iconColor: 'text-orange-400',
  },
  image: {
    id: 'image',
    label: 'Images',
    singular: 'Image',
    activeClass: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
    iconColor: 'text-pink-400',
  },
  video: {
    id: 'video',
    label: 'Videos',
    singular: 'Video',
    activeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    iconColor: 'text-rose-400',
  },
  audio: {
    id: 'audio',
    label: 'Audio',
    singular: 'Audio',
    activeClass: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
    iconColor: 'text-violet-400',
  },
  code: {
    id: 'code',
    label: 'Code',
    singular: 'Code',
    activeClass: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
    iconColor: 'text-teal-400',
  },
  archive: {
    id: 'archive',
    label: 'Archives',
    singular: 'Archive',
    activeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    iconColor: 'text-amber-500',
  },
  other: {
    id: 'other',
    label: 'Other Files',
    singular: 'Other',
    activeClass: 'bg-slate-700/30 text-slate-300 border-slate-600/30',
    iconColor: 'text-slate-400',
  },
};
