import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { List } from "./List";
import type { List as ListType, Task as TaskType } from "../../types/board";
import { Timestamp } from "firebase/firestore";

// Mock DnD Kit
vi.mock("@dnd-kit/core", () => ({
  useDroppable: () => ({
    setNodeRef: vi.fn(),
    isOver: false,
  }),
}));

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => children,
  verticalListSortingStrategy: {},
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: {
    Transform: {
      toString: () => null,
    },
  },
}));

const createMockList = (overrides: Partial<ListType> = {}): ListType => ({
  id: "list-1",
  title: "Test List",
  order: "a0",
  createdAt: Timestamp.now(),
  ...overrides,
});

const createMockTask = (overrides: Partial<TaskType> = {}): TaskType => ({
  id: "task-1",
  listId: "list-1",
  title: "Test Task",
  order: "a0",
  calendarSyncEnabled: false,
  createdBy: "user-1",
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
  ...overrides,
});

describe("List", () => {
  const defaultProps = {
    list: createMockList(),
    tasks: [],
    onUpdateTitle: vi.fn(),
    onDelete: vi.fn(),
    onAddTask: vi.fn(),
    onEditTask: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders list with header", () => {
    render(<List {...defaultProps} />);

    expect(screen.getByRole("heading", { name: "Test List" })).toBeInTheDocument();
  });

  it("renders all tasks", () => {
    const tasks = [
      createMockTask({ id: "1", title: "Task 1" }),
      createMockTask({ id: "2", title: "Task 2" }),
      createMockTask({ id: "3", title: "Task 3" }),
    ];

    render(<List {...defaultProps} tasks={tasks} />);

    expect(screen.getByText("Task 1")).toBeInTheDocument();
    expect(screen.getByText("Task 2")).toBeInTheDocument();
    expect(screen.getByText("Task 3")).toBeInTheDocument();
  });

  it("shows task count in header", () => {
    const tasks = [
      createMockTask({ id: "1", title: "Task 1" }),
      createMockTask({ id: "2", title: "Task 2" }),
    ];

    render(<List {...defaultProps} tasks={tasks} />);

    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows empty state when no tasks", () => {
    render(<List {...defaultProps} tasks={[]} />);

    expect(screen.getByText("No tasks yet")).toBeInTheDocument();
  });

  describe("Add task", () => {
    it("shows add task button", () => {
      render(<List {...defaultProps} />);

      expect(screen.getByRole("button", { name: /add a task/i })).toBeInTheDocument();
    });

    it("reveals input form on add button click", async () => {
      const user = userEvent.setup();
      render(<List {...defaultProps} />);

      await user.click(screen.getByRole("button", { name: /add a task/i }));

      expect(screen.getByPlaceholderText("Enter task title...")).toBeInTheDocument();
    });

    it("creates task on form submit", async () => {
      const user = userEvent.setup();
      const onAddTask = vi.fn();
      render(<List {...defaultProps} onAddTask={onAddTask} />);

      await user.click(screen.getByRole("button", { name: /add a task/i }));
      await user.type(screen.getByPlaceholderText("Enter task title..."), "New Task");
      await user.click(screen.getByRole("button", { name: /^add$/i }));

      expect(onAddTask).toHaveBeenCalledWith({ title: "New Task" });
    });

    it("creates task on Enter key", async () => {
      const user = userEvent.setup();
      const onAddTask = vi.fn();
      render(<List {...defaultProps} onAddTask={onAddTask} />);

      await user.click(screen.getByRole("button", { name: /add a task/i }));
      await user.type(screen.getByPlaceholderText("Enter task title..."), "New Task{Enter}");

      expect(onAddTask).toHaveBeenCalledWith({ title: "New Task" });
    });

    it("cancels on Escape key", async () => {
      const user = userEvent.setup();
      const onAddTask = vi.fn();
      render(<List {...defaultProps} onAddTask={onAddTask} />);

      await user.click(screen.getByRole("button", { name: /add a task/i }));
      await user.type(screen.getByPlaceholderText("Enter task title..."), "Unfinished{Escape}");

      // Should return to button state
      expect(screen.getByRole("button", { name: /add a task/i })).toBeInTheDocument();
      expect(onAddTask).not.toHaveBeenCalled();
    });

    it("cancels on Cancel button click", async () => {
      const user = userEvent.setup();
      const onAddTask = vi.fn();
      render(<List {...defaultProps} onAddTask={onAddTask} />);

      await user.click(screen.getByRole("button", { name: /add a task/i }));
      await user.type(screen.getByPlaceholderText("Enter task title..."), "Unfinished");
      await user.click(screen.getByRole("button", { name: /cancel/i }));

      expect(screen.getByRole("button", { name: /add a task/i })).toBeInTheDocument();
      expect(onAddTask).not.toHaveBeenCalled();
    });

    it("disables Add button when input empty", async () => {
      const user = userEvent.setup();
      render(<List {...defaultProps} />);

      await user.click(screen.getByRole("button", { name: /add a task/i }));

      expect(screen.getByRole("button", { name: /^add$/i })).toBeDisabled();
    });

    it("clears input after submission", async () => {
      const user = userEvent.setup();
      const onAddTask = vi.fn();
      render(<List {...defaultProps} onAddTask={onAddTask} />);

      await user.click(screen.getByRole("button", { name: /add a task/i }));
      await user.type(screen.getByPlaceholderText("Enter task title..."), "New Task{Enter}");

      // Form should close and button should be visible
      expect(screen.getByRole("button", { name: /add a task/i })).toBeInTheDocument();
    });

    it("trims whitespace from task title", async () => {
      const user = userEvent.setup();
      const onAddTask = vi.fn();
      render(<List {...defaultProps} onAddTask={onAddTask} />);

      await user.click(screen.getByRole("button", { name: /add a task/i }));
      await user.type(screen.getByPlaceholderText("Enter task title..."), "  Trimmed  {Enter}");

      expect(onAddTask).toHaveBeenCalledWith({ title: "Trimmed" });
    });

    it("does not submit with empty or whitespace title", async () => {
      const user = userEvent.setup();
      const onAddTask = vi.fn();
      render(<List {...defaultProps} onAddTask={onAddTask} />);

      await user.click(screen.getByRole("button", { name: /add a task/i }));
      await user.type(screen.getByPlaceholderText("Enter task title..."), "   {Enter}");

      expect(onAddTask).not.toHaveBeenCalled();
    });
  });

  describe("Header interactions", () => {
    it("updates title through header", async () => {
      const user = userEvent.setup();
      const onUpdateTitle = vi.fn();
      render(<List {...defaultProps} onUpdateTitle={onUpdateTitle} />);

      await user.click(screen.getByRole("heading", { name: "Test List" }));
      await user.clear(screen.getByRole("textbox"));
      await user.type(screen.getByRole("textbox"), "New Title{Enter}");

      expect(onUpdateTitle).toHaveBeenCalledWith("New Title");
    });

    it("deletes list through header menu", async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn();
      render(<List {...defaultProps} onDelete={onDelete} />);

      // Open menu
      const menuButton = screen.getAllByRole("button")[0];
      await user.click(menuButton);

      // Click delete
      await user.click(screen.getByRole("menuitem", { name: /delete list/i }));

      expect(onDelete).toHaveBeenCalled();
    });
  });

  describe("Task editing", () => {
    it("calls onEditTask when task edit clicked", async () => {
      const user = userEvent.setup();
      const task = createMockTask({ id: "1", title: "Task 1" });
      const onEditTask = vi.fn();
      render(<List {...defaultProps} tasks={[task]} onEditTask={onEditTask} />);

      // Find and click edit button on task
      const editButton = screen.getByTestId("EditIcon").closest("button");
      if (editButton) {
        await user.click(editButton);
        expect(onEditTask).toHaveBeenCalledWith(task);
      }
    });
  });

  describe("Drop zone", () => {
    it("renders as a droppable area", () => {
      const { container } = render(<List {...defaultProps} />);

      // The list container should exist
      expect(container.querySelector(".MuiPaper-root")).toBeInTheDocument();
    });
  });
});
