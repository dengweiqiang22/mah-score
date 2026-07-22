import { Copy, Share2 } from "lucide-react";

import { Button } from "../ui/Button";

interface InvitePanelProps {
  readonly inviteUrl: string;
  readonly message?: string;
  readonly onCopy: () => void;
  readonly onShare: () => void;
  readonly qrCodeDataUrl?: string;
  readonly roomId: string;
}

export function InvitePanel({
  inviteUrl,
  message,
  onCopy,
  onShare,
  qrCodeDataUrl,
  roomId,
}: InvitePanelProps) {
  return (
    <section className="grid gap-3">
      <div>
        <p className="text-sm font-semibold text-stone-700">邀请加入</p>
        <p className="mt-1 text-xs text-stone-500">分享链接或二维码给好友。</p>
      </div>
      <div className="flex items-start justify-between gap-4">
        <p className="min-w-0 break-all rounded-md bg-stone-50 px-3 py-2 text-xs leading-5 text-stone-500">
          {inviteUrl}
        </p>
        {qrCodeDataUrl !== undefined ? (
          <img
            alt={`房间 ${roomId} 邀请二维码`}
            className="h-20 w-20 shrink-0 rounded-md border border-stone-200"
            src={qrCodeDataUrl}
          />
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button onClick={onShare}>
          <Share2 className="h-4 w-4" />
          分享
        </Button>
        <Button onClick={onCopy}>
          <Copy className="h-4 w-4" />
          复制
        </Button>
      </div>
      {message !== undefined ? <p className="text-sm font-medium text-stone-500">{message}</p> : null}
    </section>
  );
}
