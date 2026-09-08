/** Tipos que acepta el bucket `visitor-documents`. */
export const STORAGE_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const INCOMING_TYPES = [
  ...STORAGE_IMAGE_TYPES,
  "image/jpg",
  "application/octet-stream",
  "",
];

export const MAX_IDENTITY_BYTES = 8 * 1024 * 1024;

export function identityFileMeta(file: File) {
  const type = file.type.toLowerCase();
  if (type === "image/png") return { mimeType: "image/png", extension: "png" };
  if (type === "image/webp")
    return { mimeType: "image/webp", extension: "webp" };
  return { mimeType: "image/jpeg", extension: "jpeg" };
}

export function isAllowedIdentityUpload(file: File) {
  if (file.size <= 0 || file.size > MAX_IDENTITY_BYTES) return false;
  return INCOMING_TYPES.includes(file.type.toLowerCase());
}
