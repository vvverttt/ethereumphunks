import { Logger } from '@nestjs/common';

import { Server, Socket } from 'socket.io';
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';

import { CustomLogger } from '@/modules/shared/services/logger.service';
import { StorageService } from '@/modules/storage/storage.service';

import { chain } from '@/constants/ethereum';
import { ACCOUNTS_MIN_GAP_MS, parseAccounts } from '@/rpc.limits';

@WebSocketGateway({
  cors: {
    origin: (origin, callback) => {
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];
      callback(null, allowedOrigins.includes(origin) ? origin : false);
    },
    methods: ['GET']
  }
})
export class AppGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {

  @WebSocketServer() server: Server;

  private lastAccounts = new Map<string, number>();

  constructor(
    private readonly logger: CustomLogger,
    private readonly storageService: StorageService
  ) {}

  afterInit(server: Server) {
    Logger.debug('Socket Server Initialized', 'AppGateway');

    if (!this.server) return;

    this.logger.singleLog$.subscribe((logItem) => {
      if (logItem) this.server.emit(`log_${chain}`, logItem);
    });

    this.logger.logCollection$.subscribe((logItems) => {
      if (logItems?.length) this.server.emit(`logs_${chain}`, logItems);
    });
  }

  handleConnection(client: Socket, ...args: any[]) {
    Logger.verbose(client.id, 'Client connected');
    client.emit(`logs_${chain}`, this.logger.getLogs());
  }

  handleDisconnect(client: Socket, ...args: any[]) {
    this.lastAccounts.delete(client.id);
    Logger.verbose(client.id, 'Client disconnected');
  }

  @SubscribeMessage('message')
  handleMessage(
    @MessageBody() data: { id: string, message: string },
    @ConnectedSocket() client: Socket
  ) {
    if (data?.id !== 'accounts') return;

    // one write every couple of seconds per socket, and only a short list of wallet addresses
    const now = Date.now();
    if (now - (this.lastAccounts.get(client.id) ?? 0) < ACCOUNTS_MIN_GAP_MS) return;
    this.lastAccounts.set(client.id, now);

    const accounts = parseAccounts(data.message);
    if (accounts) this.storageService.setConnectedAccounts(accounts);
  }
}
