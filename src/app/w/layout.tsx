import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { CannyInit } from "@/components/feedback/canny-widget";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <CannyInit />
      <WorkspaceShell>{children}</WorkspaceShell>
    </>
  );
}
