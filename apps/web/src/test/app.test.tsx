import { render, screen } from "@testing-library/react";
import { App } from "../App";

describe("App", () => {
  it("renders the starter home page", async () => {
    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: /LANDING PAGE/i,
      }),
    ).toBeInTheDocument();
  });
});
