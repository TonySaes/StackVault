import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const DEFAULT_RESOURCES_PAGE = 1;
export const DEFAULT_RESOURCES_PAGE_SIZE = 20;
export const MAX_RESOURCES_PAGE_SIZE = 50;

export class ListResourcesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = DEFAULT_RESOURCES_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_RESOURCES_PAGE_SIZE)
  pageSize = DEFAULT_RESOURCES_PAGE_SIZE;
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  const parsedValue = Number(value ?? fallback);

  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    return fallback;
  }

  return parsedValue;
}

export function normalizeListResourcesQuery(query: ListResourcesQueryDto) {
  const page = normalizePositiveInteger(query.page, DEFAULT_RESOURCES_PAGE);
  const requestedPageSize = normalizePositiveInteger(
    query.pageSize,
    DEFAULT_RESOURCES_PAGE_SIZE,
  );

  return {
    page,
    pageSize: Math.min(requestedPageSize, MAX_RESOURCES_PAGE_SIZE),
  };
}
