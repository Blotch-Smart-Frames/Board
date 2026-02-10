import { useState } from "react";
import { Button, CircularProgress } from "@mui/material";
import { Google as GoogleIcon } from "@mui/icons-material";
import { useAuthQuery } from "../../hooks/useAuthQuery";

type GoogleAuthButtonProps = {
  variant?: "text" | "outlined" | "contained";
  size?: "small" | "medium" | "large";
};

export function GoogleAuthButton({
  variant = "contained",
  size = "medium",
}: GoogleAuthButtonProps) {
  const { login } = useAuthQuery();
  const [isLoading, setIsLoading] = useState(false);
  const handleClick = async () => {
    try {
      setIsLoading(true);
      await login();
    } catch (err) {
      console.error("Login failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={isLoading}
      startIcon={isLoading ? <CircularProgress size={20} /> : <GoogleIcon />}
      sx={{
        backgroundColor: variant === "contained" ? "#fff" : undefined,
        color: variant === "contained" ? "#757575" : undefined,
        border: variant === "contained" ? "1px solid #dadce0" : undefined,
        "&:hover": {
          backgroundColor: variant === "contained" ? "#f8f9fa" : undefined,
        },
      }}
    >
      {isLoading ? "Signing in..." : "Sign in with Google"}
    </Button>
  );
}
