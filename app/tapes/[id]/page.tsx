import { ReplayProofRoom } from "@/components/replay/ReplayProofRoom";

export default async function TapeReplayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReplayProofRoom tapeId={id} />;
}
