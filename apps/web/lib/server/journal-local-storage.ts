import "server-only";
import {randomUUID} from "node:crypto";
import {link, mkdir, open, rm, writeFile} from "node:fs/promises";
import {dirname, isAbsolute, join} from "node:path";
import {journalObjectPath, type MapObjectStore} from "./immutable-map-storage";

function errorCode(error: unknown) {
  return error && typeof error === "object" && "code" in error ? error.code : undefined;
}

export function localJournalStore(directory: string): MapObjectStore {
  if (!isAbsolute(directory)) throw Error("JOURNAL_LOCAL_DIRECTORY");
  const location = (path: string) => join(/*turbopackIgnore: true*/ directory, journalObjectPath(path));
  return {
    async read(path, limit) {
      let file;
      try { file = await open(location(path), "r"); }
      catch (error) {
        if (errorCode(error) === "ENOENT") return null;
        throw error;
      }
      try {
        const size = (await file.stat()).size;
        if (size > limit) throw Error("JOURNAL_LOCAL_BUDGET");
        const bytes = Buffer.alloc(size + 1);
        let offset = 0;
        while (offset < bytes.length) {
          const {bytesRead} = await file.read(bytes, offset, bytes.length - offset);
          if (!bytesRead) break;
          offset += bytesRead;
        }
        if (offset !== size) throw Error("JOURNAL_LOCAL_SIZE");
        return bytes.subarray(0, size);
      } finally {await file.close();}
    },
    async insert(path, bytes) {
      const target = location(path);
      const temp = join(/*turbopackIgnore: true*/ dirname(target), `.${randomUUID()}`);
      await mkdir(dirname(target), {recursive:true, mode:0o700});
      try {
        await writeFile(temp, bytes, {flag:"wx", mode:0o600});
        try { await link(temp, target); }
        catch (error) { if (errorCode(error) !== "EEXIST") throw error; }
      } finally { await rm(temp, {force:true}); }
    },
  };
}
