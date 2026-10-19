import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { AppError } from "../../utils/app-error.js";
import { mediaDirectory, mediaTempDirectory } from "./media.upload.js";

type MediaMetadata = {
  ownerId: number;
  mimeType: string;
  size: number;
};

type UploadedMedia = {
  id: string;
  mimeType: string;
  size: number;
};

const imageMimeTypes: Record<string, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function mediaPaths(id: string): { filePath: string; metadataPath: string } {
  return {
    filePath: path.join(mediaDirectory, id),
    metadataPath: path.join(mediaDirectory, `${id}.owner.json`),
  };
}

async function readMetadata(id: string): Promise<MediaMetadata | null> {
  try {
    const contents = await fs.readFile(mediaPaths(id).metadataPath, "utf8");
    const metadata: unknown = JSON.parse(contents);
    if (
      typeof metadata !== "object" ||
      metadata === null ||
      !("ownerId" in metadata) ||
      typeof metadata.ownerId !== "number" ||
      !("mimeType" in metadata) ||
      typeof metadata.mimeType !== "string" ||
      !("size" in metadata) ||
      typeof metadata.size !== "number"
    ) {
      throw new Error(`Invalid media metadata for ${id}`);
    }
    return {
      ownerId: metadata.ownerId,
      mimeType: metadata.mimeType,
      size: metadata.size,
    };
  } catch (error) {
    if (isMissingFile(error)) return null;
    throw error;
  }
}

function hasMp3Signature(fileHeader: Buffer): boolean {
  if (fileHeader.length >= 10 && fileHeader.subarray(0, 3).toString("ascii") === "ID3") return true;
  return (
    fileHeader.length >= 2 &&
    fileHeader[0] === 0xff &&
    (fileHeader[1]! & 0xe0) === 0xe0 &&
    (fileHeader[1]! & 0x06) !== 0
  );
}

function hasMp4Signature(fileHeader: Buffer): boolean {
  return fileHeader.length >= 12 && fileHeader.subarray(4, 8).toString("ascii") === "ftyp";
}

export const mediaService = {
  async upload(file: Express.Multer.File | undefined, ownerId: number): Promise<UploadedMedia> {
    if (!file) throw new AppError(400, "media.fileRequired");

    const idPrefix = randomUUID();
    const header = Buffer.alloc(12);
    const handle = await fs.open(file.path, "r");
    let headerSize = 0;
    try {
      ({ bytesRead: headerSize } = await handle.read(header, 0, header.length, 0));
    } finally {
      await handle.close();
    }
    const fileHeader = header.subarray(0, headerSize);

    let id: string;
    let mimeType: string;
    let outputPath: string;

    if (file.mimetype.startsWith("image/")) {
      let image: sharp.Metadata;
      try {
        image = await sharp(file.path, { limitInputPixels: 40_000_000 }).metadata();
      } catch {
        await fs.rm(file.path, { force: true });
        throw new AppError(400, "media.invalidFile");
      }

      if (!image.format || !imageMimeTypes[image.format]) {
        await fs.rm(file.path, { force: true });
        throw new AppError(400, "media.invalidFile");
      }

      id = `${idPrefix}.webp`;
      mimeType = "image/webp";
      outputPath = path.join(mediaTempDirectory, `${idPrefix}.webp`);
      try {
        await sharp(file.path, { limitInputPixels: 40_000_000, animated: image.format === "gif" })
          .webp({ quality: 85 })
          .toFile(outputPath);
      } catch {
        await fs.rm(file.path, { force: true });
        await fs.rm(outputPath, { force: true });
        throw new AppError(400, "media.invalidFile");
      }
    } else if (file.mimetype === "audio/mpeg" && hasMp3Signature(fileHeader)) {
      id = `${idPrefix}.mp3`;
      mimeType = "audio/mpeg";
      outputPath = file.path;
    } else if (file.mimetype === "video/mp4" && hasMp4Signature(fileHeader)) {
      id = `${idPrefix}.mp4`;
      mimeType = "video/mp4";
      outputPath = file.path;
    } else {
      await fs.rm(file.path, { force: true });
      throw new AppError(400, "media.invalidFile");
    }

    const { filePath, metadataPath } = mediaPaths(id);
    const metadataTempPath = path.join(mediaTempDirectory, `${idPrefix}.owner.json`);

    try {
      await fs.mkdir(mediaDirectory, { recursive: true });
      await fs.rename(outputPath, filePath);
      const stat = await fs.stat(filePath);
      await fs.writeFile(metadataTempPath, JSON.stringify({ ownerId, mimeType, size: stat.size } satisfies MediaMetadata), {
        encoding: "utf8",
        flag: "wx",
      });
      await fs.rename(metadataTempPath, metadataPath);
      return { id, mimeType, size: stat.size };
    } catch (error) {
      await fs.rm(file.path, { force: true });
      if (outputPath !== file.path) await fs.rm(outputPath, { force: true });
      await fs.rm(filePath, { force: true });
      await fs.rm(metadataTempPath, { force: true });
      throw error;
    } finally {
      await fs.rm(file.path, { force: true });
    }
  },

  async get(id: string): Promise<{ filePath: string; mimeType: string }> {
    const metadata = await readMetadata(id);
    if (!metadata) throw new AppError(404, "media.notFound");

    const filePath = mediaPaths(id).filePath;
    try {
      await fs.access(filePath);
    } catch (error) {
      if (isMissingFile(error)) throw new AppError(404, "media.notFound");
      throw error;
    }
    return { filePath, mimeType: metadata.mimeType };
  },

  async delete(id: string, userId: number): Promise<void> {
    const metadata = await readMetadata(id);
    if (!metadata) throw new AppError(404, "media.notFound");
    if (metadata.ownerId !== userId) throw new AppError(403, "media.notOwner");

    const { filePath, metadataPath } = mediaPaths(id);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if (isMissingFile(error)) throw new AppError(404, "media.notFound");
      throw error;
    }
    await fs.unlink(metadataPath);
  },
};
