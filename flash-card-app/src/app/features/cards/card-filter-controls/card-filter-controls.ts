import { Component, input, model } from '@angular/core';
import { CardFilters } from '../../../shared/helpers/card-filters';

@Component({
  selector: 'app-card-filter-controls',
  templateUrl: './card-filter-controls.html',
  styleUrl: './card-filter-controls.less',
})
export class CardFilterControls {
  readonly filters = model.required<CardFilters>();
  readonly reportedCount = input.required<number>();

  setReportedFilter(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.filters.set({
      ...this.filters(),
      reported: value === 'reported' ? true : null,
    });
  }
}
