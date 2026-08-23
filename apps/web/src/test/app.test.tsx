import { render, screen, act } from "@testing-library/react";
import { App, router } from "../App";
import { beforeEach, describe, expect, it } from "vitest";

describe("App", () => {
  beforeEach(async () => {
    // Reset router history and path directly to home
    window.history.pushState(null, "", "/");
    await act(async () => {
      await router.navigate({ to: "/" });
    });
  });

  it("renders the starter home page", async () => {
    render(<App />);

    expect(
      await screen.findByText(/NotAnotherCards/i),
    ).toBeInTheDocument();
  });
});
