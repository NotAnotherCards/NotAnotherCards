import { render, screen } from "@testing-library/react";
import { ThemeChanger } from "../components/ThemeChanger";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const setThemeMock = vi.fn();

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: "light",
    setTheme: setThemeMock,
  }),
}));

describe("ThemeChanger Component", () => {
  it("renders light, dark, and system options", () => {
    render(<ThemeChanger />);

    expect(
      screen.getByRole("button", { name: /light mode/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /dark mode/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /system preference/i }),
    ).toBeInTheDocument();
  });

  it("calls setTheme with the correct value when clicked", async () => {
    const user = userEvent.setup();
    render(<ThemeChanger />);

    const darkButton = screen.getByRole("button", { name: /dark mode/i });
    await user.click(darkButton);

    expect(setThemeMock).toHaveBeenCalledWith("dark");
  });
});
