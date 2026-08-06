import { Component, computed, input, output, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePencil } from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { ColorPicker } from '../../../../shared/components/color-picker/color-picker';
import { LabelChip } from '../../../../shared/components/label-chip/label-chip';
import { UserAvatar } from '../../../../shared/components/user-avatar/user-avatar';
import { AssigneePicker } from '../../assignee-picker/assignee-picker';
import { LabelPicker } from '../../label-picker/label-picker';
import { TaskAssignees } from '../../task-assignees/task-assignees';
import type { Collaborator, Label } from '../../../../shared/types/board';

@Component({
  selector: 'app-task-metadata-sidebar',
  imports: [
    NgIcon,
    HlmButton,
    HlmFieldImports,
    LabelChip,
    ColorPicker,
    UserAvatar,
    LabelPicker,
    AssigneePicker,
    TaskAssignees,
  ],
  providers: [provideIcons({ lucidePencil })],
  template: `
    <div class="flex flex-col gap-5 sm:w-64">
      <div hlmField>
        <div class="flex items-center justify-between">
          <span hlmFieldLabel>Labels</span>
          <button
            hlmBtn
            variant="ghost"
            size="icon-sm"
            type="button"
            aria-label="Edit labels"
            (click)="toggleLabels()"
          >
            <ng-icon name="lucidePencil" />
          </button>
        </div>
        @if (labelsExpanded()) {
          <app-label-picker
            [boardId]="boardId()"
            [labels]="labels()"
            [selectedLabelIds]="selectedLabelIds()"
            (selectedLabelIdsChange)="selectedLabelIdsChange.emit($event)"
          />
        } @else if (selectedLabels().length > 0) {
          <div class="flex flex-wrap gap-1">
            @for (label of selectedLabels(); track label.id) {
              <app-label-chip [label]="label" />
            }
          </div>
        } @else {
          <p class="text-muted-foreground text-sm">No labels</p>
        }
      </div>

      <div class="flex flex-row gap-4">
        <div hlmField class="flex-1">
          <div class="flex items-center justify-between">
            <span hlmFieldLabel>Assignees</span>
            <button
              hlmBtn
              variant="ghost"
              size="icon-sm"
              type="button"
              aria-label="Edit assignees"
              (click)="toggleAssignees()"
            >
              <ng-icon name="lucidePencil" />
            </button>
          </div>
          @if (assigneesExpanded()) {
            <app-assignee-picker
              [collaborators]="collaborators()"
              [selectedUserIds]="assignedUserIds()"
              (selectedUserIdsChange)="assignedUserIdsChange.emit($event)"
            />
          } @else if (assignedUsers().length > 0) {
            <app-task-assignees [assignedUsers]="assignedUsers()" />
          } @else {
            <p class="text-muted-foreground text-sm">No assignees</p>
          }
        </div>

        <div hlmField class="flex-1">
          <span class="text-muted-foreground w-fit text-left text-sm font-medium"> Creator </span>
          @if (creator(); as creator) {
            <div class="flex items-center gap-2">
              <app-user-avatar [name]="creator.name" [photoURL]="creator.photoURL" size="small" />
              <button hlmBtn variant="outline" size="sm" type="button" (click)="handBack.emit()">
                Hand back
              </button>
            </div>
          } @else {
            <p class="text-muted-foreground text-sm">Unknown</p>
          }
        </div>
      </div>

      <div hlmField>
        <div class="flex items-center justify-between">
          <span hlmFieldLabel>Card color</span>
          @if (color()) {
            <button hlmBtn variant="ghost" size="sm" type="button" (click)="colorClear.emit()">
              Clear
            </button>
          }
        </div>
        <app-color-picker [value]="color() ?? ''" (valueChange)="colorChange.emit($event)" />
      </div>
    </div>
  `,
})
export class TaskMetadataSidebar {
  readonly boardId = input.required<string>();
  readonly labels = input<Label[]>([]);
  readonly selectedLabelIds = input<string[]>([]);
  readonly collaborators = input<Collaborator[]>([]);
  readonly assignedUserIds = input<string[]>([]);
  readonly creator = input<Collaborator | null>(null);
  readonly color = input<string | null | undefined>(undefined);

  readonly selectedLabelIdsChange = output<string[]>();
  readonly assignedUserIdsChange = output<string[]>();
  readonly handBack = output<void>();
  readonly colorChange = output<string>();
  readonly colorClear = output<void>();

  protected readonly labelsExpanded = signal(false);
  protected readonly assigneesExpanded = signal(false);

  protected readonly selectedLabels = computed(() => {
    const ids = new Set(this.selectedLabelIds());
    return this.labels().filter((label) => ids.has(label.id));
  });

  protected readonly assignedUsers = computed(() => {
    const ids = new Set(this.assignedUserIds());
    return this.collaborators().filter((c) => ids.has(c.id));
  });

  protected toggleLabels(): void {
    this.labelsExpanded.update((expanded) => !expanded);
  }

  protected toggleAssignees(): void {
    this.assigneesExpanded.update((expanded) => !expanded);
  }
}
