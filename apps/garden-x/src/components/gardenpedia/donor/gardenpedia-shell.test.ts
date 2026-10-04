import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (file: string) =>
  readFileSync(
    resolve(process.cwd(), "apps/garden-x/src/components/gardenpedia/donor", file),
    "utf8",
  );

describe("Gardenpedia shared shell and Calculator mobile dock", () => {
  it("keeps the shared shell responsible for all public and private destinations", () => {
    const shell = source("gardenpedia-shell.tsx");
    const explore = source("explore.tsx");

    expect(explore).toContain("GardenpediaShell");
    expect(explore).toContain("showPrivateNavigation");
    expect(shell).toContain('"my-plants"');
    expect(shell).toContain('"my-seeds"');
    expect(shell).toContain('"my-machines"');
    expect(shell).toContain("grid-cols-3");
    expect(shell).toContain('aria-current={active ? "page" : undefined}');
  });

  it("keeps Calculator inside the shared shell and contains the horizontal dock", () => {
    const calculator = source("calculator-page-v1.tsx");

    expect(calculator).toContain("overflow-x-auto");
    expect(calculator).toContain("scrollPaddingInline");
    expect(calculator).toContain("min-w-0 max-w-full");
    expect(calculator).not.toContain("-mx-4");
    expect(calculator).not.toContain('aria-label="Secciones"');
  });
});
