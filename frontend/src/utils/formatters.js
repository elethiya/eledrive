export function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
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

export function getFileTypeCategory(mime = '', ext = '') {
  mime = (mime || '').toLowerCase();
  ext = (ext || '').toLowerCase();

  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.includes('pdf')) return 'pdf';
  if (
    mime.includes('javascript') ||
    mime.includes('json') ||
    mime.includes('xml') ||
    mime.includes('yaml') ||
    ['.go', '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.rs', '.php', '.rb', '.html', '.css', '.scss', '.sql', '.sh', '.bash', '.md', '.env'].includes(ext)
  ) {
    return 'code';
  }
  if (mime.includes('zip') || mime.includes('tar') || mime.includes('gzip') || ['.zip', '.tar', '.gz', '.7z', '.rar'].includes(ext)) {
    return 'archive';
  }
  if (mime.includes('word') || mime.includes('document') || mime.includes('sheet') || mime.includes('presentation') || ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt'].includes(ext)) {
    return 'document';
  }
  return 'file';
}
