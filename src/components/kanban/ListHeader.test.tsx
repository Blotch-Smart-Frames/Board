import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ListHeader } from "./ListHeader";

describe("ListHeader", () => {
  const defaultProps = {
    title: "Test List",
    taskCount: 5,
    onUpdateTitle: vi.fn(),
    onDelete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("displays list title", () => {
    render(<ListHeader {...defaultProps} />);

    expect(screen.getByRole("heading", { name: "Test List" })).toBeInTheDocument();
  });

  it("displays task count", () => {
    render(<ListHeader {...defaultProps} />);

    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("displays zero task count", () => {
    render(<ListHeader {...defaultProps} taskCount={0} />);

    expect(screen.getByText("0")).toBeInTheDocument();
  });

  describe("Edit mode", () => {
    it("enters edit mode on title click", async () => {
      const user = userEvent.setup();
      render(<ListHeader {...defaultProps} />);

      await user.click(screen.getByRole("heading", { name: "Test List" }));

      expect(screen.getByRole("textbox")).toBeInTheDocument();
      expect(screen.getByRole("textbox")).toHaveValue("Test List");
    });

    it("saves on Enter key", async () => {
      const user = userEvent.setup();
      const onUpdateTitle = vi.fn();
      render(<ListHeader {...defaultProps} onUpdateTitle={onUpdateTitle} />);

      await user.click(screen.getByRole("heading", { name: "Test List" }));
      await user.clear(screen.getByRole("textbox"));
      await user.type(screen.getByRole("textbox"), "New Title{Enter}");

      expect(onUpdateTitle).toHaveBeenCalledWith("New Title");
    });

    it("cancels on Escape key", async () => {
      const user = userEvent.setup();
      const onUpdateTitle = vi.fn();
      render(<ListHeader {...defaultProps} onUpdateTitle={onUpdateTitle} />);

      await user.click(screen.getByRole("heading", { name: "Test List" }));
      await user.clear(screen.getByRole("textbox"));
      await user.type(screen.getByRole("textbox"), "Changed Title{Escape}");

      // Should revert to original title
      expect(screen.getByRole("heading", { name: "Test List" })).toBeInTheDocument();
      expect(onUpdateTitle).not.toHaveBeenCalled();
    });

    it("saves on blur", async () => {
      const user = userEvent.setup();
      const onUpdateTitle = vi.fn();
      render(<ListHeader {...defaultProps} onUpdateTitle={onUpdateTitle} />);

      await user.click(screen.getByRole("heading", { name: "Test List" }));
      await user.clear(screen.getByRole("textbox"));
      await user.type(screen.getByRole("textbox"), "New Title");
      await user.tab(); // Trigger blur

      expect(onUpdateTitle).toHaveBeenCalledWith("New Title");
    });

    it("does not call onUpdateTitle if title unchanged", async () => {
      const user = userEvent.setup();
      const onUpdateTitle = vi.fn();
      render(<ListHeader {...defaultProps} onUpdateTitle={onUpdateTitle} />);

      await user.click(screen.getByRole("heading", { name: "Test List" }));
      await user.keyboard("{Enter}"); // Submit without changing

      expect(onUpdateTitle).not.toHaveBeenCalled();
    });

    it("does not call onUpdateTitle with empty title", async () => {
      const user = userEvent.setup();
      const onUpdateTitle = vi.fn();
      render(<ListHeader {...defaultProps} onUpdateTitle={onUpdateTitle} />);

      await user.click(screen.getByRole("heading", { name: "Test List" }));
      await user.clear(screen.getByRole("textbox"));
      await user.keyboard("{Enter}");

      expect(onUpdateTitle).not.toHaveBeenCalled();
    });

    it("trims whitespace from title", async () => {
      const user = userEvent.setup();
      const onUpdateTitle = vi.fn();
      render(<ListHeader {...defaultProps} onUpdateTitle={onUpdateTitle} />);

      await user.click(screen.getByRole("heading", { name: "Test List" }));
      await user.clear(screen.getByRole("textbox"));
      await user.type(screen.getByRole("textbox"), "  Trimmed Title  {Enter}");

      expect(onUpdateTitle).toHaveBeenCalledWith("Trimmed Title");
    });

    it("reverts to original title on empty submit", async () => {
      const user = userEvent.setup();
      render(<ListHeader {...defaultProps} />);

      await user.click(screen.getByRole("heading", { name: "Test List" }));
      await user.clear(screen.getByRole("textbox"));
      await user.keyboard("{Enter}");

      expect(screen.getByRole("heading", { name: "Test List" })).toBeInTheDocument();
    });
  });

  describe("Menu", () => {
    it("opens menu on more button click", async () => {
      const user = userEvent.setup();
      render(<ListHeader {...defaultProps} />);

      await user.click(screen.getByRole("button"));

      expect(screen.getByRole("menuitem", { name: /edit title/i })).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: /delete list/i })).toBeInTheDocument();
    });

    it("enters edit mode from menu", async () => {
      const user = userEvent.setup();
      render(<ListHeader {...defaultProps} />);

      await user.click(screen.getByRole("button"));
      await user.click(screen.getByRole("menuitem", { name: /edit title/i }));

      await waitFor(() => {
        expect(screen.getByRole("textbox")).toBeInTheDocument();
      });
    });

    it("calls onDelete from menu", async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn();
      render(<ListHeader {...defaultProps} onDelete={onDelete} />);

      await user.click(screen.getByRole("button"));
      await user.click(screen.getByRole("menuitem", { name: /delete list/i }));

      expect(onDelete).toHaveBeenCalled();
    });

    it("closes menu after selecting option", async () => {
      const user = userEvent.setup();
      render(<ListHeader {...defaultProps} />);

      await user.click(screen.getByRole("button"));

      // Menu should be visible
      expect(screen.getByRole("menu")).toBeInTheDocument();

      await user.click(screen.getByRole("menuitem", { name: /edit title/i }));

      // Menu should close
      await waitFor(() => {
        expect(screen.queryByRole("menu")).not.toBeInTheDocument();
      });
    });

    it("closes menu on outside click", async () => {
      const user = userEvent.setup();
      render(<ListHeader {...defaultProps} />);

      await user.click(screen.getByRole("button"));
      expect(screen.getByRole("menu")).toBeInTheDocument();

      // Click outside by pressing Escape
      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(screen.queryByRole("menu")).not.toBeInTheDocument();
      });
    });
  });

  describe("Accessibility", () => {
    it("heading has correct level", () => {
      render(<ListHeader {...defaultProps} />);

      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading).toHaveTextContent("Test List");
    });

    it("edit input is focused when entering edit mode", async () => {
      const user = userEvent.setup();
      render(<ListHeader {...defaultProps} />);

      await user.click(screen.getByRole("heading", { name: "Test List" }));

      await waitFor(() => {
        expect(screen.getByRole("textbox")).toHaveFocus();
      });
    });
  });
});
