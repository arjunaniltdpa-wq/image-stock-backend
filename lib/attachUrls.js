const CDN = process.env.R2_PUBLIC_BASE_URL;

export function attachUrls(img) {
  if (!img) return img;

  return {
    ...img,
    url: img.url || `${CDN}/${encodeURIComponent(img.fileName)}`,
    thumbnailUrl:
      img.thumbnailUrl ||
      `${CDN}/${encodeURIComponent(
        img.thumbnailFileName || `thumb_${img.fileName}`
      )}`,
  };
}
