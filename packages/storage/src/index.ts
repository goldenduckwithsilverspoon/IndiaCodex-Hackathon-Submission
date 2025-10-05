import * as crypto from 'crypto';
import { Level } from 'level';
import { CID } from 'multiformats/cid';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Distributed Storage System with Erasure Coding
 * Implements content-addressed storage with Reed-Solomon erasure coding
 */

export interface StorageConfig {
  dataDir: string;
  maxSizeGB: number;
  enableErasureCoding: boolean;
  dataShards: number;  // Number of data shards (e.g., 10)
  parityShards: number; // Number of parity shards (e.g., 4)
  deduplication: boolean;
}

export interface ContentMetadata {
  cid: string;
  size: number;
  mimeType: string;
  sha256: string;
  uploadedAt: number;
  shards?: ShardInfo[];
  pinned: boolean;
  expiresAt?: number;
  replicationFactor: number;
}

export interface ShardInfo {
  index: number;
  hash: string;
  size: number;
  stored: boolean;
}

export interface StorageProof {
  cid: string;
  merkleProof: string[];
  timestamp: number;
  signature: string;
}

/**
 * Simple Reed-Solomon Erasure Coding Implementation
 * For production, use a proper RS library like @ronomon/reed-solomon
 */
class ErasureCoding {
  constructor(
    private dataShards: number,
    private parityShards: number
  ) {}

  /**
   * Encode data into shards with parity
   */
  encode(data: Buffer): Buffer[] {
    const totalShards = this.dataShards + this.parityShards;
    const shardSize = Math.ceil(data.length / this.dataShards);
    const shards: Buffer[] = [];

    // Split data into data shards
    for (let i = 0; i < this.dataShards; i++) {
      const start = i * shardSize;
      const end = Math.min(start + shardSize, data.length);
      const shard = Buffer.alloc(shardSize);
      data.copy(shard, 0, start, end);
      shards.push(shard);
    }

    // Generate parity shards (XOR-based for simplicity; use Galois Field in production)
    for (let i = 0; i < this.parityShards; i++) {
      const parity = Buffer.alloc(shardSize);
      
      for (let j = 0; j < this.dataShards; j++) {
        for (let k = 0; k < shardSize; k++) {
          parity[k] ^= shards[j][k];
        }
      }
      
      shards.push(parity);
    }

    return shards;
  }

  /**
   * Decode data from available shards (can recover from missing shards)
   */
  decode(shards: (Buffer | null)[], originalSize: number): Buffer {
    const shardSize = shards[0]?.length || 0;
    
    // Count available shards
    const available = shards.filter(s => s !== null).length;
    
    if (available < this.dataShards) {
      throw new Error(`Insufficient shards: need ${this.dataShards}, have ${available}`);
    }

    // If all data shards are available, just concatenate
    const allDataShardsAvailable = shards
      .slice(0, this.dataShards)
      .every(s => s !== null);

    if (allDataShardsAvailable) {
      const result = Buffer.concat(shards.slice(0, this.dataShards) as Buffer[]);
      return result.subarray(0, originalSize);
    }

    // Reconstruct missing shards using XOR (simplified RS)
    const reconstructed = shards.map(s => s ? Buffer.from(s) : Buffer.alloc(shardSize));
    
    for (let i = 0; i < this.dataShards; i++) {
      if (!shards[i]) {
        // Reconstruct using parity
        const parity = shards[this.dataShards]; // Use first available parity
        if (parity) {
          reconstructed[i] = Buffer.from(parity);
          
          for (let j = 0; j < this.dataShards; j++) {
            if (i !== j && shards[j]) {
              for (let k = 0; k < shardSize; k++) {
                reconstructed[i][k] ^= shards[j]![k];
              }
            }
          }
        }
      }
    }

    const result = Buffer.concat(reconstructed.slice(0, this.dataShards));
    return result.subarray(0, originalSize);
  }
}

export class DistributedStorage {
  private db: Level<string, string>;
  private erasureCoding?: ErasureCoding;
  private usageBytes: number = 0;

  constructor(private config: StorageConfig) {
    this.db = new Level(path.join(config.dataDir, 'metadata'), {
      valueEncoding: 'json',
    });

    if (config.enableErasureCoding) {
      this.erasureCoding = new ErasureCoding(
        config.dataShards,
        config.parityShards
      );
    }
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.config.dataDir, { recursive: true });
    await fs.mkdir(path.join(this.config.dataDir, 'content'), { recursive: true });
    await fs.mkdir(path.join(this.config.dataDir, 'shards'), { recursive: true });
    
