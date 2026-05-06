import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * Single search hit — composite shape from the per-entity-type queries
 * in search.service. Cas B helper builds the array because each source
 * entity (asset/site/rack/task/contact) has a different Prisma select.
 */
export class SearchHitResponseDto {
  @ApiProperty({ description: 'asset | site | rack | task | contact' })
  @Expose()
  type!: string;

  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  title!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  subtitle?: string | null;

  @ApiProperty({ description: 'Frontend route to navigate to (e.g. /dashboard/assets/:id)' })
  @Expose()
  link!: string;
}

/**
 * Response for `GET /search`. Cas B — `byType` is a dynamic-key Record
 * (`{ asset: 3, site: 1, … }`) that does NOT roundtrip under
 * `excludeExtraneousValues:true`. Helper `toSearchResponseDto` builds
 * the carrier manually (cf README common/dto/response).
 */
export class SearchResponseDto {
  @ApiProperty({ type: () => [SearchHitResponseDto] })
  @Expose()
  hits!: SearchHitResponseDto[];

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'integer' },
    description: 'Per-type hit counts. Dynamic-key Record manually mapped.',
  })
  @Expose()
  byType!: Record<string, number>;
}

/**
 * Cas B helper — manual mapping for the `byType` Record (which class-
 * transformer drops under excludeExtraneousValues). The hits array is
 * shaped manually too so each hit gets the strict whitelist applied
 * regardless of what extra fields the underlying Prisma query may have
 * pulled in the future.
 */
export function toSearchResponseDto(input: {
  hits: Array<{ type: string; id: string; title: string; subtitle?: string; link: string }>;
  byType: Record<string, number>;
}): SearchResponseDto {
  return {
    hits: input.hits.map((h) => ({
      type: h.type,
      id: h.id,
      title: h.title,
      subtitle: h.subtitle ?? null,
      link: h.link,
    })),
    byType: { ...input.byType },
  };
}
