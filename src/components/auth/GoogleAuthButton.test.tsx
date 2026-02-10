import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GoogleAuthButton } from "./GoogleAuthButton";

const mockLogin = vi.fn();

vi.mock("../../hooks/useAuthQuery", () => ({
  useAuthQuery: () => ({
    login: mockLogin,
  }),
}));

describe("GoogleAuthButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 'Sign in with Google' button", () => {
    render(<GoogleAuthButton />);

    expect(
      screen.getByRole("button", { name: /sign in with google/i })
    ).toBeInTheDocument();
  });

  it("calls login on click", async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue(undefined);

    render(<GoogleAuthButton />);

    await user.click(
      screen.getByRole("button", { name: /sign in with google/i })
    );

    expect(mockLogin).toHaveBeenCalledTimes(1);
  });

  it("shows loading state while signing in", async () => {
    const user = userEvent.setup();
    // Make login take some time
    mockLogin.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );

    render(<GoogleAuthButton />);

    await user.click(
      screen.getByRole("button", { name: /sign in with google/i })
    );

    // Should show "Signing in..." text
    expect(screen.getByRole("button", { name: /signing in/i })).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("disables button during loading", async () => {
    const user = userEvent.setup();
    mockLogin.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );

    render(<GoogleAuthButton />);

    await user.click(
      screen.getByRole("button", { name: /sign in with google/i })
    );

    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("re-enables button after login completes", async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue(undefined);

    render(<GoogleAuthButton />);

    await user.click(
      screen.getByRole("button", { name: /sign in with google/i })
    );

    await waitFor(() => {
      expect(screen.getByRole("button")).not.toBeDisabled();
    });
  });

  it("handles login error gracefully", async () => {
    const user = userEvent.setup();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockLogin.mockRejectedValue(new Error("Login failed"));

    render(<GoogleAuthButton />);

    await user.click(
      screen.getByRole("button", { name: /sign in with google/i })
    );

    await waitFor(() => {
      expect(screen.getByRole("button")).not.toBeDisabled();
    });

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("applies contained variant by default", () => {
    render(<GoogleAuthButton />);

    const button = screen.getByRole("button", { name: /sign in with google/i });
    expect(button).toHaveClass("MuiButton-contained");
  });

  it("applies outlined variant when specified", () => {
    render(<GoogleAuthButton variant="outlined" />);

    const button = screen.getByRole("button", { name: /sign in with google/i });
    expect(button).toHaveClass("MuiButton-outlined");
  });

  it("applies medium size by default", () => {
    render(<GoogleAuthButton />);

    const button = screen.getByRole("button", { name: /sign in with google/i });
    expect(button).toHaveClass("MuiButton-sizeMedium");
  });

  it("applies small size when specified", () => {
    render(<GoogleAuthButton size="small" />);

    const button = screen.getByRole("button", { name: /sign in with google/i });
    expect(button).toHaveClass("MuiButton-sizeSmall");
  });
});