    console.log(`Storage initialized at ${this.config.dataDir}`);
    console.log(`Max size: ${this.config.maxSizeGB} GB`);
    console.log(`Erasure coding: ${this.config.enableErasureCoding ? 'enabled' : 'disabled'}`);
  }

  /**
   * Store content with optional erasure coding
   */
  async store(
    content: Buffer,
    metadata: Omit<ContentMetadata, 'cid' | 'sha256' | 'uploadedAt' | 'size'>
  ): Promise<string> {
    // Generate CID
    const sha256 = crypto.createHash('sha256').update(content).digest('hex');
    // For simplicity, use sha256 hex as CID (in production, use proper multihash)
    const cid = `bafybeigdyrzt${sha256.slice(0, 50)}`; // Mock CIDv1 format

    // Check for deduplication
    if (this.config.deduplication) {
      try {
        const existing = await this.db.get(cid);
        if (existing) {
          console.log(`Content ${cid} already exists (deduplicated)`);
          return cid;
        }
      } catch {
        // Content doesn't exist, continue storing
      }
    }

    // Check storage quota
    const maxBytes = this.config.maxSizeGB * 1024 * 1024 * 1024;
    if (this.usageBytes + content.length > maxBytes) {
      throw new Error('Storage quota exceeded');
    }

    const fullMetadata: ContentMetadata = {
      ...metadata,
      cid,
      sha256,
      size: content.length,
      uploadedAt: Date.now(),
    };

    if (this.config.enableErasureCoding && this.erasureCoding) {
      // Store with erasure coding
      await this.storeWithErasureCoding(cid, content, fullMetadata);
    } else {
      // Store as single file
      await this.storeDirectly(cid, content);
    }

    // Store metadata
    await this.db.put(cid, JSON.stringify(fullMetadata));
    this.usageBytes += content.length;

    console.log(`Stored content ${cid} (${content.length} bytes)`);
    return cid;
  }

  /**
   * Retrieve content by CID
   */
  async retrieve(cid: string): Promise<Buffer | null> {
    try {
      const metadataStr = await this.db.get(cid);
      const metadata: ContentMetadata = JSON.parse(metadataStr);

      if (metadata.shards && metadata.shards.length > 0) {
        // Retrieve from shards with erasure decoding
        return await this.retrieveFromShards(cid, metadata);
      } else {
        // Retrieve directly
        return await this.retrieveDirectly(cid);
      }
    } catch (err) {
      console.error(`Failed to retrieve ${cid}:`, err);
      return null;
    }
  }

  /**
   * Get content metadata
   */
  async getMetadata(cid: string): Promise<ContentMetadata | null> {
    try {
      const metadataStr = await this.db.get(cid);
      return JSON.parse(metadataStr);
    } catch {
      return null;
    }
  }

  /**
   * Pin content (prevent garbage collection)
   */
  async pin(cid: string): Promise<void> {
    const metadata = await this.getMetadata(cid);
    if (!metadata) {
      throw new Error(`Content ${cid} not found`);
    }

    metadata.pinned = true;
    await this.db.put(cid, JSON.stringify(metadata));
    console.log(`Pinned ${cid}`);
  }

  /**
   * Unpin content
   */
  async unpin(cid: string): Promise<void> {
    const metadata = await this.getMetadata(cid);
    if (!metadata) return;

    metadata.pinned = false;
    await this.db.put(cid, JSON.stringify(metadata));
    console.log(`Unpinned ${cid}`);
  }

  /**
   * Generate Merkle proof for storage verification
   */
  async generateStorageProof(cid: string): Promise<StorageProof> {
    const metadata = await this.getMetadata(cid);
    if (!metadata) {
      throw new Error(`Content ${cid} not found`);
    }

    // Simple Merkle proof (for production, use proper Merkle tree)
    const merkleProof: string[] = [];
    
    if (metadata.shards) {
      for (const shard of metadata.shards) {
        merkleProof.push(shard.hash);
      }
    } else {
      merkleProof.push(metadata.sha256);
    }

    // Generate signature (for production, use proper signing)
    const proofData = JSON.stringify({ cid, merkleProof, timestamp: Date.now() });
    const signature = crypto.createHash('sha256').update(proofData).digest('hex');

    return {
      cid,
      merkleProof,
      timestamp: Date.now(),
      signature,
    };
  }

  /**
   * Verify storage proof
   */
  async verifyStorageProof(proof: StorageProof): Promise<boolean> {
    const metadata = await this.getMetadata(proof.cid);
    if (!metadata) return false;

    // Verify Merkle proof matches stored hashes
    if (metadata.shards) {
      const storedHashes = metadata.shards.map(s => s.hash);
      return proof.merkleProof.every(h => storedHashes.includes(h));
    } else {
      return proof.merkleProof.includes(metadata.sha256);
    }
  }

  /**
   * Garbage collection - remove unpinned expired content
   */
  async garbageCollect(): Promise<number> {
    let freedBytes = 0;
    const now = Date.now();

    const iterator = this.db.iterator();
    
    for await (const [cid, metadataStr] of iterator) {
      const metadata: ContentMetadata = JSON.parse(metadataStr);

      // Skip pinned content
      if (metadata.pinned) continue;

      // Remove expired content
      if (metadata.expiresAt && metadata.expiresAt < now) {
        await this.delete(cid);
        freedBytes += metadata.size;
      }
    }

    console.log(`Garbage collection freed ${freedBytes} bytes`);
    return freedBytes;
  }

  /**
   * Delete content
   */
  async delete(cid: string): Promise<void> {
    const metadata = await this.getMetadata(cid);
    if (!metadata) return;

    // Delete shards or file
    if (metadata.shards) {
      for (const shard of metadata.shards) {
        const shardPath = this.getShardPath(cid, shard.index);
        await fs.unlink(shardPath).catch(() => {});
      }
    } else {
      const filePath = this.getContentPath(cid);
      await fs.unlink(filePath).catch(() => {});
    }

    // Delete metadata
    await this.db.del(cid);
    this.usageBytes -= metadata.size;

    console.log(`Deleted ${cid}`);
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    totalFiles: number;
    usedBytes: number;
    usedGB: number;
    maxGB: number;
    utilizationPercent: number;
  }> {
    let totalFiles = 0;
    
    const iterator = this.db.iterator();
    for await (const _ of iterator) {
      totalFiles++;
    }

    const usedGB = this.usageBytes / (1024 * 1024 * 1024);
    const utilizationPercent = (usedGB / this.config.maxSizeGB) * 100;

    return {
      totalFiles,
      usedBytes: this.usageBytes,
      usedGB,
      maxGB: this.config.maxSizeGB,
      utilizationPercent,
    };
  }

  // Private helper methods
  private async storeWithErasureCoding(
    cid: string,
    content: Buffer,
    metadata: ContentMetadata
  ): Promise<void> {
    if (!this.erasureCoding) throw new Error('Erasure coding not enabled');

    const shards = this.erasureCoding.encode(content);
    const shardInfos: ShardInfo[] = [];

    for (let i = 0; i < shards.length; i++) {
      const shard = shards[i];
      const shardHash = crypto.createHash('sha256').update(shard).digest('hex');
      const shardPath = this.getShardPath(cid, i);

      await fs.writeFile(shardPath, shard);

      shardInfos.push({
        index: i,
        hash: shardHash,
        size: shard.length,
        stored: true,
      });
    }

    metadata.shards = shardInfos;
  }

  private async storeDirectly(cid: string, content: Buffer): Promise<void> {
    const filePath = this.getContentPath(cid);
    await fs.writeFile(filePath, content);
  }

  private async retrieveFromShards(
    cid: string,
    metadata: ContentMetadata
  ): Promise<Buffer> {
    if (!this.erasureCoding) throw new Error('Erasure coding not enabled');
    if (!metadata.shards) throw new Error('No shard information');

    const shards: (Buffer | null)[] = [];

    for (const shardInfo of metadata.shards) {
      const shardPath = this.getShardPath(cid, shardInfo.index);
      try {
        const shard = await fs.readFile(shardPath);
        shards.push(shard);
      } catch {
        shards.push(null); // Missing shard
      }
    }

    return this.erasureCoding.decode(shards, metadata.size);
  }

  private async retrieveDirectly(cid: string): Promise<Buffer> {
    const filePath = this.getContentPath(cid);
    return await fs.readFile(filePath);
  }

  private getContentPath(cid: string): string {
    const prefix = cid.slice(0, 2);
    return path.join(this.config.dataDir, 'content', prefix, cid);
  }

  private getShardPath(cid: string, index: number): string {
    const prefix = cid.slice(0, 2);
    return path.join(this.config.dataDir, 'shards', prefix, `${cid}.${index}`);
  }
}
