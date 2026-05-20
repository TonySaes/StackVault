import { Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';

type DatabaseHealth =
  | {
      status: 'ok';
    }
  | {
      status: 'unavailable';
      detail: string;
    };

export interface HealthResponse {
  status: 'ok' | 'degraded';
  service: 'stackvault-api';
  database: DatabaseHealth;
}

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealth(): Promise<HealthResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        status: 'ok',
        service: 'stackvault-api',
        database: {
          status: 'ok',
        },
      };
    } catch {
      return {
        status: 'degraded',
        service: 'stackvault-api',
        database: {
          status: 'unavailable',
          detail: 'Database connection failed',
        },
      };
    }
  }
}
