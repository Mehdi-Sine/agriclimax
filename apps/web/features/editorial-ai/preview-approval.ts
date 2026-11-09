import { randomUUID } from "node:crypto";
import "server-only";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  openSync,
  fsyncSync,
  closeSync,
  linkSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import type { Archive } from "./model";
import { verifyArchive } from "./archive";
export interface PreviewApproval {
  version: "editorial-preview-review-1";
  edition_id: string;
  archive_checksum: string;
  reviewed_by: string;
  reviewed_at: string;
  preview_only: true;
}
export function previewApproved(root: string, a: Archive) {
  const path = join(root, "preview-approvals", a.edition_id + ".json");
  if (!existsSync(path)) return false;
  const v = JSON.parse(readFileSync(path, "utf8")) as Partial<PreviewApproval>;
  return (
    v.version === "editorial-preview-review-1" &&
    v.edition_id === a.edition_id &&
    v.archive_checksum === a.checksum &&
    v.preview_only === true &&
    typeof v.reviewed_by === "string" &&
    v.reviewed_by.length > 0 &&
    typeof v.reviewed_at === "string" &&
    Number.isFinite(Date.parse(v.reviewed_at))
  );
}
export function approvePreview(
  root: string,
  a: Archive,
  checksum: string,
  reviewer: string,
) {
  verifyArchive(a);
  if (
    a.mode !== "live" ||
    a.validation.status === "rejected" ||
    a.checksum !== checksum ||
    !reviewer.trim()
  )
    throw Error("PREVIEW_APPROVAL_REQUIRES_REVIEWED_LIVE_ARCHIVE");
  const dir = join(root, "preview-approvals");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (previewApproved(root, a)) return;
  const value: PreviewApproval = {
    version: "editorial-preview-review-1",
    edition_id: a.edition_id,
    archive_checksum: a.checksum,
    reviewed_by: reviewer,
    reviewed_at: new Date().toISOString(),
    preview_only: true,
  };
  const path = join(dir, a.edition_id + ".json");
  const tmp = path + "." + randomUUID();
  writeFileSync(tmp, JSON.stringify(value), { flag: "wx", mode: 0o600 });
  const fd = openSync(tmp, "r");
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  try {
    linkSync(tmp, path);
    const dirFd = openSync(dir, "r");
    try {
      fsyncSync(dirFd);
    } finally {
      closeSync(dirFd);
    }
  } finally {
    rmSync(tmp, { force: true });
  }
}
