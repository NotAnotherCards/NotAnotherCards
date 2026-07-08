import { render, screen } from "@testing-library/react";
import { App } from "../App";

describe("App", () => {
  it("renders the starter home page", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", {
        name: /This is a test for Vitest/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /This is also a test/i }),
    ).toBeInTheDocument();
  });
});
