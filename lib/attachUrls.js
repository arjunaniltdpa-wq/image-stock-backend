export function attachUrls(img, CDN) {
  return {
    ...img,
    url: img.url || `${CDN}/${encodeURIComponent(img.fileName)}`,
    thumbnailUrl:
      img.thumbnailUrl || `${CDN}/${encodeURIComponent(img.thumbnailFileName)}`
  };
}
