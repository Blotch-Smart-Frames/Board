import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BoardList } from "./BoardList";
import type { Board } from "../../types/board";
import { Timestamp } from "firebase/firestore";

const createMockBoard = (overrides: Partial<Board> = {}): Board => ({
  id: "board-1",
  title: "Test Board",
  ownerId: "user-1",
  collaborators: [],
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
  ...overrides,
});

describe("BoardList", () => {
  const defaultProps = {
    boards: [],
    selectedBoardId: null,
    isLoading: false,
    onSelectBoard: vi.fn(),
    onCreateBoard: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 'My Boards' header", () => {
    render(<BoardList {...defaultProps} />);

    expect(screen.getByText("My Boards")).toBeInTheDocument();
  });

  it("shows loading spinner when loading", () => {
    render(<BoardList {...defaultProps} isLoading />);

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("renders list of boards", () => {
    const boards = [
      createMockBoard({ id: "1", title: "Board One" }),
      createMockBoard({ id: "2", title: "Board Two" }),
      createMockBoard({ id: "3", title: "Board Three" }),
    ];

    render(<BoardList {...defaultProps} boards={boards} />);

    expect(screen.getByText("Board One")).toBeInTheDocument();
    expect(screen.getByText("Board Two")).toBeInTheDocument();
    expect(screen.getByText("Board Three")).toBeInTheDocument();
  });

  it("shows empty state when no boards", () => {
    render(<BoardList {...defaultProps} boards={[]} />);

    expect(screen.getByText("No boards yet")).toBeInTheDocument();
    expect(screen.getByText("Create your first board to get started")).toBeInTheDocument();
  });

  it("highlights selected board", () => {
    const boards = [
      createMockBoard({ id: "1", title: "Board One" }),
      createMockBoard({ id: "2", title: "Board Two" }),
    ];

    render(<BoardList {...defaultProps} boards={boards} selectedBoardId="2" />);

    const selectedItem = screen.getByText("Board Two").closest('[role="button"]');
    expect(selectedItem).toHaveClass("Mui-selected");
  });

  it("calls onSelectBoard when board clicked", async () => {
    const user = userEvent.setup();
    const onSelectBoard = vi.fn();
    const boards = [createMockBoard({ id: "1", title: "Board One" })];

    render(<BoardList {...defaultProps} boards={boards} onSelectBoard={onSelectBoard} />);

    await user.click(screen.getByText("Board One"));

    expect(onSelectBoard).toHaveBeenCalledWith("1");
  });

  describe("Create board", () => {
    it("has Create board button", () => {
      render(<BoardList {...defaultProps} />);

      expect(screen.getByRole("button", { name: /create board/i })).toBeInTheDocument();
    });

    it("opens dialog on Create board click", async () => {
      const user = userEvent.setup();
      render(<BoardList {...defaultProps} />);

      await user.click(screen.getByRole("button", { name: /create board/i }));

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Create new board")).toBeInTheDocument();
    });

    it("creates board on form submit", async () => {
      const user = userEvent.setup();
      const onCreateBoard = vi.fn().mockResolvedValue(undefined);
      render(<BoardList {...defaultProps} onCreateBoard={onCreateBoard} />);

      await user.click(screen.getByRole("button", { name: /create board/i }));
      await user.type(screen.getByPlaceholderText("Enter board title"), "New Board");
      await user.click(screen.getByRole("button", { name: /^create$/i }));

      expect(onCreateBoard).toHaveBeenCalledWith("New Board");
    });

    it("creates board on Enter key", async () => {
      const user = userEvent.setup();
      const onCreateBoard = vi.fn().mockResolvedValue(undefined);
      render(<BoardList {...defaultProps} onCreateBoard={onCreateBoard} />);

      await user.click(screen.getByRole("button", { name: /create board/i }));
      await user.type(screen.getByPlaceholderText("Enter board title"), "New Board{Enter}");

      expect(onCreateBoard).toHaveBeenCalledWith("New Board");
    });

    it("closes dialog after successful creation", async () => {
      const user = userEvent.setup();
      const onCreateBoard = vi.fn().mockResolvedValue(undefined);
      render(<BoardList {...defaultProps} onCreateBoard={onCreateBoard} />);

      await user.click(screen.getByRole("button", { name: /create board/i }));
      await user.type(screen.getByPlaceholderText("Enter board title"), "New Board{Enter}");

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });

    it("closes dialog on cancel", async () => {
      const user = userEvent.setup();
      render(<BoardList {...defaultProps} />);

      await user.click(screen.getByRole("button", { name: /create board/i }));
      await user.click(screen.getByRole("button", { name: /cancel/i }));

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });

    it("closes dialog on Escape key", async () => {
      const user = userEvent.setup();
      render(<BoardList {...defaultProps} />);

      await user.click(screen.getByRole("button", { name: /create board/i }));
      await user.type(screen.getByPlaceholderText("Enter board title"), "Test{Escape}");

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });

    it("disables Create button when title empty", async () => {
      const user = userEvent.setup();
      render(<BoardList {...defaultProps} />);

      await user.click(screen.getByRole("button", { name: /create board/i }));

      expect(screen.getByRole("button", { name: /^create$/i })).toBeDisabled();
    });

    it("trims whitespace from title", async () => {
      const user = userEvent.setup();
      const onCreateBoard = vi.fn().mockResolvedValue(undefined);
      render(<BoardList {...defaultProps} onCreateBoard={onCreateBoard} />);

      await user.click(screen.getByRole("button", { name: /create board/i }));
      await user.type(screen.getByPlaceholderText("Enter board title"), "  Trimmed  {Enter}");

      expect(onCreateBoard).toHaveBeenCalledWith("Trimmed");
    });
  });

  describe("Board context menu", () => {
    it("opens menu on more button click", async () => {
      const user = userEvent.setup();
      const boards = [createMockBoard({ id: "1", title: "Board One" })];
      const onDeleteBoard = vi.fn();

      render(<BoardList {...defaultProps} boards={boards} onDeleteBoard={onDeleteBoard} />);

      // Find the more button
      const moreButton = screen.getByTestId("MoreVertIcon").closest("button");
      if (moreButton) {
        await user.click(moreButton);
        expect(screen.getByRole("menu")).toBeInTheDocument();
      }
    });

    it("shows Delete option when onDeleteBoard provided", async () => {
      const user = userEvent.setup();
      const boards = [createMockBoard({ id: "1", title: "Board One" })];
      const onDeleteBoard = vi.fn();

      render(<BoardList {...defaultProps} boards={boards} onDeleteBoard={onDeleteBoard} />);

      const moreButton = screen.getByTestId("MoreVertIcon").closest("button");
      if (moreButton) {
        await user.click(moreButton);
        expect(screen.getByRole("menuitem", { name: /delete/i })).toBeInTheDocument();
      }
    });

    it("shows Rename option when onRenameBoard provided", async () => {
      const user = userEvent.setup();
      const boards = [createMockBoard({ id: "1", title: "Board One" })];
      const onRenameBoard = vi.fn();

      render(<BoardList {...defaultProps} boards={boards} onRenameBoard={onRenameBoard} />);

      const moreButton = screen.getByTestId("MoreVertIcon").closest("button");
      if (moreButton) {
        await user.click(moreButton);
        expect(screen.getByRole("menuitem", { name: /rename/i })).toBeInTheDocument();
      }
    });

    it("calls onDeleteBoard when Delete clicked", async () => {
      const user = userEvent.setup();
      const boards = [createMockBoard({ id: "1", title: "Board One" })];
      const onDeleteBoard = vi.fn().mockResolvedValue(undefined);

      render(<BoardList {...defaultProps} boards={boards} onDeleteBoard={onDeleteBoard} />);

      const moreButton = screen.getByTestId("MoreVertIcon").closest("button");
      if (moreButton) {
        await user.click(moreButton);
        await user.click(screen.getByRole("menuitem", { name: /delete/i }));
        expect(onDeleteBoard).toHaveBeenCalledWith("1");
      }
    });
  });

  describe("Loading state during creation", () => {
    it("shows loading indicator while creating", async () => {
      const user = userEvent.setup();
      const onCreateBoard = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );
      render(<BoardList {...defaultProps} onCreateBoard={onCreateBoard} />);

      await user.click(screen.getByRole("button", { name: /create board/i }));
      await user.type(screen.getByPlaceholderText("Enter board title"), "New Board");
      await user.click(screen.getByRole("button", { name: /^create$/i }));

      expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });

    it("disables inputs while creating", async () => {
      const user = userEvent.setup();
      const onCreateBoard = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );
      render(<BoardList {...defaultProps} onCreateBoard={onCreateBoard} />);

      await user.click(screen.getByRole("button", { name: /create board/i }));
      await user.type(screen.getByPlaceholderText("Enter board title"), "New Board");
      await user.click(screen.getByRole("button", { name: /^create$/i }));

      expect(screen.getByPlaceholderText("Enter board title")).toBeDisabled();
    });
  });
});
