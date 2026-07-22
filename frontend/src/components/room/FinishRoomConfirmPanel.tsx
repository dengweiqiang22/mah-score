import { Button } from "../ui/Button";

interface FinishRoomConfirmPanelProps {
  readonly isFinishing: boolean;
  readonly lines: readonly string[];
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

export function FinishRoomConfirmPanel({
  isFinishing,
  lines,
  onCancel,
  onConfirm,
}: FinishRoomConfirmPanelProps) {
  return (
    <section className="grid gap-3 rounded-md border border-amber-200 bg-amber-50 p-4">
      <div className="grid gap-2">
        {lines.map((line) => (
          <p className="text-sm leading-6 text-amber-950" key={line}>
            {line}
          </p>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button disabled={isFinishing} onClick={onCancel}>
          返回检查
        </Button>
        <Button disabled={isFinishing} onClick={onConfirm} variant="danger">
          {isFinishing ? "结束中..." : "确认结束"}
        </Button>
      </div>
    </section>
  );
}
