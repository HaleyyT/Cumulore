import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export type QuarantineObject = {
  key: string;
  byteSize: number;
  bytes: Buffer;
};

/** Local-only storage adapter used by tests and development.
 * Production wiring must provide a private S3-compatible implementation. */
export class LocalQuarantineStorage {
  public constructor(private readonly root: string) {}

  public async put(key: string, bytes: Buffer): Promise<QuarantineObject> {
    const target = this.safePath(key);
    await mkdir(resolve(target, ".."), { recursive: true });
    await writeFile(target, bytes, { flag: "wx" });
    return { key, byteSize: bytes.byteLength, bytes };
  }

  public async head(key: string): Promise<{ byteSize: number }> {
    const metadata = await stat(this.safePath(key));
    return { byteSize: metadata.size };
  }

  public async read(key: string): Promise<Buffer> {
    return readFile(this.safePath(key));
  }

  private safePath(key: string): string {
    if (
      !key.startsWith("quarantine/") ||
      key.includes("..") ||
      key.includes("\\")
    ) {
      throw new Error("invalid quarantine key");
    }
    const target = resolve(join(this.root, key));
    const root = resolve(this.root);
    if (!target.startsWith(`${root}/`))
      throw new Error("invalid quarantine key");
    return target;
  }
}
