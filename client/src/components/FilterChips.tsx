import { FC } from 'react';

type Condition = 'All' | 'Critical' | 'Warning' | 'Good';

const CONDITION_LABELS: Record<Condition, string> = {
  All: 'Todos',
  Critical: 'Crítico',
  Warning: 'Atenção',
  Good: 'Saudável',
};

interface FilterChipsProps {
  selected: Condition;
  onChange: (c: Condition) => void;
}

const FilterChips: FC<FilterChipsProps> = ({ selected, onChange }) => (
  <div className="filter-chips">
    {(Object.keys(CONDITION_LABELS) as Condition[]).map(c => (
      <button
        key={c}
        className={`badge ${selected === c ? 'active-chip' : 'inactive-chip'}`}
        onClick={() => onChange(c)}
      >
        {CONDITION_LABELS[c]}
      </button>
    ))}
  </div>
);

export default FilterChips;
