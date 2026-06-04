import { assert, describe, it } from 'vitest';

import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import {
  ListResourcesQueryDto,
  MAX_RESOURCES_PAGE_SIZE,
  normalizeListResourcesQuery,
} from './list-resources-query.dto.js';

describe('ListResourcesQueryDto', () => {
  it('accepts oversized pageSize values so the service can clamp them', async () => {
    const query = plainToInstance(ListResourcesQueryDto, {
      page: '1',
      pageSize: '999',
    });

    const validationErrors = await validate(query);
    const normalizedQuery = normalizeListResourcesQuery(query);

    assert.strictEqual(validationErrors.length, 0);
    assert.strictEqual(normalizedQuery.pageSize, MAX_RESOURCES_PAGE_SIZE);
  });
});
