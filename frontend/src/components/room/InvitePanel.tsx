import { useEffect, useState } from "react";
import { Copy, Share2, X } from "lucide-react";

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
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);

  useEffect(() => {
    if (!isQrDialogOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsQrDialogOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isQrDialogOpen]);

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
          <button
            aria-label={`放大房间 ${roomId} 邀请二维码`}
            className="grid shrink-0 gap-1 rounded-md border border-stone-200 bg-white p-1 text-center active:bg-stone-50"
            onClick={() => {
              setIsQrDialogOpen(true);
            }}
            type="button"
          >
            <img
              alt={`房间 ${roomId} 邀请二维码`}
              className="h-20 w-20 rounded-sm"
              src={qrCodeDataUrl}
            />
            <span className="text-[10px] font-semibold leading-none text-stone-400">放大</span>
          </button>
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
      {isQrDialogOpen && qrCodeDataUrl !== undefined ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-stone-950/55 px-5"
          onClick={() => {
            setIsQrDialogOpen(false);
          }}
          role="presentation"
        >
          <div
            aria-labelledby="invite-qr-dialog-title"
            aria-modal="true"
            className="grid w-full max-w-sm gap-4 rounded-md bg-white p-4 shadow-lg"
            onClick={(event) => {
              event.stopPropagation();
            }}
            role="dialog"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p
                  className="text-base font-semibold tracking-normal text-stone-950"
                  id="invite-qr-dialog-title"
                >
                  房间 {roomId}
                </p>
                <p className="mt-1 text-sm text-stone-500">让好友扫码加入房间。</p>
              </div>
              <button
                aria-label="关闭二维码"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-stone-100 text-stone-700 active:bg-stone-200"
                onClick={() => {
                  setIsQrDialogOpen(false);
                }}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid justify-items-center gap-3 rounded-md bg-stone-50 p-4">
              <img
                alt={`房间 ${roomId} 邀请二维码`}
                className="h-64 w-64 max-w-full rounded-md border border-stone-200 bg-white"
                src={qrCodeDataUrl}
              />
              <p className="break-all text-center text-xs leading-5 text-stone-500">{inviteUrl}</p>
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
          </div>
        </div>
      ) : null}
    </section>
  );
}
