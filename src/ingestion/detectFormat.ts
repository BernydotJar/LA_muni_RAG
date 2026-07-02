import { extname } from "node:path";
import type { SourceFormat } from "./types.js";

const EXTENSION_TO_FORMAT: Record<string, SourceFormat> = {
  ".md": "markdown",
  ".markdown": "markdown",
  ".txt": "txt",
  ".docx": "docx",
  ".pdf": "pdf",
};

export const detectFormat = (sourcePath: string): SourceFormat => {
  const extension = extname(sourcePath).toLowerCase();
  const format = EXTENSION_TO_FORMAT[extension];
  if (!format) {
    throw new Error(`Unsupported document extension: ${extension || "(none)"}`);
  }
  return format;
};
