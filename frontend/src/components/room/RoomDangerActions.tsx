import { Undo2 } from "lucide-react";

import { Button } from "../ui/Button";

interface RoomDangerActionsProps {
  readonly canUndo: boolean;
  readonly isFinishing: boolean;
  readonly isScoring: boolean;
  readonly isUndoing: boolean;
  readonly onFinish: () => void;
  readonly onUndo: () => void;
  readonly showUndo: boolean;
}

export function RoomDangerActions({
  canUndo,
  isFinishing,
  isScoring,
  isUndoing,
  onFinish,
  onUndo,
  showUndo,
}: RoomDangerActionsProps) {
  return (
    <section className={showUndo ? "grid grid-cols-2 gap-3" : "grid gap-3"}>
      {showUndo ? (
        <Button disabled={!canUndo || isUndoing || isScoring} onClick={onUndo} variant="danger">
          <Undo2 className="h-4 w-4" />
          {isUndoing ? "撤销中..." : "撤销上一条"}
        </Button>
      ) : null}
      <Button disabled={isScoring || isFinishing} onClick={onFinish}>
        结束整场
      </Button>
    </section>
  );
}
