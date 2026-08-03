import { Component, input } from '@angular/core';
import type { TimelineRow as TimelineRowData } from '../data/timeline-data';

@Component({
  selector: 'app-timeline-row',
  host: {
    class: 'relative block border-b border-border',
    '[style.height.px]': '48',
    '[attr.data-row-id]': 'row().id',
  },
  template: `<ng-content />`,
})
export class TimelineRow {
  readonly row = input.required<TimelineRowData>();
}
