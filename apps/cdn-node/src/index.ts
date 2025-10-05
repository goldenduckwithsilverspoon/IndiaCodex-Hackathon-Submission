import express, { Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import multer from 'multer';
import mime from 'mime-types';
import * as fs from 'fs/promises';
import { CardanoStreamNetwork, NetworkConfig } from '@cardanostream/p2p-network';
import { DistributedStorage, StorageConfig } from '@cardanostream/storage';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * CardanoStream CDN Node
 * Production-ready node software for decentralized content delivery
 */

interface NodeConfig {
  port: number;
  dataDir: string;
  network: NetworkConfig;
  storage: StorageConfig;
  operatorAddress?: string;
  stakeAmount?: number;
}

export class CDNNode {
  private app: express.Application;
  private network!: CardanoStreamNetwork;
  private storage!: DistributedStorage;
  private bandwidthUsed: number = 0;
  private requestCount: number = 0;
  private startTime: number = Date.now();

  constructor(private config: NodeConfig) {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(morgan('combined'));
    this.app.use(express.json());
  }

  private setupRoutes(): void {
    const upload = multer({ storage: multer.memoryStorage() });

    // Health check
    this.app.get('/health', this.handleHealth.bind(this));

    // Node info and statistics
    this.app.get('/api/node/info', this.handleNodeInfo.bind(this));
    this.app.get('/api/node/stats', this.handleNodeStats.bind(this));

    // Content management
    this.app.post('/api/upload', upload.single('file'), this.handleUpload.bind(this));
    this.app.get('/api/files', this.handleListFiles.bind(this));
    this.app.get('/api/meta/:cid', this.handleGetMetadata.bind(this));
    this.app.delete('/api/content/:cid', this.handleDelete.bind(this));

    // Content pinning
    this.app.post('/api/pin/:cid', this.handlePin.bind(this));
    this.app.delete('/api/pin/:cid', this.handleUnpin.bind(this));

    // Storage proofs
    this.app.get('/api/proof/:cid', this.handleGetProof.bind(this));
    this.app.post('/api/proof/verify', this.handleVerifyProof.bind(this));

    // Content delivery (public, high-performance)
    this.app.get('/content/:cid', this.handleGetContent.bind(this));
    this.app.head('/content/:cid', this.handleHeadContent.bind(this));

    // Serve static dashboard
    this.app.use('/', express.static('public'));
  }

  async start(): Promise<void> {
    console.log('🚀 Starting CardanoStream CDN Node...\n');

    // Initialize storage
    console.log('📦 Initializing distributed storage...');
    this.storage = new DistributedStorage(this.config.storage);
    await this.storage.initialize();

    // Initialize P2P network
    console.log('🌐 Initializing P2P network...');
    this.network = new CardanoStreamNetwork(this.config.network);
    await this.network.start();

    // Start HTTP server
    await new Promise<void>((resolve) => {
      this.app.listen(this.config.port, () => {
        console.log(`\n✅ CDN Node running on http://localhost:${this.config.port}`);
        console.log(`📁 Data directory: ${this.config.dataDir}`);
        console.log(`🔗 Peer ID: ${this.network.getNetworkStats().peersConnected} peers connected\n`);
        resolve();
      });
    });

    // Start background tasks
    this.startBackgroundTasks();
  }

  private startBackgroundTasks(): void {
    // Garbage collection every hour
    setInterval(async () => {
      console.log('🗑️  Running garbage collection...');
      await this.storage.garbageCollect();
    }, 60 * 60 * 1000);

    // Log stats every 5 minutes
    setInterval(async () => {
      const stats = await this.getStats();
      console.log('\n📊 Node Statistics:');
      console.log(`   Files stored: ${stats.storage.totalFiles}`);
      console.log(`   Storage used: ${stats.storage.usedGB.toFixed(2)} GB / ${stats.storage.maxGB} GB`);
      console.log(`   Peers connected: ${stats.network.peersConnected}`);
      console.log(`   Bandwidth served: ${(stats.bandwidthGB).toFixed(2)} GB`);
      console.log(`   Total requests: ${stats.requestCount}\n`);
    }, 5 * 60 * 1000);
  }

  // Route handlers
  private async handleHealth(req: Request, res: Response): Promise<void> {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    res.json({
      status: 'healthy',
      uptime,
      version: '0.1.0',
    });
  }

  private async handleNodeInfo(req: Request, res: Response): Promise<void> {
    const networkStats = this.network.getNetworkStats();
    
    res.json({
      version: '0.1.0',
      operator: this.config.operatorAddress || 'unknown',
      stakeAmount: this.config.stakeAmount || 0,
      peersConnected: networkStats.peersConnected,
      contentStored: networkStats.contentStored,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    });
  }

  private async handleNodeStats(req: Request, res: Response): Promise<void> {
    const stats = await this.getStats();
    res.json(stats);
  }

  private async handleUpload(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file provided' });
        return;
      }

      const { buffer, originalname, mimetype } = req.file;
      const replicationFactor = parseInt(req.body.replicationFactor || '3');
      const pinned = req.body.pinned === 'true';
      const ttlDays = parseInt(req.body.ttlDays || '0');

      // Store locally
      const cid = await this.storage.store(Buffer.from(buffer), {
        mimeType: mimetype || mime.lookup(originalname) || 'application/octet-stream',
        pinned,
        replicationFactor,
        ...(ttlDays > 0 ? { expiresAt: Date.now() + ttlDays * 24 * 60 * 60 * 1000 } : {}),
      });

      // Publish to network
      await this.network.publishContent(buffer, {
        size: buffer.length,
        mimeType: mimetype,
        replicationFactor,
      });

      this.requestCount++;

      res.json({
        cid,
        url: `/content/${cid}`,
        size: buffer.length,
        mimeType: mimetype,
        replicationFactor,
      });
    } catch (err: any) {
      console.error('Upload error:', err);
      res.status(500).json({ error: err.message || 'Upload failed' });
    }
  }

  private async handleListFiles(req: Request, res: Response): Promise<void> {
    // In production, implement pagination
    const files: any[] = [];
    
    // This would iterate through storage metadata
    // For now, return empty array
    res.json({ files });
  }

  private async handleGetMetadata(req: Request, res: Response): Promise<void> {
    const { cid } = req.params;
    
    const metadata = await this.storage.getMetadata(cid);
    
    if (!metadata) {
      res.status(404).json({ error: 'Content not found' });
      return;
    }

    res.json(metadata);
  }

  private async handleGetContent(req: Request, res: Response): Promise<void> {
    const { cid } = req.params;

    try {
      // Try local storage first
      let content: Uint8Array | null = await this.storage.retrieve(cid);

      // If not found locally, try network
      if (!content) {
        console.log(`Fetching ${cid} from network...`);
        content = await this.network.retrieveContent(cid);
      }

      if (!content) {
        res.status(404).send('Content not found');
        return;
      }

      // Convert Uint8Array to Buffer if needed
      const contentBuffer = content instanceof Buffer ? content : Buffer.from(content);

      const metadata = await this.storage.getMetadata(cid);
      const contentType = metadata?.mimeType || 'application/octet-stream';

      // Track bandwidth
      this.bandwidthUsed += contentBuffer.length;
      this.requestCount++;

      // Set caching headers (immutable content)
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('ETag', cid);
      
      res.send(contentBuffer);
    } catch (err: any) {
      console.error(`Error serving ${cid}:`, err);
      res.status(500).json({ error: err.message });
    }
  }

  private async handleHeadContent(req: Request, res: Response): Promise<void> {
    const { cid } = req.params;
    
    const metadata = await this.storage.getMetadata(cid);
    
    if (!metadata) {
      res.status(404).end();
      return;
    }

    res.setHeader('Content-Type', metadata.mimeType);
    res.setHeader('Content-Length', metadata.size.toString());
    res.setHeader('ETag', cid);
    res.status(200).end();
  }

  private async handleDelete(req: Request, res: Response): Promise<void> {
    const { cid } = req.params;
    
    try {
      await this.storage.delete(cid);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  private async handlePin(req: Request, res: Response): Promise<void> {
    const { cid } = req.params;
    
    try {
      await this.storage.pin(cid);
      res.json({ success: true, pinned: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  private async handleUnpin(req: Request, res: Response): Promise<void> {
    const { cid } = req.params;
    
    try {
      await this.storage.unpin(cid);
      res.json({ success: true, pinned: false });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  private async handleGetProof(req: Request, res: Response): Promise<void> {
    const { cid } = req.params;
    
    try {
      const proof = await this.storage.generateStorageProof(cid);
      res.json(proof);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  private async handleVerifyProof(req: Request, res: Response): Promise<void> {
    const proof = req.body;
    
    try {
      const valid = await this.storage.verifyStorageProof(proof);
      res.json({ valid });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  private async getStats() {
    const storageStats = await this.storage.getStats();
    const networkStats = this.network.getNetworkStats();

    return {
      storage: storageStats,
      network: networkStats,
      bandwidthUsed: this.bandwidthUsed,
      bandwidthGB: this.bandwidthUsed / (1024 * 1024 * 1024),
      requestCount: this.requestCount,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }
}

// Start node if run directly
if (import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href) {
  const config: NodeConfig = {
    port: parseInt(process.env.PORT || '3000'),
    dataDir: process.env.DATA_DIR || './data',
    network: {
      listenAddresses: [
        '/ip4/0.0.0.0/tcp/4001',
        '/ip4/0.0.0.0/tcp/4002/ws',
      ],
      bootstrapPeers: process.env.BOOTSTRAP_PEERS?.split(',') || [],
      enableMDNS: true,
      enableDHT: true,
      maxConnections: 100,
      port: 4001,
    },
    storage: {
      dataDir: process.env.DATA_DIR || './data',
      maxSizeGB: parseInt(process.env.MAX_STORAGE_GB || '100'),
      enableErasureCoding: process.env.ERASURE_CODING === 'true',
      dataShards: 10,
      parityShards: 4,
      deduplication: true,
    },
    operatorAddress: process.env.OPERATOR_ADDRESS,
    stakeAmount: parseInt(process.env.STAKE_AMOUNT || '0'),
  };

  const node = new CDNNode(config);
  
  node.start().catch((err) => {
    console.error('Failed to start node:', err);
    process.exit(1);
  });

  process.on('SIGINT', () => {
    console.log('\n👋 Shutting down gracefully...');
    process.exit(0);
  });
}
