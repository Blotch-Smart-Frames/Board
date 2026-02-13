import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskDialog } from "./TaskDialog";
import type { Task } from "../../types/board";
import { Timestamp } from "firebase/firestore";

// Mock the LabelPicker component to avoid Firestore dependencies
vi.mock("./LabelPicker", () => ({
  LabelPicker: () => <div data-testid="label-picker">Labels</div>,
}));

// Mock the SprintPicker component to avoid Firestore dependencies
vi.mock("../sprints", () => ({
  SprintPicker: () => <div data-testid="sprint-picker">Sprint</div>,
}));

// Mock the date pickers to simplify testing
vi.mock("@mui/x-date-pickers/DatePicker", () => ({
  DatePicker: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: Date | null;
    onChange: (date: Date | null) => void;
  }) => (
    <input
      aria-label={label}
      type="date"
      value={value ? value.toISOString().split("T")[0] : ""}
      onChange={(e) =>
        onChange(e.target.value ? new Date(e.target.value) : null)
      }
    />
  ),
}));

vi.mock("@mui/x-date-pickers/LocalizationProvider", () => ({
  LocalizationProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

vi.mock("@mui/x-date-pickers/AdapterDateFns", () => ({
  AdapterDateFns: vi.fn(),
}));

const createMockTask = (overrides: Partial<Task> = {}): Task => ({
  id: "task-1",
  listId: "list-1",
  title: "Test Task",
  description: "Test description",
  order: "a0",
  calendarSyncEnabled: false,
  createdBy: "user-1",
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
  ...overrides,
});

describe("TaskDialog", () => {
  const defaultProps = {
    open: true,
    boardId: "board-1",
    onClose: vi.fn(),
    onSave: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Create Mode", () => {
    it("opens in create mode with empty fields", () => {
      render(<TaskDialog {...defaultProps} />);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText(/create task/i)).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: /title/i })).toHaveValue("");
      expect(screen.getByRole("textbox", { name: /description/i })).toHaveValue("");
    });

    it("shows Create button in create mode", () => {
      render(<TaskDialog {...defaultProps} />);

      expect(screen.getByRole("button", { name: /create/i })).toBeInTheDocument();
    });

    it("does not show Delete button in create mode", () => {
      render(<TaskDialog {...defaultProps} />);

      expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
    });
  });

  describe("Edit Mode", () => {
    it("opens in edit mode with task data", () => {
      const task = createMockTask();
      render(<TaskDialog {...defaultProps} task={task} />);

      expect(screen.getByText(/edit task/i)).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: /title/i })).toHaveValue("Test Task");
      expect(screen.getByRole("textbox", { name: /description/i })).toHaveValue("Test description");
    });

    it("shows Save button in edit mode", () => {
      const task = createMockTask();
      render(<TaskDialog {...defaultProps} task={task} />);

      expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
    });

    it("shows Delete button in edit mode when onDelete provided", () => {
      const task = createMockTask();
      const onDelete = vi.fn();
      render(<TaskDialog {...defaultProps} task={task} onDelete={onDelete} />);

      expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
    });
  });

  describe("Form Validation", () => {
    it("disables submit button when title is empty", () => {
      render(<TaskDialog {...defaultProps} />);

      expect(screen.getByRole("button", { name: /create/i })).toBeDisabled();
    });

    it("enables submit button when title is provided", async () => {
      const user = userEvent.setup();
      render(<TaskDialog {...defaultProps} />);

      await user.type(screen.getByRole("textbox", { name: /title/i }), "New Task");

      expect(screen.getByRole("button", { name: /create/i })).not.toBeDisabled();
    });

    it("does not submit with whitespace-only title", async () => {
      const user = userEvent.setup();
      render(<TaskDialog {...defaultProps} />);

      await user.type(screen.getByRole("textbox", { name: /title/i }), "   ");

      expect(screen.getByRole("button", { name: /create/i })).toBeDisabled();
    });
  });

  describe("Form Submission", () => {
    it("saves task on submit", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      render(<TaskDialog {...defaultProps} onSave={onSave} />);

      await user.type(screen.getByRole("textbox", { name: /title/i }), "New Task");
      await user.type(screen.getByRole("textbox", { name: /description/i }), "New Description");
      await user.click(screen.getByRole("button", { name: /create/i }));

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "New Task",
          description: "New Description",
        })
      );
    });

    it("closes dialog on submit", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<TaskDialog {...defaultProps} onClose={onClose} />);

      await user.type(screen.getByRole("textbox", { name: /title/i }), "New Task");
      await user.click(screen.getByRole("button", { name: /create/i }));

      expect(onClose).toHaveBeenCalled();
    });

    it("trims whitespace from title", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      render(<TaskDialog {...defaultProps} onSave={onSave} />);

      await user.type(screen.getByRole("textbox", { name: /title/i }), "  Trimmed Title  ");
      await user.click(screen.getByRole("button", { name: /create/i }));

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Trimmed Title",
        })
      );
    });
  });

  describe("Delete", () => {
    it("calls onDelete when delete button clicked", async () => {
      const user = userEvent.setup();
      const task = createMockTask();
      const onDelete = vi.fn();
      render(<TaskDialog {...defaultProps} task={task} onDelete={onDelete} />);

      await user.click(screen.getByRole("button", { name: /delete/i }));

      expect(onDelete).toHaveBeenCalled();
    });

    it("closes dialog after delete", async () => {
      const user = userEvent.setup();
      const task = createMockTask();
      const onClose = vi.fn();
      const onDelete = vi.fn();
      render(<TaskDialog {...defaultProps} task={task} onClose={onClose} onDelete={onDelete} />);

      await user.click(screen.getByRole("button", { name: /delete/i }));

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe("Cancel", () => {
    it("closes on cancel button click", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<TaskDialog {...defaultProps} onClose={onClose} />);

      await user.click(screen.getByRole("button", { name: /cancel/i }));

      expect(onClose).toHaveBeenCalled();
    });

    it("closes on close icon button click", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<TaskDialog {...defaultProps} onClose={onClose} />);

      // Find the close icon button in the dialog title
      const closeButton = screen.getAllByRole("button").find(
        (btn) => btn.querySelector('svg[data-testid="CloseIcon"]')
      );

      if (closeButton) {
        await user.click(closeButton);
        expect(onClose).toHaveBeenCalled();
      }
    });
  });

  describe("Calendar Sync", () => {
    it("shows calendar sync toggle", () => {
      render(<TaskDialog {...defaultProps} />);

      expect(screen.getByRole("checkbox", { name: /sync with google calendar/i })).toBeInTheDocument();
    });

    it("disables calendar sync toggle when no due date", () => {
      render(<TaskDialog {...defaultProps} />);

      expect(screen.getByRole("checkbox", { name: /sync with google calendar/i })).toBeDisabled();
    });
  });

  describe("Dialog State", () => {
    it("does not render when open is false", () => {
      render(<TaskDialog {...defaultProps} open={false} />);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("resets form when task changes", async () => {
      const task1 = createMockTask({ id: "1", title: "Task 1" });
      const task2 = createMockTask({ id: "2", title: "Task 2" });

      const { rerender } = render(<TaskDialog {...defaultProps} task={task1} />);
      expect(screen.getByRole("textbox", { name: /title/i })).toHaveValue("Task 1");

      rerender(<TaskDialog {...defaultProps} task={task2} />);
      expect(screen.getByRole("textbox", { name: /title/i })).toHaveValue("Task 2");
    });
  });
});
