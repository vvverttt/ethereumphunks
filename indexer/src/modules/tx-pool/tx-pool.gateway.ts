import { OnModuleInit } from '@nestjs/common';

import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { OnEvent } from '@nestjs/event-emitter';

import { Server } from 'socket.io';

import { TxPoolService, TxPoolState } from './tx-pool.service';

@WebSocketGateway({
  cors: {
    origin: (origin, callback) => {
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];
      callback(null, allowedOrigins.includes(origin) ? origin : false);
    },
    methods: ['GET']
  },
})
export class TxPoolGateway implements OnModuleInit {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly txPoolService: TxPoolService,
  ) {}

  onModuleInit() {
    this.server.on('connection', (socket) => {
      // console.log('Client connected:', socket.id);

      const currentState = this.txPoolService.getCurrentState();
      const pendingShas = Object.fromEntries(currentState.pendingInscriptionShas);
      socket.emit('pendingInscriptionShas', pendingShas);

      socket.on('disconnect', () => {
        // console.log('Client disconnected:', socket.id);
      });
    });
  }

  @OnEvent('txpool.update')
  handleTxPoolUpdate(state: TxPoolState) {
    // Convert Map to Object for serialization
    const pendingShas = Object.fromEntries(state.pendingInscriptionShas);
    this.server.emit('pendingInscriptionShas', pendingShas);
  }
}
