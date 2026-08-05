import { Component, computed, input, output } from '@angular/core';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { UserAvatar } from '../../../shared/components/user-avatar/user-avatar';
import type { Collaborator } from '../../../shared/types/board';

@Component({
  selector: 'app-assignee-filter',
  imports: [HlmSelectImports, UserAvatar],
  template: `
    <hlm-select-multiple [value]="selectedAssigneeIds()" (valueChange)="onValueChange($event)">
      <hlm-select-trigger class="min-w-40">
        <hlm-select-placeholder>Filter by assignee</hlm-select-placeholder>
        <ng-template hlmSelectValues let-values>
          <hlm-select-values-content class="items-center">
            <!-- /* v8 ignore start -- defensive @if branch: only fires when the selected id is missing from collaborators() @preserve */ -->
            @if (byId()[values[0]]; as first) {
              <span class="flex items-center gap-1.5">
                <app-user-avatar
                  [name]="first.name"
                  [photoURL]="first.photoURL"
                  size="small"
                  [showTooltip]="false"
                />
                {{ first.name }}
              </span>
            }
            <!-- /* v8 ignore stop -- @preserve */ -->
            @if (values.length > 1) {
              <span class="text-muted-foreground text-xs"> (+{{ values.length - 1 }} more) </span>
            }
          </hlm-select-values-content>
        </ng-template>
      </hlm-select-trigger>
      <hlm-select-content *hlmSelectPortal class="w-64">
        @if (collaborators().length === 0) {
          <p class="text-muted-foreground p-2 text-sm">No collaborators</p>
        }
        <hlm-select-group>
          @for (collaborator of collaborators(); track collaborator.id) {
            <hlm-select-item [value]="collaborator.id" class="gap-1.5">
              <app-user-avatar
                [name]="collaborator.name"
                [photoURL]="collaborator.photoURL"
                size="small"
                [showTooltip]="false"
              />
              {{ collaborator.name }}
            </hlm-select-item>
          }
        </hlm-select-group>
      </hlm-select-content>
    </hlm-select-multiple>
  `,
})
export class AssigneeFilter {
  readonly collaborators = input.required<Collaborator[]>();
  readonly selectedAssigneeIds = input<string[]>([]);
  readonly selectedAssigneeIdsChange = output<string[]>();

  protected readonly byId = computed(() =>
    Object.fromEntries(this.collaborators().map((c) => [c.id, c] as const)),
  );

  protected onValueChange(value: unknown): void {
    if (!Array.isArray(value)) return;
    this.selectedAssigneeIdsChange.emit(value.filter((v): v is string => typeof v === 'string'));
  }
}
