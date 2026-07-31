import { Component, input, output } from '@angular/core';
import { HlmToggleGroupImports } from '@spartan-ng/helm/toggle-group';
import { UserAvatar } from '../../../shared/components/user-avatar/user-avatar';
import type { Collaborator } from '../../../shared/types/board';

const ALL_VALUE = '__all__';

@Component({
  selector: 'app-assignee-filter',
  imports: [HlmToggleGroupImports, UserAvatar],
  template: `
    <div
      hlmToggleGroup
      type="single"
      class="flex-wrap justify-start"
      [value]="value()"
      (valueChange)="onValueChange($event)"
    >
      <button hlmToggleGroupItem [value]="allValue">All</button>
      @for (collaborator of collaborators(); track collaborator.id) {
        <button hlmToggleGroupItem [value]="collaborator.id" class="gap-1.5">
          <app-user-avatar
            [name]="collaborator.name"
            [photoURL]="collaborator.photoURL"
            size="small"
            [showTooltip]="false"
          />
          {{ collaborator.name }}
        </button>
      }
    </div>
  `,
})
export class AssigneeFilter {
  readonly collaborators = input.required<Collaborator[]>();
  readonly selectedAssigneeId = input<string | null>(null);
  readonly selectedAssigneeIdChange = output<string | null>();

  protected readonly allValue = ALL_VALUE;

  protected readonly value = () => this.selectedAssigneeId() ?? ALL_VALUE;

  protected onValueChange(value: unknown): void {
    if (typeof value !== 'string' || value === '') return;
    this.selectedAssigneeIdChange.emit(value === ALL_VALUE ? null : value);
  }
}
