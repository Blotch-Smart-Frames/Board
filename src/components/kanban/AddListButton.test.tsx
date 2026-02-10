import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { AddListButton } from "./AddListButton";

describe("AddListButton", () => {
  it("shows 'Add another list' button initially", () => {
    const onAdd = vi.fn();
    render(<AddListButton onAdd={onAdd} />);

    expect(
      screen.getByRole("button", { name: /add another list/i })
    ).toBeInTheDocument();
  });

  it("reveals input form on button click", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<AddListButton onAdd={onAdd} />);

    await user.click(screen.getByRole("button", { name: /add another list/i }));

    expect(
      screen.getByPlaceholderText("Enter list title...")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add list/i })).toBeInTheDocument();
  });

  it("creates list on Enter key", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<AddListButton onAdd={onAdd} />);

    await user.click(screen.getByRole("button", { name: /add another list/i }));
    await user.type(
      screen.getByPlaceholderText("Enter list title..."),
      "New List{Enter}"
    );

    expect(onAdd).toHaveBeenCalledWith("New List");
  });

  it("creates list on Add list button click", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<AddListButton onAdd={onAdd} />);

    await user.click(screen.getByRole("button", { name: /add another list/i }));
    await user.type(
      screen.getByPlaceholderText("Enter list title..."),
      "My New List"
    );
    await user.click(screen.getByRole("button", { name: /^add list$/i }));

    expect(onAdd).toHaveBeenCalledWith("My New List");
  });

  it("cancels on Escape key", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<AddListButton onAdd={onAdd} />);

    await user.click(screen.getByRole("button", { name: /add another list/i }));
    await user.type(
      screen.getByPlaceholderText("Enter list title..."),
      "Some Text{Escape}"
    );

    // Should revert to the button state
    expect(
      screen.getByRole("button", { name: /add another list/i })
    ).toBeInTheDocument();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("cancels on close button click", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<AddListButton onAdd={onAdd} />);

    await user.click(screen.getByRole("button", { name: /add another list/i }));
    await user.type(
      screen.getByPlaceholderText("Enter list title..."),
      "Some Text"
    );

    // Find the close button (has CloseIcon)
    const buttons = screen.getAllByRole("button");
    const closeButton = buttons.find(
      (btn) => btn.textContent === "" && btn !== screen.getByRole("button", { name: /add list/i })
    );
    if (closeButton) {
      await user.click(closeButton);
    }

    expect(
      screen.getByRole("button", { name: /add another list/i })
    ).toBeInTheDocument();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("does not submit with empty or whitespace-only input", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<AddListButton onAdd={onAdd} />);

    await user.click(screen.getByRole("button", { name: /add another list/i }));
    await user.type(
      screen.getByPlaceholderText("Enter list title..."),
      "   {Enter}"
    );

    // Should not call onAdd with empty/whitespace title
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("disables Add list button when input is empty", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<AddListButton onAdd={onAdd} />);

    await user.click(screen.getByRole("button", { name: /add another list/i }));

    expect(screen.getByRole("button", { name: /^add list$/i })).toBeDisabled();
  });

  it("enables Add list button when input has text", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<AddListButton onAdd={onAdd} />);

    await user.click(screen.getByRole("button", { name: /add another list/i }));
    await user.type(
      screen.getByPlaceholderText("Enter list title..."),
      "New List"
    );

    expect(
      screen.getByRole("button", { name: /^add list$/i })
    ).not.toBeDisabled();
  });

  it("trims whitespace from title before submitting", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<AddListButton onAdd={onAdd} />);

    await user.click(screen.getByRole("button", { name: /add another list/i }));
    await user.type(
      screen.getByPlaceholderText("Enter list title..."),
      "  Trimmed Title  {Enter}"
    );

    expect(onAdd).toHaveBeenCalledWith("Trimmed Title");
  });

  it("clears input after successful submission", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<AddListButton onAdd={onAdd} />);

    await user.click(screen.getByRole("button", { name: /add another list/i }));
    await user.type(
      screen.getByPlaceholderText("Enter list title..."),
      "First List{Enter}"
    );

    // Should return to button state, meaning form is hidden
    expect(
      screen.getByRole("button", { name: /add another list/i })
    ).toBeInTheDocument();
  });
});
