"use client";

import { Printer } from "lucide-react";
import { Button } from "./ui";

export function PrintButton() {
  return (
    <Button variant="primary" onClick={() => window.print()}>
      <Printer size={17} />
      Imprimir
    </Button>
  );
}
