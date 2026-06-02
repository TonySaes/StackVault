import type { ResourceFilters } from '../../features/resources/filter-resources';
import './ResourceFilterBar.css';

export interface ResourceFilterOption {
  label: string;
  value: string;
}

interface ResourceFilterBarProps {
  filters: ResourceFilters;
  technologyOptions: ResourceFilterOption[];
  categoryOptions: ResourceFilterOption[];
  hasActiveFilters: boolean;
  onSearchQueryChange: (searchQuery: string) => void;
  onTechnologyChange: (technologySlug: string) => void;
  onCategoryChange: (categorySlug: string) => void;
  onResetFilters: () => void;
}

export function ResourceFilterBar({
  filters,
  technologyOptions,
  categoryOptions,
  hasActiveFilters,
  onSearchQueryChange,
  onTechnologyChange,
  onCategoryChange,
  onResetFilters,
}: ResourceFilterBarProps) {
  return (
    <div className="resource-filter-bar" aria-label="Recherche et filtres">
      <div className="resource-filter-grid">
        <div className="resource-filter-field">
          <label htmlFor="resource-search">Recherche</label>
          <input
            id="resource-search"
            type="search"
            value={filters.searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Titre ou resume"
          />
        </div>

        <div className="resource-filter-field">
          <label htmlFor="resource-technology-filter">Technologie</label>
          <select
            id="resource-technology-filter"
            value={filters.technologySlug}
            onChange={(event) => onTechnologyChange(event.target.value)}
          >
            <option value="">Toutes les technologies</option>
            {technologyOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="resource-filter-field">
          <label htmlFor="resource-category-filter">Categorie</label>
          <select
            id="resource-category-filter"
            value={filters.categorySlug}
            onChange={(event) => onCategoryChange(event.target.value)}
          >
            <option value="">Toutes les categories</option>
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {hasActiveFilters ? (
        <div className="resource-filter-summary">
          <span>Filtres actifs</span>
          <button
            className="resource-filter-reset"
            type="button"
            onClick={onResetFilters}
          >
            Reinitialiser
          </button>
        </div>
      ) : null}
    </div>
  );
}
