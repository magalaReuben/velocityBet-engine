import { Injectable, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import { resolve, join } from 'path';

@Injectable()
export class ApiService implements OnModuleInit {
  private engineModule: any;
  private storedMetadata: any = null;

  async onModuleInit() {
    // Dynamic import to load the .mjs module from the CommonJS Nest context
    // @ts-ignore
    this.engineModule = await import('../backend/engine.mjs');
    await this.engineModule.ensureInitialized();
    // Pre-load track + restore physics world in background (~25s) so first race is instant
    this.engineModule.startWarmup().catch((err: Error) => {
      console.warn(`[ApiService] Track warmup deferred: ${err.message}`);
    });
  }

  getStatus() {
    const snapshotPath = resolve('track-snapshot.bin');
    const snapshotGzPath = resolve('track-snapshot.bin.gz');
    const metadataPath = resolve('track-metadata.json');
    const hasSnapshot = fs.existsSync(metadataPath) &&
      (fs.existsSync(snapshotPath) || fs.existsSync(snapshotGzPath));
    const warmup = this.engineModule?.getWarmupStatus?.() ?? {};
    return { hasSnapshot, ...warmup };
  }

  setMetadata(metadata: any) {
    this.storedMetadata = metadata;
  }

  async storeSnapshot(snapshot: Buffer) {
    await this.engineModule.ensureInitialized();
    // Use the backend engine's original store method
    await this.engineModule.storeSnapshot(snapshot, this.storedMetadata);
  }

  async *streamRace(seed: any) {
    await this.engineModule.ensureInitialized();
    for await (const chunk of this.engineModule.streamRace(seed)) {
      yield JSON.stringify(chunk) + '\n';
    }
  }
}
